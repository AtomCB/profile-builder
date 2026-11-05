import type { Completeness } from "@/lib/profile/completeness";

/** One question per essential, used to resume an incomplete profile. */
export const ESSENTIAL_QUESTIONS: Record<string, string> = {
  homeBase: "where are you based?",
  passports: "which passport or passports do you travel on?",
  companions: "who do you usually travel with?",
  dietaryRestrictions: "do you have any dietary restrictions or accessibility needs I should keep in mind?",
  accessibilityNeeds: "do you have any accessibility needs I should keep in mind?",
  travelMonths: "what time of year do you like to travel?",
  budgetTier: "what kind of budget do you usually travel on: budget, mid-range or luxury?",
  pace: "do you prefer a relaxed pace, a balanced mix, or packing in as much as possible?",
  interests: "what do you most enjoy doing when you travel?",
};

export const BLANK_OPENING =
  "Hi! I'll build your travel profile through a short conversation. Everything I learn shows up in the ledger on the right, and you can remove anything that's off.\n\nTo start: where are you based, and which passport or passports do you travel on?";

/**
 * The fixed first message shown on page load (no LLM call).
 * - blank profile, no history: welcome + first question
 * - incomplete: welcome back + question for the first missing essential
 * - complete: welcome back + invitation to update
 */
export function buildOpening(completeness: Completeness, hasHistory: boolean): string {
  if (completeness.status === "complete") {
    return "Welcome back! Your travel profile is complete. Tell me if anything has changed, or remove anything that's off in the ledger.";
  }
  if (completeness.status === "blank" && !hasHistory) return BLANK_OPENING;

  const next = completeness.missing[0];
  const question = (next && ESSENTIAL_QUESTIONS[next]) ?? ESSENTIAL_QUESTIONS.homeBase;
  return `Welcome back! Let's pick up where we left off: ${question}`;
}
