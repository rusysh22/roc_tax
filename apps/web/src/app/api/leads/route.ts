import { authConfiguration } from "@/server/auth/config";
import { InvalidBody, readJson } from "@/server/http";
import { SalesError } from "@/server/sales/service";
import { getSales, requesterOf } from "@/server/sales";
export const runtime = "nodejs";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Public sales-led registration form submission. */
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== authConfiguration().origin)
      return json({ code: "FORBIDDEN" }, 403);
    const body = await readJson(request, 8192);
    return json(await getSales().submitLead(body, requesterOf(request)), 201);
  } catch (error) {
    if (error instanceof InvalidBody)
      return json({ code: "INVALID_INPUT" }, 400);
    if (error instanceof SalesError)
      return json(
        { code: error.code },
        error.code === "RATE_LIMITED" ? 429 : 400,
      );
    return json({ code: "SERVICE_UNAVAILABLE" }, 503);
  }
}
