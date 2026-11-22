import { z } from "zod";
import { readJson } from "@/server/http";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
import { getLifecycle } from "@/server/lifecycle";
export const runtime = "nodejs";

const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request"),
      reason: z.string().max(1000).optional(),
    })
    .strict(),
  z.object({ action: z.literal("cancel") }).strict(),
]);

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getLifecycle().status(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const command = commandSchema.parse(await readJson(request, 4096));
    const lifecycle = getLifecycle();
    return jsonResponse(
      command.action === "request"
        ? await lifecycle.request(sessionId, { reason: command.reason ?? "" })
        : await lifecycle.cancel(sessionId),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
