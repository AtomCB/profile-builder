import { describe, expect, it } from "vitest";
import { changedKeys, labelFor, monthRangesLabel, passportLabel } from "./format";
import { applyOps } from "./reducer";
import { createEmptyProfile } from "./schema";

describe("monthRangesLabel", () => {
  it.each([
    [[3, 4, 5, 9, 10, 11], "Mar–May, Sep–Nov"],
    [[6], "Jun"],
    [[11, 12, 1, 2], "Nov–Feb"],
    [[1, 3], "Jan, Mar"],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "Year-round"],
    [[], ""],
  ])("%j -> %s", (months, label) => {
    expect(monthRangesLabel(months)).toBe(label);
  });
});

describe("labels", () => {
  it("formats enums, free text and passports", () => {
    expect(labelFor("midRange")).toBe("Mid-range");
    expect(labelFor("family-with-kids")).toBe("Family with kids");
    expect(labelFor("street food")).toBe("Street food");
    expect(passportLabel("CA")).toBe("Canada");
  });
});

describe("changedKeys", () => {
  it("reports new items, changed fields, upgraded sources and places", () => {
    let n = 0;
    const newId = () => `id${++n}`;
    const a = applyOps(createEmptyProfile(), [
      { op: "add", path: "preferences.interests", value: "food", source: "inferred" },
    ], { newId }).profile;
    const b = applyOps(a, [
      { op: "add", path: "preferences.interests", value: "food", source: "stated" },
      { op: "add", path: "preferences.interests", value: "art", source: "stated" },
      { op: "set", path: "preferences.pace", value: "relaxed", source: "stated" },
      { op: "upsertPlace", place: { name: "Kyoto", status: "visited" } },
    ], { newId }).profile;
    expect(changedKeys(a, b).sort()).toEqual(["field:preferences.pace", "id1", "id2", "id3"].sort());
    expect(changedKeys(b, b)).toEqual([]);
  });
});
