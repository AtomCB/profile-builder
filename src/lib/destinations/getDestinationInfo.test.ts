import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "./data";
import { getDestinationInfo, listDestinationNames, normalizeDestinationName } from "./getDestinationInfo";
import { INTEREST_TAGS, SUPPORTED_PASSPORTS } from "./types";

describe("getDestinationInfo", () => {
  it.each([
    ["Kyoto", "kyoto"],
    ["kyoto", "kyoto"],
    ["  KYOTO  ", "kyoto"],
    ["Kyōto", "kyoto"],
    ["Kyoto, Japan", "kyoto"],
    ["kyoto japan", "kyoto"],
    ["Lisboa", "lisbon"],
    ["Marrakesh", "marrakech"],
    ["Reykjavik", "reykjavik"],
    ["Reykjavík, Iceland", "reykjavik"],
    ["cape-town!", "cape-town"],
    ["Capetown", "cape-town"],
    ["Cape Town, South Africa", "cape-town"],
  ])("matches %j", (input, id) => {
    expect(getDestinationInfo(input)?.id).toBe(id);
  });

  it.each(["Bangkok", "Japan", "Tokyo", "", "   ", "Kyoto Prefecture tour"])(
    "returns null for %j",
    (input) => {
      expect(getDestinationInfo(input)).toBeNull();
    },
  );

  it("returns a copy so callers can't mutate the data", () => {
    const a = getDestinationInfo("Kyoto")!;
    a.knownFor.push("nightlife");
    expect(getDestinationInfo("Kyoto")!.knownFor).not.toContain("nightlife");
  });

  it("lists display names", () => {
    expect(listDestinationNames()).toContain("Kyoto, Japan");
    expect(listDestinationNames()).toHaveLength(5);
  });
});

describe("normalizeDestinationName", () => {
  it("strips accents, punctuation and extra spaces", () => {
    expect(normalizeDestinationName("  Reykjavík!!  City ")).toBe("reykjavik city");
  });
});

describe("destination data", () => {
  it("has exactly 5 destinations with unique ids and names", () => {
    expect(DESTINATIONS).toHaveLength(5);
    expect(new Set(DESTINATIONS.map((d) => d.id)).size).toBe(5);
  });

  it("has no alias that collides with another destination", () => {
    const seen = new Map<string, string>();
    for (const d of DESTINATIONS) {
      for (const n of [d.name, ...d.aliases]) {
        const key = normalizeDestinationName(n);
        expect(seen.get(key) ?? d.id).toBe(d.id);
        seen.set(key, d.id);
      }
    }
  });

  it.each(DESTINATIONS.map((d) => [d.id, d] as const))("%s is well-formed", (_id, d) => {
    expect(d.bestMonths.length).toBeGreaterThan(0);
    expect(d.bestMonths.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)).toBe(true);
    for (const tag of d.knownFor) expect(INTEREST_TAGS).toContain(tag);
    for (const p of SUPPORTED_PASSPORTS) expect(d.visa.byPassport[p]).toBeDefined();
    const c = d.averageDailyCostUSD;
    expect(c.budget).toBeLessThan(c.midRange);
    expect(c.midRange).toBeLessThan(c.luxury);
    expect(d.country).toMatch(/^[A-Z]{2}$/);
  });
});
