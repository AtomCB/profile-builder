import type { PlaceInput, ProfileOp } from "./ops";
import {
  FIELD_META,
  isFieldPath,
  isListPath,
  LIST_META,
  normalizeKey,
  normalizeText,
  type FieldPath,
  type ListPath,
  type RejectablePath,
} from "./paths";
import type { FieldValue, ListItem, Place, Source, UserProfile } from "./schema";

export type OpResult = { ok: true; op: ProfileOp } | { ok: false; op: ProfileOp; error: string };

export interface ApplyResult {
  profile: UserProfile;
  results: OpResult[];
  /** True when at least one op succeeded. */
  changed: boolean;
}

export interface ApplyOptions {
  now?: () => Date;
  newId?: () => string;
}

const MAX_TEXT = 120;

/** Thrown for an op that can't be applied; its message is returned to the caller (and the LLM). */
class OpError extends Error {}

interface Ctx {
  newId: () => string;
}

/**
 * Applies ops to a copy of the profile. Ops are applied in order and independently:
 * an invalid op is reported in `results` and skipped, the rest still apply.
 * Every handler validates before mutating, so a failed op leaves no partial change.
 */
export function applyOps(
  profile: UserProfile,
  ops: readonly ProfileOp[],
  options: ApplyOptions = {},
): ApplyResult {
  const next = structuredClone(profile);
  const ctx: Ctx = { newId: options.newId ?? (() => crypto.randomUUID()) };

  const results = ops.map((op): OpResult => {
    try {
      applyOp(next, op, ctx);
      return { ok: true, op };
    } catch (err) {
      if (err instanceof OpError) return { ok: false, op, error: err.message };
      throw err;
    }
  });

  const changed = results.some((r) => r.ok);
  if (changed) next.updatedAt = (options.now?.() ?? new Date()).toISOString();
  return { profile: changed ? next : profile, results, changed };
}

