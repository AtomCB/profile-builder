import { describe, expect, it } from "vitest";
import { z } from "zod";
import { agentOpSchema, uiProfileRequestSchema, updateProfileArgsSchema } from "./ops";

describe("op schemas", () => {
  it("parses valid agent ops", () => {
    const parsed = updateProfileArgsSchema.safeParse({
      ops: [
        { op: "set", path: "preferences.travelMonths", value: [3, 4], source: "stated" },
        { op: "add", path: "preferences.interests", value: "food", source: "inferred" },
        { op: "upsertPlace", place: { name: "Kyoto", status: "visited" } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown ops and paths", () => {
    expect(agentOpSchema.safeParse({ op: "drop", path: "preferences.pace" }).success).toBe(false);
    expect(
      agentOpSchema.safeParse({ op: "add", path: "preferences.secrets", value: "x", source: "stated" }).success,
    ).toBe(false);
  });

  it("does not let the agent send UI-only reject ops", () => {
    expect(agentOpSchema.safeParse({ op: "reject", path: "preferences.interests", id: "a" }).success).toBe(false);
  });

  it("only allows reject ops from the UI", () => {
    expect(uiProfileRequestSchema.safeParse({ ops: [{ op: "reject", path: "places", id: "p1" }] }).success).toBe(true);
    expect(
      uiProfileRequestSchema.safeParse({ ops: [{ op: "markNone", path: "preferences.avoid" }] }).success,
    ).toBe(false);
  });

  it("converts the tool arguments to JSON Schema for the LLM", () => {
    const schema = z.toJSONSchema(updateProfileArgsSchema) as { properties?: Record<string, unknown> };
    expect(schema.properties).toHaveProperty("ops");
  });
});
