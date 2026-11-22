import { getPrivacy } from "@/server/privacy";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getPrivacy().overview(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
