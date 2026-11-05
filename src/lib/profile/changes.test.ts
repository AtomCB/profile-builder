import { describe, expect, it } from "vitest";
import { describeChanges } from "./changes";
import type { ProfileOp } from "./ops";
import { applyOps } from "./reducer";
import { createEmptyProfile, type UserProfile } from "./schema";

const apply = (p: UserProfile, ops: ProfileOp[]) => applyOps(p, ops).profile;

describe("describeChanges", () => {
  it("reports nothing when nothing changed", () => {
    const p = createEmptyProfile();
    expect(describeChanges(p, p)).toEqual([]);
  });

  it("describes added fields, list items, 'none' and places with display labels", () => {
    const before = createEmptyProfile();
    const after = apply(before, [
      { op: "set", path: "traveler.homeBase", value: { city: "Seattle", country: "United States" }, source: "stated" },
      { op: "add", path: "traveler.passports", value: "US", source: "stated" },
      { op: "markNone", path: "traveler.dietaryRestrictions" },
      { op: "add", path: "preferences.budgetTier", value: "midRange", source: "stated" },
      { op: "add", path: "preferences.budgetTier", value: "luxury", source: "stated" },
      { op: "add", path: "preferences.interests", value: "temples", source: "inferred" },
      { op: "set", path: "preferences.travelMonths", value: [3, 4, 5], source: "stated" },
      { op: "upsertPlace", place: { name: "Kyoto", status: "visited", sentiment: "loved" } },
    ]);
    expect(describeChanges(before, after)).toEqual([
      { kind: "added", field: "Home base", value: "Seattle, United States", inferred: false },
      { kind: "added", field: "Travel months", value: "Mar–May", inferred: false },
      { kind: "added", field: "Passports", value: "United States", inferred: false },
      { kind: "added", field: "Dietary restrictions", value: "None" },
      { kind: "added", field: "Budget", value: "Mid-range", inferred: false },
      { kind: "added", field: "Budget", value: "Luxury", inferred: false },
      { kind: "added", field: "Interests", value: "Temples", inferred: true },
      { kind: "added", field: "Places", value: "Kyoto (visited, loved)", inferred: false },
    ]);
  });

  it("describes removals, updates and confirmations", () => {
    const before = apply(createEmptyProfile(), [
      { op: "set", path: "preferences.pace", value: "relaxed", source: "stated" },
      { op: "add", path: "preferences.interests", value: "food", source: "inferred" },
      { op: "add", path: "preferences.interests", value: "art", source: "stated" },
    ]);
    const after = apply(before, [
      { op: "set", path: "preferences.pace", value: "packed", source: "stated" },
      { op: "confirm", path: "preferences.interests", value: "food" },
      { op: "remove", path: "preferences.interests", value: "art" },
    ]);
    expect(describeChanges(before, after)).toEqual([
      { kind: "updated", field: "Pace", value: "Packed", inferred: false },
      { kind: "confirmed", field: "Interests", value: "Food" },
      { kind: "removed", field: "Interests", value: "Art" },
    ]);
  });
});
