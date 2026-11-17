import { getReports } from "@/server/intake";
import { intakeErrorResponse, requireSessionId } from "@/server/intake/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    const params = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    const csv = await getReports().exportReconciliationCsv(sessionId, params);
    return new Response(Buffer.from(csv.bytes), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Length": String(csv.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${csv.fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
