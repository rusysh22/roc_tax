import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
import { getInvoicing } from "@/server/lifecycle";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getInvoicing().listForWorkspace(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
