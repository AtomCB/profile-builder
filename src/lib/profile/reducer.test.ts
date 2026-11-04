import { beforeEach, describe, expect, it } from "vitest";
import type { ProfileOp } from "./ops";
import { applyOps } from "./reducer";
import { createEmptyProfile, profileSchema, type UserProfile } from "./schema";

const NOW = new Date("2026-11-04T12:00:00Z");
let seq = 0;
const opts = { now: () => NOW, newId: () => `id${++seq}` };

function apply(profile: UserProfile, ...ops: ProfileOp[]) {
  const result = applyOps(profile, ops, opts);
  // Whatever the reducer produces must always be a valid stored profile.
  expect(profileSchema.safeParse(result.profile).success).toBe(true);
  return result;
}

let empty: UserProfile;
beforeEach(() => {
  seq = 0;
  empty = createEmptyProfile(new Date("2026-01-01T00:00:00Z"));
});

describe("list ops", () => {
  it("adds to a null list, creating it", () => {
    const { profile, results } = apply(empty, {
      op: "add",
      path: "preferences.interests",
      value: "  hiking ",
      source: "stated",
    });
    expect(results[0].ok).toBe(true);
    expect(profile.preferences.interests).toEqual([{ id: "id1", value: "hiking", source: "stated" }]);
  });

  it("merges duplicates case-insensitively and upgrades inferred to stated", () => {
    let { profile } = apply(empty, { op: "add", path: "preferences.interests", value: "Food", source: "inferred" });
    ({ profile } = apply(profile, { op: "add", path: "preferences.interests", value: "food", source: "stated" }));
    expect(profile.preferences.interests).toEqual([{ id: "id1", value: "Food", source: "stated" }]);
  });

  it("does not downgrade stated to inferred on duplicate add", () => {
    let { profile } = apply(empty, { op: "add", path: "preferences.interests", value: "food", source: "stated" });
    ({ profile } = apply(profile, { op: "add", path: "preferences.interests", value: "Food", source: "inferred" }));
    expect(profile.preferences.interests?.[0].source).toBe("stated");
  });

  it("normalizes passports to uppercase and rejects invalid codes", () => {
    const { profile, results } = apply(
      empty,
      { op: "add", path: "traveler.passports", value: "ca", source: "stated" },
      { op: "add", path: "traveler.passports", value: "Canada", source: "stated" },
    );
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(profile.traveler.passports?.map((i) => i.value)).toEqual(["CA"]);
  });

  it("rejects values outside an enum list", () => {
    const { results, changed } = apply(empty, {
      op: "add",
      path: "preferences.companions",
      value: "pets",
      source: "stated",
    });
    expect(results[0].ok).toBe(false);
    expect(changed).toBe(false);
  });

  it("markNone sets an empty list (asked, none)", () => {
    const { profile } = apply(empty, { op: "markNone", path: "traveler.dietaryRestrictions" });
    expect(profile.traveler.dietaryRestrictions).toEqual([]);
  });

  it("removes by value or id, and errors when not found", () => {
    let { profile } = apply(
      empty,
      { op: "add", path: "preferences.avoid", value: "crowds", source: "stated" },
      { op: "add", path: "preferences.avoid", value: "heat", source: "stated" },
    );
    const r = apply(
      profile,
      { op: "remove", path: "preferences.avoid", value: "CROWDS" },
      { op: "remove", path: "preferences.avoid", id: "id2" },
      { op: "remove", path: "preferences.avoid", value: "snow" },
    );
    expect(r.results.map((x) => x.ok)).toEqual([true, true, false]);
    expect(r.profile.preferences.avoid).toEqual([]);
  });

  it("clear resets a list to not asked", () => {
    let { profile } = apply(empty, { op: "markNone", path: "traveler.accessibilityNeeds" });
    ({ profile } = apply(profile, { op: "clear", path: "traveler.accessibilityNeeds" }));
    expect(profile.traveler.accessibilityNeeds).toBeNull();
  });
});

describe("hard constraints", () => {
  it("refuses inferred values on traveler paths", () => {
    const { results, changed, profile } = apply(
      empty,
      { op: "add", path: "traveler.dietaryRestrictions", value: "vegan", source: "inferred" },
      { op: "set", path: "traveler.homeBase", value: { city: "Toronto", country: "Canada" }, source: "inferred" },
    );
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(changed).toBe(false);
    expect(profile).toBe(empty);
  });

  it("accepts stated values on traveler paths", () => {
    const { profile } = apply(empty, {
      op: "set",
      path: "traveler.homeBase",
      value: { city: " Toronto ", country: "Canada" },
      source: "stated",
    });
    expect(profile.traveler.homeBase).toEqual({ value: { city: "Toronto", country: "Canada" }, source: "stated" });
  });
});

describe("field ops", () => {
  it("validates enum fields", () => {
    const ok = apply(empty, { op: "set", path: "preferences.budgetTier", value: "midRange", source: "inferred" });
    expect(ok.profile.preferences.budgetTier).toEqual({ value: "midRange", source: "inferred" });
    const bad = apply(empty, { op: "set", path: "preferences.budgetTier", value: "cheap", source: "stated" });
    expect(bad.results[0].ok).toBe(false);
  });

  it("dedupes and sorts travel months, rejecting invalid months", () => {
    const ok = apply(empty, { op: "set", path: "preferences.travelMonths", value: [10, 4, 3, 4], source: "stated" });
    expect(ok.profile.preferences.travelMonths?.value).toEqual([3, 4, 10]);
    const bad = apply(empty, { op: "set", path: "preferences.travelMonths", value: [13], source: "stated" });
    expect(bad.results[0].ok).toBe(false);
  });

  it("confirm marks an inferred field or item as stated", () => {
    let { profile } = apply(
      empty,
      { op: "set", path: "preferences.pace", value: "relaxed", source: "inferred" },
      { op: "add", path: "preferences.interests", value: "temples", source: "inferred" },
    );
    ({ profile } = apply(
      profile,
      { op: "confirm", path: "preferences.pace" },
      { op: "confirm", path: "preferences.interests", value: "Temples" },
    ));
    expect(profile.preferences.pace?.source).toBe("stated");
    expect(profile.preferences.interests?.[0].source).toBe("stated");
  });
});

