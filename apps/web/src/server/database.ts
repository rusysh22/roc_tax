import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseUrlSchema } from "./environment";
import { postgresOptions } from "./postgres";

const globalDatabase = globalThis as unknown as { database?: PrismaClient };
export function getDatabase() {
  if (globalDatabase.database) return globalDatabase.database;
  const result = databaseUrlSchema.safeParse(process.env.DATABASE_URL);
  if (!result.success) throw new Error("DATABASE_NOT_CONFIGURED");
  const client = new PrismaClient({
    adapter: new PrismaPg(postgresOptions(result.data)),
  });
  globalDatabase.database = client;
  return client;
}
