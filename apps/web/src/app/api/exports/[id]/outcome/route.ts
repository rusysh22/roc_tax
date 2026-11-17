import { z } from "zod";
import { readJson } from "@/server/http";
import { getExport } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";

export const runtime = "nodejs";

const idSchema = z.string().min(1).max(100);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionId = await requireSessionId(request, true);
    const { id } = await context.params;
    const batchId = idSchema.parse(id);
    const body = await readJson(request, 8192);
    return jsonResponse(
      await getExport().recordOutcome(sessionId, batchId, body),
      201,
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
