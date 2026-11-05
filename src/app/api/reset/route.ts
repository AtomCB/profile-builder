import { getDb, transaction } from "@/lib/db";
import { clearMessages } from "@/lib/db/messageRepo";
import { resetProfile } from "@/lib/db/profileRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start over: clears the chat history and the profile. */
export async function POST() {
  try {
    const db = getDb();
    transaction(db, () => {
      clearMessages(db);
      resetProfile(db);
    });
    return Response.json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[reset] failed:", detail);
    return Response.json(
      { error: "Could not reset", ...(process.env.NODE_ENV === "development" ? { detail } : {}) },
      { status: 500 },
    );
  }
}
