import { DESTINATIONS } from "./data";
import type { DestinationInfo } from "./types";

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeDestinationName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const index = new Map<string, DestinationInfo>();
for (const d of DESTINATIONS) {
  for (const n of [d.name, ...d.aliases]) index.set(normalizeDestinationName(n), d);
}

/** Candidate keys for an input: as-is, before a comma, and without a trailing country name. */
function candidates(input: string): string[] {
  const keys = new Set<string>();
  const full = normalizeDestinationName(input);
  if (full) keys.add(full);

  const beforeComma = normalizeDestinationName(input.split(",")[0] ?? "");
  if (beforeComma) keys.add(beforeComma);

  for (const d of DESTINATIONS) {
    const country = normalizeDestinationName(d.countryName);
    for (const key of [...keys]) {
      if (key.endsWith(` ${country}`)) keys.add(key.slice(0, -country.length - 1).trim());
    }
  }
  return [...keys];
}

/**
 * Looks up hardcoded info for a destination. Returns null for anything that
 * isn't one of the known destinations (including country names on their own).
 */
export function getDestinationInfo(name: string): DestinationInfo | null {
  for (const key of candidates(name)) {
    const match = index.get(key);
    if (match) return structuredClone(match);
  }
  return null;
}

/** Display names of all known destinations, for the system prompt. */
export function listDestinationNames(): string[] {
  return DESTINATIONS.map((d) => `${d.name}, ${d.countryName}`);
}
