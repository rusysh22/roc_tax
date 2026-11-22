import { z } from "zod";
import { getIntake } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
export const runtime = "nodejs";
const idSchema = z.string().min(1).max(100);
function contentDisposition(inline: boolean, name: string) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const kind = inline ? "inline" : "attachment";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const sessionId = await requireSessionId(request, false);
    const params = await context.params;
    const id = idSchema.parse(params.id);
    const documentId = idSchema.parse(params.documentId);
    const doc = await getIntake().readDocument(sessionId, id, documentId);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(Buffer.from(doc.bytes), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(doc.bytes.byteLength),
        "Content-Disposition": contentDisposition(!download, doc.originalName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const sessionId = await requireSessionId(request, true);
    const params = await context.params;
    return jsonResponse(
      await getIntake().deleteDocument(
        sessionId,
        idSchema.parse(params.id),
        idSchema.parse(params.documentId),
      ),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
