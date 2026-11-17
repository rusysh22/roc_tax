import { readJson } from "@/server/http";
import { getExport } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(await getExport().listWorkspaceExports(sessionId));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const body = await readJson(request, 16384);
    const result = await getExport().generateExport(sessionId, body);
    return jsonResponse(result, result.idempotentReplay ? 200 : 201);
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
