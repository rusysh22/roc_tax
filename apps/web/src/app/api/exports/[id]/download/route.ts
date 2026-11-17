import { z } from "zod";
import { getExport } from "@/server/intake";
import { intakeErrorResponse, requireSessionId } from "@/server/intake/http";

export const runtime = "nodejs";

const idSchema = z.string().min(1).max(100);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionId = await requireSessionId(request, false);
    const { id } = await context.params;
    const batchId = idSchema.parse(id);
    const file = await getExport().downloadExport(sessionId, batchId);
    const asciiName = file.fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
    return new Response(Buffer.from(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-XML-SHA256": file.xmlSha256,
      },
    });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
