import type { HomeBase, Place, UserProfile } from "./schema";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ENUM_LABELS: Record<string, string> = {
  solo: "Solo",
  partner: "Partner",
  friends: "Friends",
  "family-with-kids": "Family with kids",
  "family-adults": "Family (adults)",
  "group-tour": "Group tour",
  budget: "Budget",
  midRange: "Mid-range",
  luxury: "Luxury",
  relaxed: "Relaxed",
  balanced: "Balanced",
  packed: "Packed",
  hot: "Hot",
  warm: "Warm",
  mild: "Mild",
  cold: "Cold",
  weekend: "Weekend",
  "1-week": "1 week",
  "2-weeks": "2 weeks",
  extended: "Extended",
  hostel: "Hostel",
  "budget-hotel": "Budget hotel",
  boutique: "Boutique",
  "luxury-hotel": "Luxury hotel",
  rental: "Rental",
  resort: "Resort",
  camping: "Camping",
};

/** Human label for an enum value; free text is capitalized. */
export function labelFor(value: string): string {
  return ENUM_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function passportLabel(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function homeBaseLabel(hb: HomeBase): string {
  return hb.city ? `${hb.city}, ${hb.country}` : hb.country;
}

/** [3,4,5,9,10,11] -> "Mar–May, Sep–Nov"; wraps across the year end ([11,12,1] -> "Nov–Jan"). */
export function monthRangesLabel(months: readonly number[]): string {
  const sorted = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 12) return "Year-round";

  const groups: number[][] = [];
  for (const m of sorted) {
    const last = groups.at(-1);
    if (last && m === last[last.length - 1] + 1) last.push(m);
    else groups.push([m]);
  }
  if (groups.length > 1 && groups[0][0] === 1 && groups.at(-1)!.at(-1) === 12) {
    groups[0] = [...groups.pop()!, ...groups[0]];
  }
  return groups
    .map((g) => (g.length === 1 ? MONTHS[g[0] - 1] : `${MONTHS[g[0] - 1]}–${MONTHS[g[g.length - 1] - 1]}`))
    .join(", ");
}

export function placeLabel(place: Place): string {
  return [place.name, place.status, place.sentiment].filter(Boolean).join(" · ");
}

/**
 * Keys of everything that was added or changed between two profiles:
 * list item ids, place ids, and "field:<path>" for single-value fields.
 */
export function changedKeys(prev: UserProfile, next: UserProfile): string[] {
  const keys: string[] = [];
  for (const section of ["traveler", "preferences"] as const) {
    const before = prev[section] as Record<string, unknown>;
    const after = next[section] as Record<string, unknown>;
    for (const [key, value] of Object.entries(after)) {
      if (Array.isArray(value)) {
        const old = (before[key] as { id: string; value: unknown; source: string }[] | null) ?? [];
        for (const item of value as { id: string; value: unknown; source: string }[]) {
          const match = old.find((o) => o.id === item.id);
          if (!match || match.source !== item.source) keys.push(item.id);
        }
      } else if (value && JSON.stringify(value) !== JSON.stringify(before[key])) {
        keys.push(`field:${section}.${key}`);
      }
    }
  }
  for (const place of next.places) {
    const old = prev.places.find((p) => p.id === place.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(place)) keys.push(place.id);
  }
  return keys;
}
