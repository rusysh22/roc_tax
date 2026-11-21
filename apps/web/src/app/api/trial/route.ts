import { z } from "zod";
import { getAuth } from "@/server/auth";
import { authConfiguration } from "@/server/auth/config";
import { getDatabase } from "@/server/database";
import { readJson, InvalidBody } from "@/server/http";
import { AccessError } from "@/server/workspaces/policy";
import { trialService } from "@/server/trial/service";
export const runtime = "nodejs";
const activationSchema = z.object({ action: z.literal("activate") }).strict();
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function handle(request: Request, activate: boolean) {
  try {
    if (
      activate &&
      request.headers.get("origin") !== authConfiguration().origin
    )
      return json({ code: "ORIGIN_MISMATCH" }, 403);
    const session = await getAuth().api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (!session) throw new AccessError("UNAUTHENTICATED");
    if (
      activate &&
      !activationSchema.safeParse(await readJson(request, 1024)).success
    )
      return json({ code: "INVALID_INPUT" }, 400);
    const service = trialService(getDatabase());
    const snapshot = await (activate
      ? service.activate(session.session.id)
      : service.snapshot(session.session.id));
    // Subscription allowance is display-only here; creation re-checks it under lock.
    const subscription = await service.allowance(session.session.id);
    return json({ ...snapshot, subscription });
  } catch (error) {
    if (error instanceof InvalidBody)
      return json({ code: "INVALID_INPUT" }, 400);
    if (error instanceof AccessError)
      return json(
        { code: error.code },
        error.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    return json({ code: "SERVICE_UNAVAILABLE" }, 503);
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
