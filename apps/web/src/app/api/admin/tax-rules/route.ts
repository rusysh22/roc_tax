import { readJson } from "@/server/http";
import { getTax } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getTax().listRules(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const body = await readJson(request, 8192);
    return jsonResponse(await getTax().mutateRule(sessionId, body));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
