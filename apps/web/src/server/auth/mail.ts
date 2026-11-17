import "server-only";
import nodemailer from "nodemailer";
import { authConfiguration } from "./config";
export type Mail = { to: string; subject: string; text: string };
export async function sendMail(mail: Mail) {
  const config = authConfiguration();
  const localSmtp = ["127.0.0.1", "localhost", "mailpit"].includes(
    config.SMTP_HOST,
  );
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: !localSmtp,
    auth:
      config.SMTP_USER && config.SMTP_PASSWORD
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
  });
  try {
    const result = await transport.sendMail({
      from: config.SMTP_FROM,
      ...mail,
    });
    if (!result.accepted.length || result.rejected.length)
      throw new Error("MAIL_DELIVERY_FAILED");
  } catch {
    throw new Error("MAIL_DELIVERY_FAILED");
  } finally {
    transport.close();
  }
}
