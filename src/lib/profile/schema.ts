import { z } from "zod";

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

export const SOURCES = ["stated", "inferred"] as const;
export const COMPANIONS = [
  "solo",
  "partner",
  "friends",
  "family-with-kids",
  "family-adults",
  "group-tour",
] as const;
export const BUDGET_TIERS = ["budget", "midRange", "luxury"] as const;
export const PACES = ["relaxed", "balanced", "packed"] as const;
export const CLIMATES = ["hot", "warm", "mild", "cold"] as const;
export const TRIP_LENGTHS = ["weekend", "1-week", "2-weeks", "extended"] as const;
export const ACCOMMODATIONS = [
  "hostel",
  "budget-hotel",
  "boutique",
  "luxury-hotel",
  "rental",
  "resort",
  "camping",
] as const;
export const PLACE_STATUSES = ["visited", "wishlist"] as const;
export const SENTIMENTS = ["loved", "liked", "neutral", "disliked"] as const;

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const sourceSchema = z.enum(SOURCES);
export const monthSchema = z.number().int().min(1).max(12);
export const companionSchema = z.enum(COMPANIONS);
export const budgetTierSchema = z.enum(BUDGET_TIERS);
export const paceSchema = z.enum(PACES);
export const climateSchema = z.enum(CLIMATES);
export const tripLengthSchema = z.enum(TRIP_LENGTHS);
export const accommodationSchema = z.enum(ACCOMMODATIONS);
export const textValueSchema = z.string().min(1).max(120);
export const passportCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Use an ISO 3166-1 alpha-2 country code, e.g. US");
export const homeBaseSchema = z.object({
  city: textValueSchema.nullable(),
  country: textValueSchema,
});

/** A list entry. `null` list = not asked yet; `[]` = asked, none. */
function item<T extends z.ZodType>(value: T) {
  return z.object({ id: z.string().min(1), value, source: sourceSchema });
}
function list<T extends z.ZodType>(value: T) {
  return z.array(item(value)).nullable();
}
/** A single-value field. `null` = not asked yet. */
function field<T extends z.ZodType>(value: T) {
  return z.object({ value, source: sourceSchema }).nullable();
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const placeSchema = z.object({
  id: z.string().min(1),
  name: textValueSchema,
  destinationId: z.string().nullable(),
  status: z.enum(PLACE_STATUSES),
  sentiment: z.enum(SENTIMENTS).nullable(),
  months: z.array(monthSchema).nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  highlights: z.array(textValueSchema),
  lowlights: z.array(textValueSchema),
  source: sourceSchema,
});

export const rejectionSchema = z.object({
  path: z.string(),
  /** Normalized (lowercased) value the user rejected. */
  value: z.string(),
});

export const profileSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  /** Hard constraints: only ever `stated`. */
  traveler: z.object({
    homeBase: field(homeBaseSchema),
    passports: list(passportCodeSchema),
    dietaryRestrictions: list(textValueSchema),
    accessibilityNeeds: list(textValueSchema),
  }),
  /** Soft preferences: may be `inferred`. */
  preferences: z.object({
    companions: list(companionSchema),
    budgetTier: field(budgetTierSchema),
    pace: field(paceSchema),
    travelMonths: field(z.array(monthSchema).min(1)),
    interests: list(textValueSchema),
    avoid: list(textValueSchema),
    dietaryPreferences: list(textValueSchema),
    climate: list(climateSchema),
    tripLength: field(tripLengthSchema),
    accommodation: list(accommodationSchema),
  }),
  places: z.array(placeSchema),
  rejected: z.array(rejectionSchema),
});

export type UserProfile = z.infer<typeof profileSchema>;
export type Place = z.infer<typeof placeSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type HomeBase = z.infer<typeof homeBaseSchema>;
export type Rejection = z.infer<typeof rejectionSchema>;

export interface ListItem<T = string> {
  id: string;
  value: T;
  source: Source;
}
export interface FieldValue<T = unknown> {
  value: T;
  source: Source;
}

export function createEmptyProfile(now: Date = new Date()): UserProfile {
  return {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    traveler: {
      homeBase: null,
      passports: null,
      dietaryRestrictions: null,
      accessibilityNeeds: null,
    },
    preferences: {
      companions: null,
      budgetTier: null,
      pace: null,
      travelMonths: null,
      interests: null,
      avoid: null,
      dietaryPreferences: null,
      climate: null,
      tripLength: null,
      accommodation: null,
    },
    places: [],
    rejected: [],
  };
}
