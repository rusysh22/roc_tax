import { readJson } from "@/server/http";
import { getBilling } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getBilling().listAdminBilling(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const body = await readJson(request, 16384);
    return jsonResponse(await getBilling().mutateAdminBilling(sessionId, body));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
