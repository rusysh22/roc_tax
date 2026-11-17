import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "../../generated/prisma/client";
import { authConfiguration } from "./config";
import type { Mail } from "./mail";
import { mailMessages } from "../../i18n/mail";
export function createAuth(
  db: PrismaClient,
  deliver: (mail: Mail) => Promise<void>,
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = authConfiguration(env);
  return betterAuth({
    appName: "SerenTax",
    baseURL: config.origin,
    secret: config.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    trustedOrigins: [config.origin],
    logger: { disabled: true },
    verification: { storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await deliver({
          to: user.email,
          subject: mailMessages.reset.subject,
          text: `${mailMessages.reset.body}\n\n${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        await deliver({
          to: user.email,
          subject: mailMessages.verification.subject,
          text: `${mailMessages.verification.body}\n\n${url}`,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: !config.local,
      ipAddress: {
        ipAddressHeaders: config.AUTH_PROXY_IP_HEADER
          ? [config.AUTH_PROXY_IP_HEADER]
          : [],
      },
    },
  });
}
