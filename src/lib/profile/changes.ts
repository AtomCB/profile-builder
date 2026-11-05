import { z } from "zod";
import { homeBaseLabel, labelFor, monthRangesLabel, passportLabel } from "./format";
import { FIELD_META, FIELD_PATHS, LIST_META, LIST_PATHS, normalizeKey, type FieldPath } from "./paths";
import type { FieldValue, HomeBase, ListItem, Place, UserProfile } from "./schema";

export const profileChangeSchema = z.object({
  kind: z.enum(["added", "removed", "updated", "confirmed"]),
  field: z.string(),
  value: z.string(),
  inferred: z.boolean().optional(),
});
export type ProfileChange = z.infer<typeof profileChangeSchema>;

function get<T>(p: UserProfile, section: "traveler" | "preferences", key: string): T {
  return (p[section] as unknown as Record<string, unknown>)[key] as T;
}

function fieldValueLabel(path: FieldPath, value: unknown): string {
  if (path === "traveler.homeBase") return homeBaseLabel(value as HomeBase);
  if (path === "preferences.travelMonths") return monthRangesLabel(value as number[]);
  return labelFor(String(value));
}

function placeDetail(place: Place): string {
  const extra = [place.status, place.sentiment].filter(Boolean).join(", ");
  return extra ? `${place.name} (${extra})` : place.name;
}

/**
 * Describes what changed between two profiles, in display terms. Computed by the
 * server after each turn so the summary shown to the user always matches reality.
 */
export function describeChanges(prev: UserProfile, next: UserProfile): ProfileChange[] {
  const changes: ProfileChange[] = [];

  for (const path of FIELD_PATHS) {
    const { section, key, label } = FIELD_META[path];
    const a = get<FieldValue | null>(prev, section, key);
    const b = get<FieldValue | null>(next, section, key);
    if (!a && b) changes.push({ kind: "added", field: label, value: fieldValueLabel(path, b.value), inferred: b.source === "inferred" });
    else if (a && !b) changes.push({ kind: "removed", field: label, value: fieldValueLabel(path, a.value) });
    else if (a && b) {
      const av = fieldValueLabel(path, a.value);
      const bv = fieldValueLabel(path, b.value);
      if (av !== bv) changes.push({ kind: "updated", field: label, value: bv, inferred: b.source === "inferred" });
      else if (a.source === "inferred" && b.source === "stated") changes.push({ kind: "confirmed", field: label, value: bv });
    }
  }

  for (const path of LIST_PATHS) {
    const { section, key, label } = LIST_META[path];
    const a = get<ListItem[] | null>(prev, section, key);
    const b = get<ListItem[] | null>(next, section, key);
    const show = (v: string) => (path === "traveler.passports" ? passportLabel(v) : labelFor(v));

    if (b && b.length === 0 && (a === null || a.length > 0)) {
      changes.push({ kind: "added", field: label, value: "None" });
      continue;
    }
    const before = new Map((a ?? []).map((i) => [normalizeKey(i.value), i]));
    const after = new Map((b ?? []).map((i) => [normalizeKey(i.value), i]));
    for (const [k, item] of after) {
      const old = before.get(k);
      if (!old) changes.push({ kind: "added", field: label, value: show(item.value), inferred: item.source === "inferred" });
      else if (old.source === "inferred" && item.source === "stated") {
        changes.push({ kind: "confirmed", field: label, value: show(item.value) });
      }
    }
    for (const [k, item] of before) {
      if (!after.has(k)) changes.push({ kind: "removed", field: label, value: show(item.value) });
    }
  }

  const prevPlaces = new Map(prev.places.map((p) => [p.id, p]));
  const nextIds = new Set(next.places.map((p) => p.id));
  for (const place of next.places) {
    const old = prevPlaces.get(place.id);
    if (!old) changes.push({ kind: "added", field: "Places", value: placeDetail(place), inferred: place.source === "inferred" });
    else if (JSON.stringify(old) !== JSON.stringify(place)) {
      changes.push({ kind: "updated", field: "Places", value: placeDetail(place) });
    }
  }
  for (const place of prev.places) {
    if (!nextIds.has(place.id)) changes.push({ kind: "removed", field: "Places", value: place.name });
  }

  return changes;
}
