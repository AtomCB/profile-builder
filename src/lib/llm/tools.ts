import { z } from "zod";
import { getDestinationInfo } from "@/lib/destinations/getDestinationInfo";
import { getCompleteness, type Completeness } from "@/lib/profile/completeness";
import { agentOpSchema, type ProfileOp } from "@/lib/profile/ops";
import { FIELD_PATHS, LIST_PATHS } from "@/lib/profile/paths";
import type { ApplyResult } from "@/lib/profile/reducer";
import { PLACE_STATUSES, SENTIMENTS, SOURCES } from "@/lib/profile/schema";
import type { ToolEvent } from "@/lib/chat/types";
import type { UserProfile } from "@/lib/profile/schema";

const AGENT_OPS = ["set", "add", "remove", "markNone", "clear", "confirm", "upsertPlace", "removePlace"] as const;

/**
 * Hand-written, flat schema for updateProfile. Gemini's function-calling backend
 * struggles with unions, null types and huge numeric bounds (it answers with a 500),
 * so every op shares one simple object shape. normalizeAgentOps() converts it to the
 * strict ProfileOp union, which Zod then validates.
 */
const UPDATE_PROFILE_PARAMETERS = {
  type: "object",
  properties: {
    ops: {
      type: "array",
      description: "Profile changes to apply, in order.",
      items: {
        type: "object",
        properties: {
          op: {
            type: "string",
            enum: [...AGENT_OPS],
            description:
              "set: single-value field. add/remove: list item. markNone: user has none (list becomes empty). clear: reset to not asked. confirm: inferred becomes stated. upsertPlace/removePlace: places.",
          },
          path: {
            type: "string",
            enum: [...LIST_PATHS, ...FIELD_PATHS],
            description: "Profile path. Required for set, add, remove, markNone, clear, confirm.",
          },
          value: {
            type: "string",
            description:
              "add/remove/confirm: the item value (budgetTier: budget, midRange or luxury). set: the value for pace or tripLength. Passports are ISO alpha-2 codes like CA.",
          },
          months: {
            type: "array",
            items: { type: "integer" },
            description: "set preferences.travelMonths only: month numbers 1-12.",
          },
          homeBase: {
            type: "object",
            description: "set traveler.homeBase only.",
            properties: { city: { type: "string" }, country: { type: "string" } },
            required: ["country"],
          },
          source: { type: "string", enum: [...SOURCES], description: "Required for set and add." },
          id: { type: "string", description: "Optional item or place id from the current profile." },
          name: { type: "string", description: "removePlace: the place name." },
          place: {
            type: "object",
            description: "upsertPlace: the place to add or update (matched by id or name).",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              destinationId: { type: "string", description: "id from getDestinationInfo; omit if unknown." },
              status: { type: "string", enum: [...PLACE_STATUSES], description: "Required for a new place." },
              sentiment: { type: "string", enum: [...SENTIMENTS] },
              months: { type: "array", items: { type: "integer" } },
              year: { type: "integer" },
              highlights: { type: "array", items: { type: "string" } },
              lowlights: { type: "array", items: { type: "string" } },
              source: { type: "string", enum: [...SOURCES] },
            },
            required: ["name"],
          },
        },
        required: ["op"],
      },
    },
  },
  required: ["ops"],
};

/** Converts the flat tool-call shape into ProfileOp candidates (validated afterwards by Zod). */
export function normalizeAgentOps(args: unknown): unknown {
  if (!args || typeof args !== "object" || !Array.isArray((args as { ops?: unknown }).ops)) return args;
  const ops = (args as { ops: Record<string, unknown>[] }).ops.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const { op, path, value, months, homeBase, source, id, name, place } = raw;
    const clean = (o: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
    switch (op) {
      case "set":
        return {
          op,
          path,
          source,
          value:
            (path === "preferences.travelMonths" ? months : path === "traveler.homeBase" ? homeBase : undefined) ??
            value,
        };
      case "add":
        return clean({ op, path, value, source });
      case "remove":
      case "confirm":
        return clean({ op, path, value, id });
      case "markNone":
      case "clear":
        return { op, path };
      case "removePlace":
        return clean({ op, id, name });
      case "upsertPlace": {
        const p = (place ?? {}) as Record<string, unknown>;
        return { op, place: clean({ ...p, destinationId: p.destinationId || undefined }) };
      }
      default:
        return raw;
    }
  });
  return { ops };
}

