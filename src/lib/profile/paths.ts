import { z } from "zod";
import {
  accommodationSchema,
  budgetTierSchema,
  climateSchema,
  companionSchema,
  homeBaseSchema,
  monthSchema,
  paceSchema,
  passportCodeSchema,
  textValueSchema,
  tripLengthSchema,
  type HomeBase,
} from "./schema";

/** Profile paths that hold a list of items. */
export const LIST_PATHS = [
  "traveler.passports",
  "traveler.dietaryRestrictions",
  "traveler.accessibilityNeeds",
  "preferences.companions",
  "preferences.interests",
  "preferences.avoid",
  "preferences.dietaryPreferences",
  "preferences.climate",
  "preferences.accommodation",
] as const;

/** Profile paths that hold a single value. */
export const FIELD_PATHS = [
  "traveler.homeBase",
  "preferences.budgetTier",
  "preferences.pace",
  "preferences.travelMonths",
  "preferences.tripLength",
] as const;

export type ListPath = (typeof LIST_PATHS)[number];
export type FieldPath = (typeof FIELD_PATHS)[number];
export type ValuePath = ListPath | FieldPath;
export type RejectablePath = ValuePath | "places";

type Section = "traveler" | "preferences";

interface PathMetaBase {
  section: Section;
  key: string;
  label: string;
  /** Hard constraints can never be inferred. */
  hard: boolean;
}

export interface ListPathMeta extends PathMetaBase {
  kind: "list";
  schema: z.ZodType<string>;
  prepare: (raw: string) => string;
}

export interface FieldPathMeta extends PathMetaBase {
  kind: "field";
  schema: z.ZodType;
  prepare: (raw: unknown) => unknown;
  /** Stable, lowercased string form used for rejection matching. */
  serialize: (value: unknown) => string;
}

export const normalizeText = (s: string) => s.trim().replace(/\s+/g, " ");
export const normalizeKey = (s: string) => normalizeText(s).toLowerCase();

const asIs = (s: string) => s.trim();
const upper = (s: string) => s.trim().toUpperCase();

function listMeta(
  path: ListPath,
  label: string,
  hard: boolean,
  schema: z.ZodType<string>,
  prepare: (raw: string) => string = normalizeText,
): ListPathMeta {
  const [section, key] = path.split(".") as [Section, string];
  return { kind: "list", section, key, label, hard, schema, prepare };
}

function fieldMeta(
  path: FieldPath,
  label: string,
  hard: boolean,
  schema: z.ZodType,
  prepare: (raw: unknown) => unknown = (raw) => (typeof raw === "string" ? raw.trim() : raw),
  serialize: (value: unknown) => string = (value) => normalizeKey(String(value)),
): FieldPathMeta {
  const [section, key] = path.split(".") as [Section, string];
  return { kind: "field", section, key, label, hard, schema, prepare, serialize };
}

export const LIST_META: Record<ListPath, ListPathMeta> = {
  "traveler.passports": listMeta("traveler.passports", "Passports", true, passportCodeSchema, upper),
  "traveler.dietaryRestrictions": listMeta(
    "traveler.dietaryRestrictions",
    "Dietary restrictions",
    true,
    textValueSchema,
  ),
  "traveler.accessibilityNeeds": listMeta(
    "traveler.accessibilityNeeds",
    "Accessibility needs",
    true,
    textValueSchema,
  ),
  "preferences.companions": listMeta("preferences.companions", "Companions", false, companionSchema, asIs),
  "preferences.interests": listMeta("preferences.interests", "Interests", false, textValueSchema),
  "preferences.avoid": listMeta("preferences.avoid", "Avoid", false, textValueSchema),
  "preferences.dietaryPreferences": listMeta(
    "preferences.dietaryPreferences",
    "Food preferences",
    false,
    textValueSchema,
  ),
  "preferences.climate": listMeta("preferences.climate", "Climate", false, climateSchema, asIs),
  "preferences.accommodation": listMeta(
    "preferences.accommodation",
    "Accommodation",
    false,
    accommodationSchema,
    asIs,
  ),
};

export const FIELD_META: Record<FieldPath, FieldPathMeta> = {
  "traveler.homeBase": fieldMeta(
    "traveler.homeBase",
    "Home base",
    true,
    homeBaseSchema,
    (raw) => {
      if (raw && typeof raw === "object" && "country" in raw) {
        const hb = raw as { city?: unknown; country: unknown };
        return {
          city: typeof hb.city === "string" && hb.city.trim() ? normalizeText(hb.city) : null,
          country: typeof hb.country === "string" ? normalizeText(hb.country) : hb.country,
        };
      }
      return raw;
    },
    (value) => {
      const hb = value as HomeBase;
      return normalizeKey(`${hb.city ?? ""}|${hb.country}`);
    },
  ),
  "preferences.budgetTier": fieldMeta("preferences.budgetTier", "Budget", false, budgetTierSchema),
  "preferences.pace": fieldMeta("preferences.pace", "Pace", false, paceSchema),
  "preferences.travelMonths": fieldMeta(
    "preferences.travelMonths",
    "Travel months",
    false,
    z.array(monthSchema).min(1),
    (raw) => (Array.isArray(raw) ? [...new Set(raw)].sort((a, b) => a - b) : raw),
    (value) => (value as number[]).join(","),
  ),
  "preferences.tripLength": fieldMeta("preferences.tripLength", "Trip length", false, tripLengthSchema),
};

export function isListPath(path: string): path is ListPath {
  return (LIST_PATHS as readonly string[]).includes(path);
}

export function isFieldPath(path: string): path is FieldPath {
  return (FIELD_PATHS as readonly string[]).includes(path);
}
