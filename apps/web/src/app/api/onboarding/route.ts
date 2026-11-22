import { getDatabase } from "@/server/database";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
import { onboardingService } from "@/server/onboarding/service";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    return jsonResponse(
      await onboardingService(getDatabase()).progress(sessionId),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
