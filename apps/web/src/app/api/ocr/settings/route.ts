import { readJson } from "@/server/http";
import { getOcr } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getOcr().getOrgOcrSettings(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const body = await readJson(request, 4096);
    return jsonResponse(await getOcr().updateOrgOcrSettings(sessionId, body));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
