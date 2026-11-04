import type { UserProfile } from "./schema";

export interface Essential {
  key: string;
  label: string;
  isDone: (p: UserProfile) => boolean;
}

/** The 9 essentials, in the order the agent should ask about them. */
export const ESSENTIALS: readonly Essential[] = [
  { key: "homeBase", label: "Home base", isDone: (p) => p.traveler.homeBase !== null },
  { key: "passports", label: "Passports", isDone: (p) => (p.traveler.passports?.length ?? 0) > 0 },
  { key: "companions", label: "Companions", isDone: (p) => (p.preferences.companions?.length ?? 0) > 0 },
  {
    key: "dietaryRestrictions",
    label: "Dietary restrictions",
    isDone: (p) => p.traveler.dietaryRestrictions !== null,
  },
  {
    key: "accessibilityNeeds",
    label: "Accessibility needs",
    isDone: (p) => p.traveler.accessibilityNeeds !== null,
  },
  { key: "travelMonths", label: "Travel months", isDone: (p) => p.preferences.travelMonths !== null },
  { key: "budgetTier", label: "Budget", isDone: (p) => p.preferences.budgetTier !== null },
  { key: "pace", label: "Pace", isDone: (p) => p.preferences.pace !== null },
  { key: "interests", label: "Interests", isDone: (p) => (p.preferences.interests?.length ?? 0) >= 3 },
];

export const MIN_INTERESTS = 3;

export type ProfileStatus = "blank" | "incomplete" | "complete";

export interface Completeness {
  done: number;
  total: number;
  /** Keys of essentials still missing, in ask order. */
  missing: string[];
  status: ProfileStatus;
}

export function getCompleteness(p: UserProfile): Completeness {
  const missing = ESSENTIALS.filter((e) => !e.isDone(p)).map((e) => e.key);
  const total = ESSENTIALS.length;
  const done = total - missing.length;
  return { done, total, missing, status: getStatus(p, missing.length) };
}

function getStatus(p: UserProfile, missingCount: number): ProfileStatus {
  if (missingCount === 0) return "complete";
  return isBlank(p) ? "blank" : "incomplete";
}

/** True when nothing at all has been recorded (rejections don't count). */
export function isBlank(p: UserProfile): boolean {
  const values = [...Object.values(p.traveler), ...Object.values(p.preferences)];
  return values.every((v) => v === null) && p.places.length === 0;
}
