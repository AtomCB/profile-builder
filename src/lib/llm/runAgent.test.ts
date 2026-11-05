import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/chat/types";
import type { ProfileOp } from "@/lib/profile/ops";
import { applyOps } from "@/lib/profile/reducer";
import { createEmptyProfile, type UserProfile } from "@/lib/profile/schema";
import { MAX_TOOL_ROUNDS, runAgent, toContents, type AgentEvent, type Chunk, type GenerateRequest } from "./runAgent";
import { updateProfileArgsSchema } from "@/lib/profile/ops";
import { FUNCTION_DECLARATIONS, normalizeAgentOps } from "./tools";

const msg = (role: ChatMessage["role"], content: string, status: ChatMessage["status"] = "complete"): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  tools: [],
  changes: [],
  status,
  createdAt: "",
});

/** A fake model that replays scripted responses, one per request. */
function fakeModel(script: Chunk[][]) {
  const requests: GenerateRequest[] = [];
  const generate = async (req: GenerateRequest) => {
    requests.push(structuredClone({ ...req, config: { ...req.config, abortSignal: undefined } }));
    const chunks = script[requests.length - 1] ?? [{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }];
    return (async function* () {
      yield* chunks;
    })();
  };
  return { generate, requests };
}

function memoryStore() {
  let profile: UserProfile = createEmptyProfile();
  return {
    loadProfile: () => profile,
    applyProfileOps: (ops: readonly ProfileOp[]) => {
      const r = applyOps(profile, ops);
      profile = r.profile;
      return r;
    },
    get profile() {
      return profile;
    },
  };
}

const text = (t: string): Chunk => ({ candidates: [{ content: { parts: [{ text: t }] } }] });
const call = (name: string, args: Record<string, unknown>, id = name): Chunk => ({
  candidates: [{ content: { parts: [{ functionCall: { id, name, args }, thoughtSignature: "sig" }] } }],
});

async function run(script: Chunk[][], history = [msg("user", "Hi")]) {
  const model = fakeModel(script);
  const store = memoryStore();
  const events: AgentEvent[] = [];
  for await (const e of runAgent({ history, deps: { generate: model.generate, ...store } })) events.push(e);
  return { events, requests: model.requests, store };
}

