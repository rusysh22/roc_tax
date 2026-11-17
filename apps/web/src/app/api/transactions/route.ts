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
      await getIntake().listTransactions(sessionId, {
        q: url.searchParams.get("q") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        taxFamily: url.searchParams.get("taxFamily") ?? undefined,
        sort: url.searchParams.get("sort") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      }),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const body = await readJson(request, 65536);
    return jsonResponse(await getIntake().createTransaction(sessionId, body));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
