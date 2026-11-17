import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/web/src/generated/prisma/client";
import { databaseUrlSchema } from "../apps/web/src/server/environment";
import { postgresOptions } from "../apps/web/src/server/postgres";
const result = databaseUrlSchema.safeParse(process.env.DATABASE_URL);
if (!result.success) {
  console.error("DATABASE_NOT_CONFIGURED");
  process.exitCode = 1;
} else {
  const db = new PrismaClient({
    adapter: new PrismaPg(postgresOptions(result.data)),
  });
  try {
    await db.$queryRaw`SELECT 1`;
    console.log("Database connectivity verified");
  } catch {
    console.error("DATABASE_UNAVAILABLE");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
