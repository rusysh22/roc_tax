import { z } from "zod";
const configSchema = z.object({
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.email(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  AUTH_PROXY_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});
export function authConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) throw new Error("AUTH_NOT_CONFIGURED");
  const origin = new URL(result.data.BETTER_AUTH_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))
  )
    throw new Error("AUTH_NOT_CONFIGURED");
  if (
    !local &&
    (!result.data.AUTH_PROXY_IP_HEADER ||
      !result.data.SMTP_USER ||
      !result.data.SMTP_PASSWORD)
  )
    throw new Error("AUTH_NOT_CONFIGURED");
  return { ...result.data, origin: origin.origin, local };
}
