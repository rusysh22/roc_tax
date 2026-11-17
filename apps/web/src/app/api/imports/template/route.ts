import { importTemplateQuerySchema } from "@/lib/intake/spreadsheet";
import { intakeErrorResponse, requireSessionId } from "@/server/intake/http";
import { buildImportTemplate } from "@/server/intake/spreadsheet";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireSessionId(request, false);
    const url = new URL(request.url);
    const query = importTemplateQuerySchema.parse({
      format: url.searchParams.get("format") ?? undefined,
      family: url.searchParams.get("family") ?? undefined,
    });
    const template = buildImportTemplate(query.format, query.family);
    return new Response(Buffer.from(template.bytes), {
      status: 200,
      headers: {
        "Content-Type": template.mimeType,
        "Content-Length": String(template.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${template.fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
