/**
 * Scheduled subscription lifecycle job: applies due cancellations (workspace
 * becomes read-only) and deletes stored documents/XML files of workspaces
 * whose retention period has ended. Safe to run repeatedly; run it daily.
 *
 *   npm run data:lifecycle
 *
 * Alternatively call POST /api/internal/lifecycle with the
 * `x-job-token: $LIFECYCLE_JOB_TOKEN` header from an external scheduler.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/web/src/generated/prisma/client";
import { postgresOptions } from "../apps/web/src/server/postgres";
import { localDocumentStorage } from "../apps/web/src/server/intake/storage";
import { lifecycleService } from "../apps/web/src/server/lifecycle/service";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg(postgresOptions(url)) });

try {
  const result = await lifecycleService(
    db,
    localDocumentStorage(),
  ).runScheduled();
  console.log(JSON.stringify({ at: new Date().toISOString(), ...result }));
} finally {
  await db.$disconnect();
}
