import { BodyTooLarge } from "@/server/http";
import { getBilling } from "@/server/intake";
import { intakeErrorResponse, jsonResponse } from "@/server/intake/http";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 65536;

export async function POST(request: Request) {
  try {
    const len = Number(request.headers.get("content-length") || "0");
    if (len > MAX_WEBHOOK_BYTES) {
      throw new BodyTooLarge();
    }
    const rawBuffer = new Uint8Array(await request.arrayBuffer());
    if (rawBuffer.byteLength > MAX_WEBHOOK_BYTES) {
      throw new BodyTooLarge();
    }
    const signature = request.headers.get("x-berlanggan-signature");
    return jsonResponse(
      await getBilling().receiveWebhook(rawBuffer, signature),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
