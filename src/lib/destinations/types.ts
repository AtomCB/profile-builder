import type { COMPANIONS } from "@/lib/profile/schema";

export const SUPPORTED_PASSPORTS = ["US", "GB", "CA", "AU", "IN", "DE"] as const;
export type SupportedPassport = (typeof SUPPORTED_PASSPORTS)[number];

/**
 * Shared vocabulary between DestinationInfo.knownFor and profile interests,
 * so the agent can map one onto the other.
 */
export const INTEREST_TAGS = [
  "food",
  "street food",
  "wine",
  "markets",
  "shopping",
  "history",
  "architecture",
  "art",
  "museums",
  "temples",
  "gardens",
  "culture",
  "festivals",
  "nightlife",
  "nature",
  "hiking",
  "beaches",
  "wildlife",
  "adventure",
  "scenic drives",
  "wellness",
  "photography",
] as const;
export type InterestTag = (typeof INTEREST_TAGS)[number];

export type VisaType = "visa-free" | "e-visa" | "visa-on-arrival" | "visa-required";

export interface VisaRule {
  type: VisaType;
  maxStayDays?: number;
  note?: string;
}

export interface DestinationInfo {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  countryName: string;
  aliases: string[];
  bestMonths: number[];
  climateSummary: string;
  knownFor: InterestTag[];
  goodFor: (typeof COMPANIONS)[number][];
  /** Per person, per day, including lodging. */
  averageDailyCostUSD: { budget: number; midRange: number; luxury: number };
  visa: {
    byPassport: Record<SupportedPassport, VisaRule>;
    /** For passports not in SUPPORTED_PASSPORTS. */
    defaultNote: string;
  };
  cuisine: string[];
  dietaryNotes: string;
  accessibilityNotes: string;
  watchOutFor: string[];
}
