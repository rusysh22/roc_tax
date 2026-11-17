import { getAuth } from "@/server/auth";
import { authConfiguration } from "@/server/auth/config";
import { getWorkspaces } from "@/server/workspaces";
import {
  AccessError,
  workspaceCommandSchema,
} from "@/server/workspaces/policy";
import { readJson, InvalidBody } from "@/server/http";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function handle(request: Request, mutate: boolean) {
  try {
    if (mutate && request.headers.get("origin") !== authConfiguration().origin)
      return json({ code: "FORBIDDEN" }, 403);
    const session = await getAuth().api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (!session) throw new AccessError("UNAUTHENTICATED");
    if (mutate) {
      const value = await readJson(request, 4096);
      const parsed = workspaceCommandSchema.safeParse(value);
      if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
      await getWorkspaces().execute(session.session.id, parsed.data);
      return json({ ok: true });
    }
    return json(await getWorkspaces().snapshot(session.session.id));
  } catch (error) {
    if (error instanceof InvalidBody)
      return json({ code: "INVALID_INPUT" }, 400);
    if (error instanceof AccessError)
      return json(
        { code: error.code },
        error.code === "UNAUTHENTICATED"
          ? 401
          : error.code === "RATE_LIMITED"
            ? 429
            : 403,
      );
    return json({ code: "SERVICE_UNAVAILABLE" }, 503);
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
