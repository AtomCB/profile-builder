"use client";

import type { ReactNode } from "react";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import type { Completeness } from "@/lib/profile/completeness";
import { homeBaseLabel, labelFor, monthRangesLabel, passportLabel, placeLabel } from "@/lib/profile/format";
import type { RejectOp } from "@/lib/profile/ops";
import { FIELD_META, isFieldPath, LIST_META, type ValuePath } from "@/lib/profile/paths";
import type { FieldValue, HomeBase, ListItem, UserProfile } from "@/lib/profile/schema";

export type RejectHandler = (op: RejectOp, label: string) => void;

interface SectionDef {
  title: string;
  tone: ChipTone;
  rows: ValuePath[];
  /** Essential keys counted in the header, if any. */
  essentials?: string[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "Constraints · hard",
    tone: "constraint",
    rows: ["traveler.homeBase", "traveler.passports", "traveler.dietaryRestrictions", "traveler.accessibilityNeeds"],
    essentials: ["homeBase", "passports", "dietaryRestrictions", "accessibilityNeeds"],
  },
  {
    title: "Preferences · soft",
    tone: "pref",
    rows: [
      "preferences.companions",
      "preferences.budgetTier",
      "preferences.travelMonths",
      "preferences.pace",
      "preferences.interests",
    ],
    essentials: ["companions", "budgetTier", "travelMonths", "pace", "interests"],
  },
  {
    title: "Optional",
    tone: "optional",
    rows: [
      "preferences.avoid",
      "preferences.dietaryPreferences",
      "preferences.climate",
      "preferences.tripLength",
      "preferences.accommodation",
    ],
  },
];

const SECTION_STYLES: Record<ChipTone, { text: string; border: string; mark: string; count: string }> = {
  constraint: {
    text: "text-constraint-fg",
    border: "border-constraint-mark",
    mark: "bg-constraint-mark",
    count: "bg-constraint-bg text-constraint-fg",
  },
  pref: { text: "text-pref-fg", border: "border-pref-mark", mark: "bg-pref-mark", count: "bg-pref-bg text-pref-fg" },
  optional: {
    text: "text-optional-fg",
    border: "border-optional-mark",
    mark: "bg-optional-mark",
    count: "bg-optional-bg text-optional-fg",
  },
  place: { text: "text-place-fg", border: "border-place-mark", mark: "bg-place-mark", count: "bg-place-bg text-place-fg" },
};

interface ProfilePanelProps {
  profile: UserProfile;
  completeness: Completeness;
  highlighted: Set<string>;
  onReject: RejectHandler;
}

export function ProfilePanel({ profile, completeness, highlighted, onReject }: ProfilePanelProps) {
  const missing = new Set(completeness.missing);

  return (
    <aside aria-label="Travel profile" className="w-[440px] flex-none overflow-y-auto border-l border-line bg-surface px-7 pt-3 pb-6">
      <div className="flex items-center gap-2.5 pt-1.5 text-xs text-muted">
        <span className="inline-flex h-[22px] items-center rounded-md bg-pref-bg px-2 text-pref-fg">stated</span>
        <span className="inline-flex h-[22px] items-center rounded-md border-[1.5px] border-dashed border-inferred-border bg-inferred-bg px-2 text-inferred-fg">
          inferred
        </span>
        <span>✕ removes any item</span>
      </div>

      {SECTIONS.map((section) => {
        const done = section.essentials?.filter((k) => !missing.has(k)).length;
        return (
          <Section
            key={section.title}
            title={section.title}
            tone={section.tone}
            count={section.essentials ? `${done}/${section.essentials.length}` : undefined}
          >
            {section.rows.map((path) => (
              <Row key={path} label={isFieldPath(path) ? FIELD_META[path].label : LIST_META[path].label}>
                <RowValue path={path} profile={profile} tone={section.tone} highlighted={highlighted} onReject={onReject} />
              </Row>
            ))}
          </Section>
        );
      })}

      <Section title="Places" tone="place" count={profile.places.length ? String(profile.places.length) : undefined}>
        <div className="flex flex-wrap gap-1.5 py-2">
          {profile.places.length === 0 ? (
            <Empty>No places yet. Mention trips you&apos;ve taken or want to take.</Empty>
          ) : (
            profile.places.map((place) => {
              const label = placeLabel(place);
              return (
                <Chip
                  key={place.id}
                  tone="place"
                  label={label}
                  inferred={place.source === "inferred"}
                  note={place.destinationId ? undefined : "no data"}
                  highlighted={highlighted.has(place.id)}
                  onRemove={() => onReject({ op: "reject", path: "places", id: place.id }, place.name)}
                  removeLabel={`Remove ${place.name}`}
                />
              );
            })
          )}
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, tone, count, children }: { title: string; tone: ChipTone; count?: string; children: ReactNode }) {
  const s = SECTION_STYLES[tone];
  return (
    <section>
      <h2
        className={cx(
          "flex items-center justify-between border-b-2 pt-4 pb-2 font-mono text-[11px] font-medium tracking-[0.1em] uppercase",
          s.text,
          s.border,
        )}
      >
        <span className="flex items-center">
          <i aria-hidden="true" className={cx("mr-2 inline-block h-2 w-2 rounded-[2px]", s.mark)} />
          {title}
        </span>
        {count && <span className={cx("rounded-full px-2", s.count)}>{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-line-soft py-1.5">
      <div className="w-[140px] flex-none pt-1 text-[13px] text-muted">{label}</div>
      <div className="flex flex-1 flex-wrap justify-end gap-1.5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="pt-1 text-[13px] text-subtle italic">{children}</span>;
}

function fieldLabel(path: ValuePath, value: unknown): string {
  if (path === "traveler.homeBase") return homeBaseLabel(value as HomeBase);
  if (path === "preferences.travelMonths") return monthRangesLabel(value as number[]);
  return labelFor(String(value));
}

function itemLabel(path: ValuePath, value: string): string {
  return path === "traveler.passports" ? passportLabel(value) : labelFor(value);
}

function RowValue({
  path,
  profile,
  tone,
  highlighted,
  onReject,
}: {
  path: ValuePath;
  profile: UserProfile;
  tone: ChipTone;
  highlighted: Set<string>;
  onReject: RejectHandler;
}) {
  if (isFieldPath(path)) {
    const { section, key } = FIELD_META[path];
    const field = (profile[section] as Record<string, unknown>)[key] as FieldValue | null;
    if (!field) return <Empty>Not asked yet</Empty>;
    const label = fieldLabel(path, field.value);
    return (
      <Chip
        tone={tone}
        label={label}
        inferred={field.source === "inferred"}
        highlighted={highlighted.has(`field:${path}`)}
        onRemove={() => onReject({ op: "reject", path }, label)}
        removeLabel={`Remove ${FIELD_META[path].label}: ${label}`}
      />
    );
  }

  const { section, key } = LIST_META[path];
  const items = (profile[section] as Record<string, unknown>)[key] as ListItem[] | null;
  if (items === null) return <Empty>Not asked yet</Empty>;
  if (items.length === 0) return <span className="pt-1 text-[13px] text-ink">None</span>;
  return (
    <>
      {items.map((item) => {
        const label = itemLabel(path, item.value);
        return (
          <Chip
            key={item.id}
            tone={tone}
            label={label}
            inferred={item.source === "inferred"}
            highlighted={highlighted.has(item.id)}
            onRemove={() => onReject({ op: "reject", path, id: item.id }, label)}
            removeLabel={`Remove ${label}`}
          />
        );
      })}
    </>
  );
}
