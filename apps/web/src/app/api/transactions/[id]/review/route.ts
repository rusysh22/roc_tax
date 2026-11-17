import { z } from "zod";
import { readJson } from "@/server/http";
import { getTax } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
export const runtime = "nodejs";
const idSchema = z.string().min(1).max(100);
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionId = await requireSessionId(request, false);
    const id = idSchema.parse((await context.params).id);
    return jsonResponse(await getTax().getTransactionTaxState(sessionId, id));
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionId = await requireSessionId(request, true);
    const id = idSchema.parse((await context.params).id);
    const body = await readJson(request, 8192);
    return jsonResponse(
      await getTax().executeReviewCommand(sessionId, id, body),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