describe("runAgent", () => {
  it("streams text when the model answers directly", async () => {
    const { events, requests } = await run([[text("Hello"), text(" there")]]);
    expect(events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " there" },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].config.systemInstruction).toContain("travel-profile interviewer");
    expect(requests[0].config.systemInstruction).toContain("Ambiguous place names");
  });

  it("runs tools, saves profile changes and feeds results back", async () => {
    const { events, requests, store } = await run(
      [
        [call("getDestinationInfo", { name: "Kyoto" })],
        [
          call("updateProfile", {
            ops: [
              { op: "upsertPlace", place: { name: "Kyoto", destinationId: "kyoto", status: "visited", sentiment: "loved" } },
              { op: "add", path: "preferences.interests", value: "temples", source: "inferred" },
            ],
          }),
        ],
        [text("Added Kyoto.")],
      ],
      [msg("user", "I loved Kyoto")],
    );

    expect(events.map((e) => e.type)).toEqual(["tool", "tool", "profile", "token"]);
    expect(events[0]).toEqual({ type: "tool", tool: { name: "getDestinationInfo", arg: "Kyoto", found: true } });
    expect(store.profile.places[0].name).toBe("Kyoto");
    expect(store.profile.preferences.interests?.[0]).toMatchObject({ value: "temples", source: "inferred" });

    // Second request carries the model's call (with its thought signature) and our function response.
    const second = requests[1].contents;
    expect(second.at(-2)?.parts[0]).toMatchObject({ functionCall: { name: "getDestinationInfo" }, thoughtSignature: "sig" });
    expect(second.at(-1)?.parts[0].functionResponse?.response).toMatchObject({ found: true });
    // Third request's system prompt reflects the updated profile.
    expect(requests[2].config.systemInstruction).toContain('"name":"Kyoto"');
  });

  it("returns found:false for unknown destinations", async () => {
    const { events, requests } = await run([[call("getDestinationInfo", { name: "Bangkok" })], [text("No info.")]]);
    expect(events[0]).toEqual({ type: "tool", tool: { name: "getDestinationInfo", arg: "Bangkok", found: false } });
    expect(requests[1].contents.at(-1)?.parts[0].functionResponse?.response).toMatchObject({ found: false });
  });

  it("reports invalid updateProfile args back to the model without changing the profile", async () => {
    const { events, requests, store } = await run([
      [call("updateProfile", { ops: [{ op: "add", path: "traveler.passports", value: "CA", source: "inferred" }] })],
      [text("Sorry.")],
    ]);
    expect(events.some((e) => e.type === "profile")).toBe(false);
    expect(store.profile.traveler.passports).toBeNull();
    expect(requests[1].contents.at(-1)?.parts[0].functionResponse?.response).toMatchObject({ ok: false });
  });

  it("applies valid ops even when another op in the same call is malformed", async () => {
    const { events, requests, store } = await run([
      [
        call("updateProfile", {
          ops: [
            { op: "add", path: "preferences.interests", value: "art", source: "stated" },
            { op: "set", path: "preferences.secret", value: "x", source: "stated" },
          ],
        }),
      ],
      [text("Done.")],
    ]);
    expect(events.some((e) => e.type === "profile")).toBe(true);
    expect(store.profile.preferences.interests?.[0].value).toBe("art");
    const response = requests[1].contents.at(-1)?.parts[0].functionResponse?.response;
    expect(response).toMatchObject({ ok: false, applied: 1, errors: [{ index: 1 }] });
  });

  it("stops calling tools after MAX_TOOL_ROUNDS", async () => {
    const loop = Array.from({ length: MAX_TOOL_ROUNDS + 3 }, () => [call("getDestinationInfo", { name: "Lisbon" })]);
    const { requests } = await run(loop);
    expect(requests).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(requests.at(-1)?.config.toolConfig).toEqual({ functionCallingConfig: { mode: "NONE" } });
  });

  it("ignores thought text", async () => {
    const { events } = await run([
      [{ candidates: [{ content: { parts: [{ text: "secret plan", thought: true }, { text: "Hi!" }] } }] }],
    ]);
    expect(events).toEqual([{ type: "token", text: "Hi!" }]);
  });
});

describe("toContents", () => {
  it("skips failed replies, merges same-role turns and starts with a user turn", () => {
    const contents = toContents([
      msg("assistant", "Opening"),
      msg("user", "One"),
      msg("assistant", "", "error"),
      msg("user", "Two"),
      msg("assistant", "Reply"),
    ]);
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user", "model"]);
    expect(contents[2].parts[0].text).toBe("One\n\nTwo");
  });
});

describe("tool schemas", () => {
  it("avoid schema features Gemini handles poorly", () => {
    const json = JSON.stringify(FUNCTION_DECLARATIONS);
    expect(json).not.toMatch(/"anyOf"|"oneOf"|"const"|"\$schema"|"null"|"additionalProperties"|9007199254740991/);
  });

  it("normalizes the flat tool shape into valid profile ops", () => {
    const normalized = normalizeAgentOps({
      ops: [
        { op: "set", path: "preferences.travelMonths", months: [3, 4], source: "stated", value: "" },
        { op: "set", path: "traveler.homeBase", homeBase: { city: "Toronto", country: "Canada" }, source: "stated" },
        { op: "set", path: "preferences.pace", value: "relaxed", source: "inferred" },
        { op: "add", path: "traveler.passports", value: "CA", source: "stated", id: "" },
        { op: "upsertPlace", place: { name: "Bangkok", status: "visited", destinationId: "" } },
        { op: "removePlace", name: "Lisbon" },
      ],
    });
    const parsed = updateProfileArgsSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.ops[0]).toEqual({ op: "set", path: "preferences.travelMonths", value: [3, 4], source: "stated" });
    expect(parsed.data?.ops[4]).toEqual({ op: "upsertPlace", place: { name: "Bangkok", status: "visited" } });
  });
});
