import { z } from "zod";
import { readBytes } from "@/server/http";
import { getIntake } from "@/server/intake";
import { MAX_DOCUMENT_BYTES } from "@/server/intake/documents";
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
    const id = idSchema.parse((await context.params).id);
    const encodedName = request.headers.get("x-file-name") ?? "";
    let fileName = "";
    try {
      fileName = decodeURIComponent(encodedName);
    } catch {
      fileName = encodedName;
    }
    const bytes = await readBytes(request, MAX_DOCUMENT_BYTES);
    const declaredType = request.headers.get("content-type") ?? "";
    return jsonResponse(
      await getIntake().attachDocument(sessionId, id, {
        bytes,
        declaredType,
        fileName,
      }),
      201,
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
