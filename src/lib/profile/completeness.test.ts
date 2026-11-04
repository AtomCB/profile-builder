import { describe, expect, it } from "vitest";
import { getCompleteness } from "./completeness";
import { applyOps } from "./reducer";
import type { ProfileOp } from "./ops";
import { createEmptyProfile } from "./schema";

const essentials: ProfileOp[] = [
  { op: "set", path: "traveler.homeBase", value: { city: "Toronto", country: "Canada" }, source: "stated" },
  { op: "add", path: "traveler.passports", value: "CA", source: "stated" },
  { op: "add", path: "preferences.companions", value: "partner", source: "stated" },
  { op: "markNone", path: "traveler.dietaryRestrictions" },
  { op: "markNone", path: "traveler.accessibilityNeeds" },
  { op: "set", path: "preferences.travelMonths", value: [3, 4, 5], source: "stated" },
  { op: "set", path: "preferences.budgetTier", value: "midRange", source: "inferred" },
  { op: "set", path: "preferences.pace", value: "balanced", source: "stated" },
  { op: "add", path: "preferences.interests", value: "hiking", source: "stated" },
  { op: "add", path: "preferences.interests", value: "food", source: "inferred" },
  { op: "add", path: "preferences.interests", value: "temples", source: "inferred" },
];

const build = (ops: ProfileOp[]) => applyOps(createEmptyProfile(), ops).profile;

describe("getCompleteness", () => {
  it("reports a blank profile", () => {
    const c = getCompleteness(createEmptyProfile());
    expect(c).toMatchObject({ done: 0, total: 9, status: "blank" });
    expect(c.missing[0]).toBe("homeBase");
  });

  it("treats a profile with only optional data as incomplete, not blank", () => {
    const c = getCompleteness(build([{ op: "upsertPlace", place: { name: "Kyoto", status: "visited" } }]));
    expect(c).toMatchObject({ done: 0, status: "incomplete" });
  });

  it("counts asked-none lists as done, and lists missing in ask order", () => {
    const c = getCompleteness(build(essentials.slice(0, 5)));
    expect(c.done).toBe(5);
    expect(c.missing).toEqual(["travelMonths", "budgetTier", "pace", "interests"]);
    expect(c.status).toBe("incomplete");
  });

  it("needs at least 3 interests", () => {
    const c = getCompleteness(build(essentials.slice(0, -1)));
    expect(c.missing).toEqual(["interests"]);
  });

  it("reports complete, counting inferred values", () => {
    expect(getCompleteness(build(essentials))).toMatchObject({ done: 9, missing: [], status: "complete" });
  });
});
