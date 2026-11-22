import { timingSafeEqual } from "node:crypto";
import { getLifecycle } from "@/server/lifecycle";
export const runtime = "nodejs";

/**
 * Scheduled lifecycle job for an external cron (e.g. daily):
 *   curl -X POST -H "x-job-token: $LIFECYCLE_JOB_TOKEN" https://<host>/api/internal/lifecycle
 * Disabled unless LIFECYCLE_JOB_TOKEN (32+ chars) is set.
 */
export async function POST(request: Request) {
  const expected = process.env.LIFECYCLE_JOB_TOKEN ?? "";
  const given = request.headers.get("x-job-token") ?? "";
  const ok =
    expected.length >= 32 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  const result = await getLifecycle().runScheduled();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
