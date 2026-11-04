import { z } from "zod";
import { FIELD_PATHS, LIST_PATHS } from "./paths";
import { homeBaseSchema, monthSchema, PLACE_STATUSES, SENTIMENTS, sourceSchema } from "./schema";

const listPathSchema = z.enum(LIST_PATHS).describe("A profile path that holds a list.");
const fieldPathSchema = z.enum(FIELD_PATHS).describe("A profile path that holds a single value.");
const valuePathSchema = z.enum([...LIST_PATHS, ...FIELD_PATHS]);

const itemRef = {
  id: z.string().optional().describe("Item id from the current profile."),
  value: z.string().optional().describe("Item value (case-insensitive). Used when id is not given."),
};

export const setOpSchema = z
  .object({
    op: z.literal("set"),
    path: fieldPathSchema,
    value: z
      .union([z.string(), z.array(z.number().int()), homeBaseSchema])
      .describe(
        "homeBase: {city, country}; travelMonths: array of month numbers 1-12; others: one allowed string value.",
      ),
    source: sourceSchema,
  })
  .describe("Set a single-value field.");

export const addOpSchema = z
  .object({
    op: z.literal("add"),
    path: listPathSchema,
    value: z.string(),
    source: sourceSchema,
  })
  .describe("Add an item to a list. Duplicates are merged.");

export const removeOpSchema = z
  .object({ op: z.literal("remove"), path: listPathSchema, ...itemRef })
  .describe("Remove an item from a list.");

export const markNoneOpSchema = z
  .object({ op: z.literal("markNone"), path: listPathSchema })
  .describe("The user said they have none (e.g. no dietary restrictions). Sets the list to empty.");

export const clearOpSchema = z
  .object({ op: z.literal("clear"), path: valuePathSchema })
  .describe("Reset a field or list to 'not asked yet'.");

export const confirmOpSchema = z
  .object({ op: z.literal("confirm"), path: valuePathSchema, ...itemRef })
  .describe("The user confirmed an inferred value; marks it as stated.");

export const placeInputSchema = z.object({
  id: z.string().optional().describe("Existing place id, when updating."),
  name: z.string().min(1).describe("Place name as the user said it."),
  destinationId: z.string().nullable().optional().describe("id from getDestinationInfo, if it matched."),
  status: z.enum(PLACE_STATUSES).optional().describe("Required when adding a new place."),
  sentiment: z.enum(SENTIMENTS).nullable().optional(),
  months: z.array(monthSchema).nullable().optional(),
  year: z.number().int().nullable().optional(),
  highlights: z.array(z.string()).optional().describe("Things they did or loved there."),
  lowlights: z.array(z.string()).optional().describe("Things they disliked there."),
  source: sourceSchema.optional(),
});
export type PlaceInput = z.infer<typeof placeInputSchema>;

export const upsertPlaceOpSchema = z
  .object({ op: z.literal("upsertPlace"), place: placeInputSchema })
  .describe("Add a place, or update one matched by id or name.");

export const removePlaceOpSchema = z
  .object({ op: z.literal("removePlace"), id: z.string().optional(), name: z.string().optional() })
  .describe("Remove a place by id or name.");

/** UI-only: the user rejected an item. Removes it and remembers the rejection. */
export const rejectOpSchema = z.object({
  op: z.literal("reject"),
  path: z.enum([...LIST_PATHS, ...FIELD_PATHS, "places"]),
  id: z.string().optional(),
});

const agentOpMembers = [
  setOpSchema,
  addOpSchema,
  removeOpSchema,
  markNoneOpSchema,
  clearOpSchema,
  confirmOpSchema,
  upsertPlaceOpSchema,
  removePlaceOpSchema,
] as const;

/** Ops the LLM may send through the updateProfile tool. */
export const agentOpSchema = z.discriminatedUnion("op", [...agentOpMembers]);

/** Every op the reducer understands. */
export const profileOpSchema = z.discriminatedUnion("op", [...agentOpMembers, rejectOpSchema]);

/** Arguments of the updateProfile tool. */
export const updateProfileArgsSchema = z.object({
  ops: z.array(agentOpSchema).min(1).max(20),
});

/** Body of POST /api/profile. */
export const uiProfileRequestSchema = z.object({
  ops: z.array(rejectOpSchema).min(1).max(20),
});

export type AgentOp = z.infer<typeof agentOpSchema>;
export type RejectOp = z.infer<typeof rejectOpSchema>;
export type ProfileOp = z.infer<typeof profileOpSchema>;
