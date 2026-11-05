import { describe, expect, it } from "vitest";
import { BLANK_OPENING, buildOpening } from "./opening";
import type { Completeness } from "./profile/completeness";

const c = (status: Completeness["status"], missing: string[]): Completeness => ({
  status,
  missing,
  done: 9 - missing.length,
  total: 9,
});

describe("buildOpening", () => {
  it("greets a brand-new user", () => {
    expect(buildOpening(c("blank", ["homeBase", "passports"]), false)).toBe(BLANK_OPENING);
  });

  it("resumes with the first missing essential", () => {
    const text = buildOpening(c("incomplete", ["travelMonths", "pace"]), true);
    expect(text).toMatch(/^Welcome back/);
    expect(text).toContain("what time of year");
  });

  it("resumes a blank profile that has history", () => {
    expect(buildOpening(c("blank", ["homeBase"]), true)).toContain("where are you based");
  });

  it("invites updates when complete", () => {
    expect(buildOpening(c("complete", []), true)).toContain("complete");
  });
});
