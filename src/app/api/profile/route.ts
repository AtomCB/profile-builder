import { applyProfileOps } from "@/lib/db/profileRepo";
import { getCompleteness } from "@/lib/profile/completeness";
import { uiProfileRequestSchema } from "@/lib/profile/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** UI-initiated profile changes (currently: rejecting items). */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = uiProfileRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = applyProfileOps(parsed.data.ops);
    const errors = result.results.flatMap((r) => (r.ok ? [] : [r.error]));
    const payload = { profile: result.profile, completeness: getCompleteness(result.profile), errors };
    return Response.json(payload, { status: result.changed ? 200 : 409 });
  } catch (err) {
    console.error("[profile] update failed", err);
    return Response.json({ error: "Could not update the profile" }, { status: 500 });
  }
}