function applyOp(p: UserProfile, op: ProfileOp, ctx: Ctx): void {
  switch (op.op) {
    case "add":
      return addItem(p, op.path, op.value, op.source, ctx);
    case "remove":
      return removeItem(p, op.path, op.id, op.value);
    case "markNone":
      return setList(p, op.path, []);
    case "clear":
      return isListPath(op.path) ? setList(p, op.path, null) : setField(p, op.path, null);
    case "set":
      return setFieldValue(p, op.path, op.value, op.source);
    case "confirm":
      return confirm(p, op.path, op.id, op.value);
    case "upsertPlace":
      return upsertPlace(p, op.place, ctx);
    case "removePlace":
      return removePlace(p, op.id, op.name);
    case "reject":
      return reject(p, op.path, op.id);
  }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

function sectionOf(p: UserProfile, section: "traveler" | "preferences"): Record<string, unknown> {
  return p[section] as unknown as Record<string, unknown>;
}

function getList(p: UserProfile, path: ListPath): ListItem[] | null {
  const { section, key } = LIST_META[path];
  return sectionOf(p, section)[key] as ListItem[] | null;
}

function setList(p: UserProfile, path: ListPath, value: ListItem[] | null): void {
  const { section, key } = LIST_META[path];
  sectionOf(p, section)[key] = value;
}

function getField(p: UserProfile, path: FieldPath): FieldValue | null {
  const { section, key } = FIELD_META[path];
  return sectionOf(p, section)[key] as FieldValue | null;
}

function setField(p: UserProfile, path: FieldPath, value: FieldValue | null): void {
  const { section, key } = FIELD_META[path];
  sectionOf(p, section)[key] = value;
}

// ---------------------------------------------------------------------------
// Rejections
// ---------------------------------------------------------------------------

function isRejected(p: UserProfile, path: RejectablePath, key: string): boolean {
  return p.rejected.some((r) => r.path === path && r.value === key);
}

function recordRejection(p: UserProfile, path: RejectablePath, key: string): void {
  if (!isRejected(p, path, key)) p.rejected.push({ path, value: key });
}

function clearRejection(p: UserProfile, path: RejectablePath, key: string): void {
  p.rejected = p.rejected.filter((r) => !(r.path === path && r.value === key));
}

function guardSource(label: string, hard: boolean, source: Source): void {
  if (hard && source === "inferred") {
    throw new OpError(`${label} is a hard constraint and can only be set from what the user states.`);
  }
}

function guardRejected(p: UserProfile, path: RejectablePath, key: string, source: Source, display: string) {
  if (source === "inferred" && isRejected(p, path, key)) {
    throw new OpError(`The user rejected "${display}" for ${path}. Don't add it again unless they state it.`);
  }
  if (source === "stated") clearRejection(p, path, key);
}

// ---------------------------------------------------------------------------
// List ops
// ---------------------------------------------------------------------------

function addItem(p: UserProfile, path: ListPath, raw: string, source: Source, ctx: Ctx): void {
  const meta = LIST_META[path];
  guardSource(meta.label, meta.hard, source);

  const parsed = meta.schema.safeParse(meta.prepare(raw));
  if (!parsed.success) {
    throw new OpError(`Invalid value "${raw}" for ${path}: ${parsed.error.issues[0]?.message}`);
  }
  const value = parsed.data;
  const key = normalizeKey(value);
  guardRejected(p, path, key, source, value);

  const items = getList(p, path) ?? [];
  const existing = items.find((i) => normalizeKey(i.value) === key);
  if (existing) {
    if (source === "stated") existing.source = "stated";
  } else {
    items.push({ id: ctx.newId(), value, source });
  }
  setList(p, path, items);
}

function findItemIndex(items: ListItem[], label: string, id?: string, value?: string): number {
  if (!id && !value) throw new OpError(`Provide an id or value to identify the ${label} item.`);
  const index = id
    ? items.findIndex((i) => i.id === id)
    : items.findIndex((i) => normalizeKey(i.value) === normalizeKey(value!));
  if (index < 0) throw new OpError(`No matching item "${id ?? value}" in ${label}.`);
  return index;
}

function removeItem(p: UserProfile, path: ListPath, id?: string, value?: string): void {
  const meta = LIST_META[path];
  const items = getList(p, path);
  if (!items) throw new OpError(`${meta.label} has no items.`);
  const index = findItemIndex(items, meta.label, id, value);
  setList(p, path, items.filter((_, i) => i !== index));
}

// ---------------------------------------------------------------------------
// Field ops
// ---------------------------------------------------------------------------

function setFieldValue(p: UserProfile, path: FieldPath, raw: unknown, source: Source): void {
  const meta = FIELD_META[path];
  guardSource(meta.label, meta.hard, source);

  const parsed = meta.schema.safeParse(meta.prepare(raw));
  if (!parsed.success) {
    throw new OpError(`Invalid value for ${path}: ${parsed.error.issues[0]?.message}`);
  }
  const key = meta.serialize(parsed.data);
  guardRejected(p, path, key, source, key);
  setField(p, path, { value: parsed.data, source });
}

// ---------------------------------------------------------------------------
// Confirm / reject
// ---------------------------------------------------------------------------

function confirm(p: UserProfile, path: string, id?: string, value?: string): void {
  if (isListPath(path)) {
    const meta = LIST_META[path];
    const items = getList(p, path);
    if (!items) throw new OpError(`${meta.label} has no items.`);
    const item = items[findItemIndex(items, meta.label, id, value)];
    item.source = "stated";
    clearRejection(p, path, normalizeKey(item.value));
    return;
  }
  if (isFieldPath(path)) {
    const current = getField(p, path);
    if (!current) throw new OpError(`${FIELD_META[path].label} is not set.`);
    current.source = "stated";
    return;
  }
  throw new OpError(`Unknown path ${path}.`);
}

function reject(p: UserProfile, path: RejectablePath, id?: string): void {
  if (path === "places") {
    if (!id) throw new OpError("Provide the id of the place to reject.");
    const place = p.places.find((pl) => pl.id === id);
    if (!place) throw new OpError(`No place with id ${id}.`);
    p.places = p.places.filter((pl) => pl.id !== id);
    recordRejection(p, "places", normalizeKey(place.name));
    return;
  }
  if (isListPath(path)) {
    const meta = LIST_META[path];
    const items = getList(p, path);
    if (!items) throw new OpError(`${meta.label} has no items.`);
    if (!id) throw new OpError(`Provide the id of the ${meta.label} item to reject.`);
    const index = findItemIndex(items, meta.label, id);
    recordRejection(p, path, normalizeKey(items[index].value));
    setList(p, path, items.filter((_, i) => i !== index));
    return;
  }
  const meta = FIELD_META[path];
  const current = getField(p, path);
  if (!current) throw new OpError(`${meta.label} is not set.`);
  recordRejection(p, path, meta.serialize(current.value));
  setField(p, path, null);
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

function findPlace(p: UserProfile, id?: string, name?: string): Place | undefined {
  if (id) {
    const byId = p.places.find((pl) => pl.id === id);
    if (byId) return byId;
  }
  if (name) return p.places.find((pl) => normalizeKey(pl.name) === normalizeKey(name));
  return undefined;
}

function mergeTexts(existing: string[], incoming: string[] | undefined): string[] {
  const out = [...existing];
  for (const raw of incoming ?? []) {
    const text = normalizeText(raw);
    if (text && !out.some((e) => normalizeKey(e) === normalizeKey(text))) out.push(text);
  }
  return out;
}

function validMonths(months: number[] | null | undefined): number[] | null | undefined {
  if (months == null) return months;
  return [...new Set(months)].sort((a, b) => a - b);
}

function upsertPlace(p: UserProfile, input: PlaceInput, ctx: Ctx): void {
  const name = normalizeText(input.name);
  if (!name) throw new OpError("Place name is required.");
  if (input.year != null && (input.year < 1900 || input.year > 2100)) {
    throw new OpError(`Year ${input.year} is out of range.`);
  }
  const texts = [name, ...(input.highlights ?? []), ...(input.lowlights ?? [])];
  if (texts.some((t) => normalizeText(t).length > MAX_TEXT)) {
    throw new OpError(`Place text must be ${MAX_TEXT} characters or fewer.`);
  }
  const source: Source = input.source ?? "stated";
  const existing = findPlace(p, input.id, name);

  if (existing) {
    if (input.destinationId !== undefined) existing.destinationId = input.destinationId;
    if (input.status !== undefined) existing.status = input.status;
    if (input.sentiment !== undefined) existing.sentiment = input.sentiment;
    if (input.months !== undefined) existing.months = validMonths(input.months) ?? null;
    if (input.year !== undefined) existing.year = input.year;
    existing.highlights = mergeTexts(existing.highlights, input.highlights);
    existing.lowlights = mergeTexts(existing.lowlights, input.lowlights);
    if (source === "stated") existing.source = "stated";
    return;
  }

  if (!input.status) throw new OpError(`Status (visited or wishlist) is required to add "${name}".`);
  guardRejected(p, "places", normalizeKey(name), source, name);
  p.places.push({
    id: ctx.newId(),
    name,
    destinationId: input.destinationId ?? null,
    status: input.status,
    sentiment: input.sentiment ?? null,
    months: validMonths(input.months) ?? null,
    year: input.year ?? null,
    highlights: mergeTexts([], input.highlights),
    lowlights: mergeTexts([], input.lowlights),
    source,
  });
}

function removePlace(p: UserProfile, id?: string, name?: string): void {
  if (!id && !name) throw new OpError("Provide the id or name of the place to remove.");
  const place = findPlace(p, id, name);
  if (!place) throw new OpError(`No place matching "${id ?? name}".`);
  p.places = p.places.filter((pl) => pl.id !== place.id);
}