describe("rejections", () => {
  it("reject removes a list item, remembers it, and blocks re-inference", () => {
    let { profile } = apply(empty, { op: "add", path: "preferences.interests", value: "Temples", source: "inferred" });
    ({ profile } = apply(profile, { op: "reject", path: "preferences.interests", id: "id1" }));
    expect(profile.preferences.interests).toEqual([]);
    expect(profile.rejected).toEqual([{ path: "preferences.interests", value: "temples" }]);

    const again = apply(profile, { op: "add", path: "preferences.interests", value: "temples", source: "inferred" });
    expect(again.results[0].ok).toBe(false);
  });

  it("a stated add clears the rejection", () => {
    let { profile } = apply(empty, { op: "add", path: "preferences.interests", value: "temples", source: "inferred" });
    ({ profile } = apply(profile, { op: "reject", path: "preferences.interests", id: "id1" }));
    ({ profile } = apply(profile, { op: "add", path: "preferences.interests", value: "temples", source: "stated" }));
    expect(profile.rejected).toEqual([]);
    expect(profile.preferences.interests?.[0].source).toBe("stated");
  });

  it("reject on a field resets it to null and blocks the same inferred value", () => {
    let { profile } = apply(empty, { op: "set", path: "preferences.budgetTier", value: "midRange", source: "inferred" });
    ({ profile } = apply(profile, { op: "reject", path: "preferences.budgetTier" }));
    expect(profile.preferences.budgetTier).toBeNull();
    const again = apply(profile, { op: "set", path: "preferences.budgetTier", value: "midRange", source: "inferred" });
    expect(again.results[0].ok).toBe(false);
    const other = apply(profile, { op: "set", path: "preferences.budgetTier", value: "luxury", source: "inferred" });
    expect(other.results[0].ok).toBe(true);
  });

  it("can reject stated items too", () => {
    let { profile } = apply(empty, { op: "add", path: "traveler.passports", value: "CA", source: "stated" });
    ({ profile } = apply(profile, { op: "reject", path: "traveler.passports", id: "id1" }));
    expect(profile.traveler.passports).toEqual([]);
  });
});

describe("places", () => {
  it("adds a place and requires a status for new places", () => {
    const { profile, results } = apply(
      empty,
      { op: "upsertPlace", place: { name: "Kyoto", destinationId: "kyoto", status: "visited", sentiment: "loved" } },
      { op: "upsertPlace", place: { name: "Bangkok" } },
    );
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(profile.places).toHaveLength(1);
    expect(profile.places[0]).toMatchObject({ id: "id1", name: "Kyoto", destinationId: "kyoto", source: "stated" });
  });

  it("merges into an existing place by name, unioning highlights", () => {
    let { profile } = apply(empty, {
      op: "upsertPlace",
      place: { name: "Kyoto", status: "visited", highlights: ["hiking"] },
    });
    ({ profile } = apply(profile, {
      op: "upsertPlace",
      place: { name: "kyoto", months: [4, 3], highlights: ["Hiking", "temples"] },
    }));
    expect(profile.places).toHaveLength(1);
    expect(profile.places[0].months).toEqual([3, 4]);
    expect(profile.places[0].highlights).toEqual(["hiking", "temples"]);
  });

  it("rejects a place and remembers it", () => {
    let { profile } = apply(empty, { op: "upsertPlace", place: { name: "Lisbon", status: "wishlist", source: "inferred" } });
    ({ profile } = apply(profile, { op: "reject", path: "places", id: "id1" }));
    expect(profile.places).toEqual([]);
    const again = apply(profile, { op: "upsertPlace", place: { name: "lisbon", status: "wishlist", source: "inferred" } });
    expect(again.results[0].ok).toBe(false);
  });

  it("removes a place by name", () => {
    let { profile } = apply(empty, { op: "upsertPlace", place: { name: "Reykjavík", status: "wishlist" } });
    ({ profile } = apply(profile, { op: "removePlace", name: "reykjavík" }));
    expect(profile.places).toEqual([]);
  });
});

describe("applyOps", () => {
  it("never mutates the input profile", () => {
    const before = structuredClone(empty);
    apply(empty, { op: "add", path: "preferences.interests", value: "art", source: "stated" });
    expect(empty).toEqual(before);
  });

  it("only bumps updatedAt when something changed", () => {
    const failed = apply(empty, { op: "remove", path: "preferences.avoid", value: "x" });
    expect(failed.profile.updatedAt).toBe(empty.updatedAt);
    const ok = apply(empty, { op: "markNone", path: "preferences.avoid" });
    expect(ok.profile.updatedAt).toBe(NOW.toISOString());
  });

  it("applies valid ops even when others in the batch fail", () => {
    const { profile, results } = apply(
      empty,
      { op: "add", path: "preferences.interests", value: "art", source: "stated" },
      { op: "add", path: "traveler.passports", value: "nope", source: "stated" },
      { op: "set", path: "preferences.pace", value: "packed", source: "stated" },
    );
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(profile.preferences.pace?.value).toBe("packed");
  });
});
