import { z } from "zod";
import { readJson } from "@/server/http";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
import { SalesError } from "@/server/sales/service";
import { getSales } from "@/server/sales";
export const runtime = "nodejs";

function salesError(error: unknown) {
  if (error instanceof SalesError)
    return jsonResponse(
      { code: error.code },
      error.code === "NOT_FOUND" ? 404 : 400,
    );
  if (error instanceof z.ZodError)
    return jsonResponse({ code: "INVALID_INPUT" }, 400);
  return intakeErrorResponse(error);
}

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getSales().adminOverview(sessionId));
  } catch (error) {
    return salesError(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    return jsonResponse(
      await getSales().adminCommand(sessionId, await readJson(request, 16384)),
    );
  } catch (error) {
    return salesError(error);
  }
}
