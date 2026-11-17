import { getReports } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    const params = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    return jsonResponse(
      await getReports().getSuperadminOverview(sessionId, params),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
