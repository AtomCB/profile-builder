import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, transaction, type Db } from "./index";
import {
  clearMessages,
  deleteMessage,
  getLastMessage,
  insertMessage,
  listMessages,
  listRecentMessages,
} from "./messageRepo";
import { applyProfileOps, loadProfile, resetProfile, saveProfile } from "./profileRepo";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});
afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("profileRepo", () => {
  it("returns an empty profile when nothing is stored", () => {
    const p = loadProfile(db);
    expect(p.traveler.homeBase).toBeNull();
    expect(p.places).toEqual([]);
  });

  it("round-trips a saved profile", () => {
    const { profile } = applyProfileOps(
      [{ op: "add", path: "preferences.interests", value: "hiking", source: "stated" }],
      db,
    );
    expect(loadProfile(db)).toEqual(profile);
  });

  it("falls back to an empty profile when stored JSON is corrupt or invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.prepare("INSERT INTO profile (id, json, updated_at) VALUES (1, ?, ?)").run("{not json", "x");
    expect(loadProfile(db).places).toEqual([]);
    db.prepare("UPDATE profile SET json = ? WHERE id = 1").run(JSON.stringify({ schemaVersion: 99 }));
    expect(loadProfile(db).places).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("refuses to save an invalid profile", () => {
    const bad = { ...loadProfile(db), schemaVersion: 2 } as unknown as Parameters<typeof saveProfile>[0];
    expect(() => saveProfile(bad, db)).toThrow();
  });

  it("only writes when an op changed something, and reports per-op results", () => {
    const r = applyProfileOps([{ op: "remove", path: "preferences.avoid", value: "x" }], db);
    expect(r.changed).toBe(false);
    expect(r.results[0].ok).toBe(false);
    expect(db.prepare("SELECT COUNT(*) AS n FROM profile").get()).toEqual({ n: 0 });
  });
});

describe("messageRepo", () => {
  it("inserts and lists messages oldest first, with tool events", () => {
    insertMessage({ role: "assistant", content: "Hi!" }, db);
    insertMessage({ role: "user", content: "I loved Kyoto" }, db);
    insertMessage(
      {
        role: "assistant",
        content: "Great pick.",
        tools: [{ name: "getDestinationInfo", arg: "Kyoto", found: true }, { name: "updateProfile" }],
      },
      db,
    );
    const all = listMessages(db);
    expect(all.map((m) => m.content)).toEqual(["Hi!", "I loved Kyoto", "Great pick."]);
    expect(all[2].tools).toEqual([{ name: "getDestinationInfo", arg: "Kyoto", found: true }, { name: "updateProfile" }]);
    expect(all[0].status).toBe("complete");
  });

  it("returns the most recent N in chronological order", () => {
    for (let i = 1; i <= 5; i++) insertMessage({ role: i % 2 ? "user" : "assistant", content: `m${i}` }, db);
    expect(listRecentMessages(2, db).map((m) => m.content)).toEqual(["m4", "m5"]);
    expect(getLastMessage(db)?.content).toBe("m5");
  });

  it("stores status and deletes by id", () => {
    const m = insertMessage({ role: "assistant", content: "partial", status: "error" }, db);
    expect(getLastMessage(db)?.status).toBe("error");
    expect(deleteMessage(m.id, db)).toBe(true);
    expect(deleteMessage(m.id, db)).toBe(false);
    expect(getLastMessage(db)).toBeNull();
  });

  it("tolerates malformed tool JSON", () => {
    db.prepare(
      "INSERT INTO messages (id, role, content, tools, status, created_at) VALUES ('x', 'assistant', 'hi', 'oops', 'complete', 't')",
    ).run();
    expect(listMessages(db)[0].tools).toEqual([]);
  });
});

describe("start over", () => {
  it("clears messages and the profile", () => {
    applyProfileOps([{ op: "markNone", path: "preferences.avoid" }], db);
    insertMessage({ role: "user", content: "hi" }, db);
    transaction(db, () => {
      clearMessages(db);
      resetProfile(db);
    });
    expect(listMessages(db)).toEqual([]);
    expect(loadProfile(db).preferences.avoid).toBeNull();
  });
});

describe("transaction recovery", () => {
  it("recovers from a leaked open transaction", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.exec("BEGIN");
    insertMessage({ role: "user", content: "leaked" }, db);
    transaction(db, () => clearMessages(db));
    expect(db.isTransaction).toBe(false);
    expect(listMessages(db)).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});

describe("transaction", () => {
  it("rolls back when the callback throws", () => {
    expect(() =>
      transaction(db, () => {
        insertMessage({ role: "user", content: "lost" }, db);
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(listMessages(db)).toEqual([]);
  });
});
