import { z } from "zod";
export const databaseUrlSchema = z.url().refine((value) => {
  return value.startsWith("postgresql://") || value.startsWith("postgres://");
}, "PostgreSQL connection required");
