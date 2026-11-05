import type { ProfileOp } from "@/lib/profile/ops";
import { applyOps, type ApplyResult } from "@/lib/profile/reducer";
import { createEmptyProfile, profileSchema, type UserProfile } from "@/lib/profile/schema";
import { getDb, transaction, type Db } from "./index";

/**
 * Loads the single user's profile. Returns an empty profile when none is stored,
 * or when the stored JSON is unreadable or fails validation (logged, not thrown).
 */
export function loadProfile(db: Db = getDb()): UserProfile {
  const row = db.prepare("SELECT json FROM profile WHERE id = 1").get() as { json: string } | undefined;
  if (!row) return createEmptyProfile();
  try {
    const parsed = profileSchema.safeParse(JSON.parse(row.json));
    if (parsed.success) return parsed.data;
    console.warn("[profile] stored profile failed validation; starting fresh", parsed.error.issues);
  } catch (err) {
    console.warn("[profile] stored profile is not valid JSON; starting fresh", err);
  }
  return createEmptyProfile();
}

/** Validates and saves the profile. Throws if the profile is invalid (a bug, not user error). */
export function saveProfile(profile: UserProfile, db: Db = getDb()): void {
  const valid = profileSchema.parse(profile);
  db.prepare(
    `INSERT INTO profile (id, json, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(valid), valid.updatedAt);
}

/** Deletes the stored profile (the next load returns an empty one). */
export function resetProfile(db: Db = getDb()): void {
  db.prepare("DELETE FROM profile").run();
}

/** Loads, applies ops and saves (only if something changed) in one transaction. */
export function applyProfileOps(ops: readonly ProfileOp[], db: Db = getDb()): ApplyResult {
  return transaction(db, () => {
    const result = applyOps(loadProfile(db), ops);
    if (result.changed) saveProfile(result.profile, db);
    return result;
  });
}