export const FUNCTION_DECLARATIONS = [
  {
    name: "getDestinationInfo",
    description:
      "Get information about a destination: best months, what it's known for, costs, visa rules by passport, dietary and accessibility notes. Returns {found:false} for destinations you have no data on.",
    parametersJsonSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Destination name, e.g. 'Kyoto'." } },
      required: ["name"],
    },
  },
  {
    name: "updateProfile",
    description:
      "Apply one or more changes to the user's travel profile. Returns which ops succeeded, errors for any that failed, and the updated completeness.",
    parametersJsonSchema: UPDATE_PROFILE_PARAMETERS,
  },
];

export interface ToolDeps {
  applyProfileOps: (ops: readonly ProfileOp[]) => ApplyResult;
}

export interface ToolOutcome {
  /** Sent back to the model as the function response. */
  response: Record<string, unknown>;
  /** Shown in the UI as a badge. */
  event: ToolEvent;
  /** Present when the profile changed. */
  profile?: { profile: UserProfile; completeness: Completeness };
}

export function executeTool(name: string, args: unknown, deps: ToolDeps): ToolOutcome {
  if (name === "getDestinationInfo") {
    const parsed = z.object({ name: z.string().min(1) }).safeParse(args);
    if (!parsed.success) {
      return {
        response: { error: "Provide a destination name." },
        event: { name: "getDestinationInfo", found: false },
      };
    }
    const info = getDestinationInfo(parsed.data.name);
    return {
      response: info
        ? { found: true, destination: info }
        : {
            found: false,
            message: `No information about "${parsed.data.name}". Tell the user you don't know anything about it. Do not use outside knowledge about it.`,
          },
      event: { name: "getDestinationInfo", arg: parsed.data.name, found: info !== null },
    };
  }

  if (name === "updateProfile") {
    const rawOps = (normalizeAgentOps(args) as { ops?: unknown })?.ops;
    if (!Array.isArray(rawOps) || rawOps.length === 0) {
      return {
        response: { ok: false, error: "Provide a non-empty ops array." },
        event: { name: "updateProfile" },
      };
    }

    // Validate each op on its own so one malformed op doesn't discard the valid ones.
    const errors: { index: number; error: string }[] = [];
    const valid: { index: number; op: ProfileOp }[] = [];
    rawOps.slice(0, 20).forEach((raw, index) => {
      const parsed = agentOpSchema.safeParse(raw);
      if (parsed.success) valid.push({ index, op: parsed.data });
      else {
        const issue = parsed.error.issues[0];
        errors.push({ index, error: `Invalid op: ${issue?.path.join(".") || "op"}: ${issue?.message}` });
      }
    });

    const result = deps.applyProfileOps(valid.map((v) => v.op));
    result.results.forEach((r, i) => {
      if (!r.ok) errors.push({ index: valid[i].index, error: r.error });
    });
    errors.sort((a, b) => a.index - b.index);
    const completeness = getCompleteness(result.profile);
    return {
      response: {
        ok: errors.length === 0,
        applied: rawOps.length - errors.length,
        errors,
        completeness: { done: completeness.done, total: completeness.total, missing: completeness.missing },
      },
      event: { name: "updateProfile" },
      profile: result.changed ? { profile: result.profile, completeness } : undefined,
    };
  }

  return { response: { error: `Unknown tool ${name}` }, event: { name: "updateProfile" } };
}
