import { z } from "zod";
import { readJson } from "@/server/http";
import { requireActor } from "@/server/workspaces/service";
import { getDatabase } from "@/server/database";
import { AccessError } from "@/server/workspaces/policy";
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
      action: z.literal("terminate"),
      organizationId: z.string().min(1).max(100),
      reason: z.string().min(3).max(1000),
    })
    .strict(),
  z.object({ action: z.literal("run") }).strict(),
]);

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getLifecycle().adminList(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const command = commandSchema.parse(await readJson(request, 4096));
    const lifecycle = getLifecycle();
    if (command.action === "terminate")
      return jsonResponse(
        await lifecycle.adminTerminate(sessionId, {
          organizationId: command.organizationId,
          reason: command.reason,
        }),
      );
    const actor = await requireActor(getDatabase(), sessionId);
    if (actor.user.platformRole !== "SUPERADMIN")
      throw new AccessError("FORBIDDEN");
    return jsonResponse(await lifecycle.runScheduled());
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
