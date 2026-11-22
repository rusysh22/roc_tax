import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "../../generated/prisma/client";
import { authConfiguration } from "./config";
import type { Mail } from "./mail";
import { mailMessages } from "../../i18n/mail";
/**
 * Default workspace for a new session: the user's most recently used workspace
 * (if still a member), otherwise their oldest membership. Every protected
 * request still re-verifies membership, so this only removes the need to
 * re-select a workspace after each sign-in; it never grants access.
 */
export async function defaultWorkspaceFor(db: PrismaClient, userId: string) {
  const memberships = await db.membership.findMany({
    where: { userId },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return null;
  const allowed = new Set(memberships.map((m) => m.organizationId));
  const recent = await db.session.findMany({
    where: { userId, activeOrganizationId: { not: null } },
    select: { activeOrganizationId: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  const lastUsed = recent.find(
    (row) => row.activeOrganizationId && allowed.has(row.activeOrganizationId),
  );
  return lastUsed?.activeOrganizationId ?? memberships[0].organizationId;
}

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
      additionalFields: {
        activeOrganizationId: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const activeOrganizationId = await defaultWorkspaceFor(
              db,
              session.userId,
            );
            return activeOrganizationId
              ? { data: { ...session, activeOrganizationId } }
              : undefined;
          },
        },
      },
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
