import { getPrivacy } from "@/server/privacy";
import { intakeErrorResponse, requireSessionId } from "@/server/intake/http";
export const runtime = "nodejs";

/** Owner/Admin workspace data export (JSON download, audited). */
export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    const data = await getPrivacy().exportData(sessionId);
    const date = data.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="serentax-export-${date}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
