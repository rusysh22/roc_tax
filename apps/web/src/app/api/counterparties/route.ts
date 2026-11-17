import { readJson } from "@/server/http";
import { getIntake } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    const url = new URL(request.url);
    return jsonResponse(
      await getIntake().listCounterparties(sessionId, {
        q: url.searchParams.get("q") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
      }),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const body = await readJson(request, 8192);
    return jsonResponse(await getIntake().mutateCounterparty(sessionId, body));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
