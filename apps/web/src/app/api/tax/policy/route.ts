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
    return jsonResponse(await getTax().getTaxPolicy(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const body = await readJson(request, 2048);
    return jsonResponse(await getTax().updateTaxPolicy(sessionId, body));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
