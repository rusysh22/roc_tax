import { getAuth } from "@/server/auth";
import { authConfiguration } from "@/server/auth/config";
import { z } from "zod";
import { readJson, InvalidBody } from "@/server/http";
export const runtime = "nodejs";
const allowed = new Set([
  "sign-up/email",
  "sign-in/email",
  "sign-out",
  "get-session",
  "verify-email",
  "send-verification-email",
  "request-password-reset",
  "reset-password",
  "list-sessions",
  "revoke-session",
  "revoke-other-sessions",
  "update-user",
]);
async function handle(request: Request) {
  try {
    if (
      request.method === "POST" &&
      request.headers.get("origin") !== authConfiguration().origin
    )
      return Response.json({ code: "FORBIDDEN" }, { status: 403 });
    const path = new URL(request.url).pathname.replace("/api/auth/", "");
    if (!allowed.has(path) && !/^reset-password\/[a-zA-Z0-9_-]+$/.test(path))
      return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    if (request.method === "POST") {
      const body = await readJson(request);
      if (
        path === "update-user" &&
        !z
          .object({ name: z.string().trim().min(2).max(100) })
          .strict()
          .safeParse(body).success
      )
        throw new InvalidBody();
      if (
        path === "sign-up/email" &&
        !z
          .object({
            name: z.string().trim().min(2).max(100),
            email: z.email().max(254),
            password: z.string().min(12).max(128),
            callbackURL: z.string().max(500).optional(),
          })
          .strict()
          .safeParse(body).success
      )
        throw new InvalidBody();
      request = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(body),
      });
    }
    const response = await getAuth().handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return Response.json(
      {
        code:
          error instanceof InvalidBody ? "INVALID_INPUT" : "AUTH_UNAVAILABLE",
      },
      {
        status: error instanceof InvalidBody ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export const GET = handle;
export const POST = handle;
