import { readJson } from "@/server/http";
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
    return jsonResponse(await getInvoicing().adminList(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    return jsonResponse(
      await getInvoicing().adminCommand(
        sessionId,
        await readJson(request, 4096),
      ),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
