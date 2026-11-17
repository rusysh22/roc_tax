// Liveness only. Database and provider readiness are deliberately not asserted.
export function GET() {
  return Response.json(
    { status: "ok", check: "liveness" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
