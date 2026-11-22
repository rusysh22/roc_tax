import { z } from "zod";
import { importColumns, type ImportColumn } from "@/lib/intake/spreadsheet";
import { InvalidBody, readBytes } from "@/server/http";
import { getImports } from "@/server/intake";
import {
  intakeErrorResponse,
  jsonResponse,
  requireSessionId,
} from "@/server/intake/http";
import { MAX_SPREADSHEET_BYTES } from "@/server/intake/spreadsheet";

export const runtime = "nodejs";

const idSchema = z.string().trim().min(1).max(100);
const uuidSchema = z.uuid();

function parseMappingHeader(
  raw: string | null,
): Partial<Record<ImportColumn, string>> | undefined {
  if (!raw) return undefined;
  let decoded: unknown;
  try {
    decoded = JSON.parse(decodeURIComponent(raw));
  } catch {
    throw new InvalidBody();
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded))
    throw new InvalidBody();
  const out: Partial<Record<ImportColumn, string>> = {};
  for (const col of importColumns) {
    const val = (decoded as Record<string, unknown>)[col];
    if (typeof val === "string" && val.trim().length > 0 && val.length <= 120) {
      out[col] = val.trim();
    }
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const sessionId = await requireSessionId(request, false);
    const id = new URL(request.url).searchParams.get("id");
    return jsonResponse(
      await getImports().listBatches(
        sessionId,
        id ? idSchema.parse(id) : undefined,
      ),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await requireSessionId(request, true);
    const action = request.headers.get("x-import-action") ?? "preview";
    if (action !== "preview" && action !== "commit") throw new InvalidBody();
    const companyId = idSchema.parse(request.headers.get("x-company-id") ?? "");
    const encodedName = request.headers.get("x-file-name") ?? "";
    let fileName = "";
    try {
      fileName = decodeURIComponent(encodedName);
    } catch {
      fileName = encodedName;
    }
    const mapping = parseMappingHeader(request.headers.get("x-column-mapping"));
    const bytes = await readBytes(request, MAX_SPREADSHEET_BYTES);

    if (action === "preview") {
      return jsonResponse(
        await getImports().preview(sessionId, {
          companyId,
          fileName,
          bytes,
          mapping,
        }),
      );
    }

    const idempotencyKey = uuidSchema.parse(
      request.headers.get("x-idempotency-key") ?? "",
    );
    const acknowledgeDuplicates =
      request.headers.get("x-acknowledge-duplicates") === "1";
    return jsonResponse(
      await getImports().commit(sessionId, {
        idempotencyKey,
        companyId,
        fileName,
        bytes,
        mapping,
        acknowledgeDuplicates,
      }),
    );
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
