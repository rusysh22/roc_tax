import { z } from "zod";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
import { getInvoicing } from "@/server/lifecycle";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionId = await requireSessionId(request, false);
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse((await context.params).id);
    return jsonResponse(await getInvoicing().getInvoice(sessionId, id));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
