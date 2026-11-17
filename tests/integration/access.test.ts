import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import {
  workspaceService,
  requireMembership,
  type InvitationDelivery,
} from "../../apps/web/src/server/workspaces/service";
import { createAuth } from "../../apps/web/src/server/auth/create-auth";
import type { Mail } from "../../apps/web/src/server/auth/mail";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must name an isolated database ending in _test",
  );
const db = new PrismaClient({
  adapter: new PrismaPg(postgresOptions(url)),
});
const prefix = randomUUID();
const sessionIds: string[] = [];
const userIds: string[] = [];
const orgIds: string[] = [];
const delivered: InvitationDelivery[] = [];
const service = workspaceService(db, async (mail) => {
  delivered.push(mail);
});
async function actor(label: string, verified = true) {
  const id = `${prefix}-${label}`;
  userIds.push(id);
  await db.user.create({
    data: {
      id,
      name: label,
      email: `${id}@example.test`,
      emailVerified: verified,
    },
  });
  const sessionId = `${id}-session`;
  sessionIds.push(sessionId);
  await db.session.create({
    data: {
      id: sessionId,
      userId: id,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return { id, sessionId, email: `${id}@example.test` };
}
let owner: Awaited<ReturnType<typeof actor>>;
let stranger: Awaited<ReturnType<typeof actor>>;
let orgId: string;
beforeAll(async () => {
  owner = await actor("owner");
  stranger = await actor("stranger");
  await service.execute(owner.sessionId, {
    action: "create",
    name: "Synthetic workspace A",
    legalName: "Synthetic entity A",
  });
  orgId = (await service.snapshot(owner.sessionId)).active!.id;
  orgIds.push(orgId);
  await service.execute(stranger.sessionId, {
    action: "create",
    name: "Synthetic workspace B",
    legalName: "Synthetic entity B",
  });
  orgIds.push((await service.snapshot(stranger.sessionId)).active!.id);
});
afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
describe("real PostgreSQL authorization", () => {
  it("switches only among memberships and keeps active selection per session", async () => {
    await service.execute(owner.sessionId, {
      action: "create",
      name: "Synthetic second workspace",
      legalName: "Synthetic second entity",
    });
    const second = (await service.snapshot(owner.sessionId)).active!.id;
    orgIds.push(second);
    const anotherSession = `${prefix}-owner-other-session`;
    await db.session.create({
      data: {
        id: anotherSession,
        userId: owner.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await service.execute(owner.sessionId, {
      action: "select",
      organizationId: orgId,
    });
    await service.execute(anotherSession, {
      action: "select",
      organizationId: second,
    });
    expect((await service.snapshot(owner.sessionId)).active?.id).toBe(orgId);
    expect((await service.snapshot(anotherSession)).active?.id).toBe(second);
    expect((await service.snapshot(owner.sessionId)).workspaces).toHaveLength(
      2,
    );
  });
  it("denies cross-tenant selection/read and hides team data", async () => {
    await expect(
      service.execute(stranger.sessionId, {
        action: "select",
        organizationId: orgId,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      requireMembership(db, stranger.sessionId, orgId),
    ).rejects.toThrow("FORBIDDEN");
    const foreign = await db.membership.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    await expect(
      service.execute(stranger.sessionId, {
        action: "revoke",
        memberId: foreign.id,
      }),
    ).rejects.toThrow("FORBIDDEN");
    expect(
      (await service.snapshot(stranger.sessionId)).workspaces,
    ).toHaveLength(1);
  });
  it("requires verified actors and rejects revoked sessions", async () => {
    const unverified = await actor("unverified", false);
    await expect(
      service.execute(unverified.sessionId, {
        action: "create",
        name: "No access",
        legalName: "No access",
      }),
    ).rejects.toThrow("UNVERIFIED");
    await db.session.delete({ where: { id: unverified.sessionId } });
    await expect(service.snapshot(unverified.sessionId)).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });
  it("binds invitations to email, accepts once under concurrency, and immediately revokes access", async () => {
    const member = await actor("member");
    await service.execute(owner.sessionId, {
      action: "invite",
      email: member.email,
      role: "PREPARER",
      locale: "en",
    });
    const token = delivered.at(-1)!.token;
    expect(
      (await db.invitation.findFirstOrThrow({ where: { email: member.email } }))
        .tokenHash,
    ).not.toBe(token);
    await expect(
      service.execute(stranger.sessionId, { action: "accept", token }),
    ).rejects.toThrow("INVALID_INVITATION");
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.execute(member.sessionId, { action: "accept", token }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await service.snapshot(member.sessionId)).active?.members,
    ).toHaveLength(0);
    await expect(
      service.execute(member.sessionId, {
        action: "invite",
        email: "synthetic@example.test",
        role: "OWNER",
        locale: "en",
      }),
    ).rejects.toThrow("FORBIDDEN");
    const membership = await db.membership.findUniqueOrThrow({
      where: {
        organizationId_userId: { organizationId: orgId, userId: member.id },
      },
    });
    await service.execute(owner.sessionId, {
      action: "revoke",
      memberId: membership.id,
    });
    await expect(
      requireMembership(db, member.sessionId, orgId),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      service.execute(member.sessionId, { action: "accept", token }),
    ).rejects.toThrow("INVALID_INVITATION");
    expect((await service.snapshot(member.sessionId)).active).toBeNull();
  });
  it("blocks expired and cancelled invitations and failed delivery", async () => {
    const target = await actor("expired");
    await service.execute(owner.sessionId, {
      action: "invite",
      email: target.email,
      role: "REVIEWER",
      locale: "id",
    });
    const token = delivered.at(-1)!.token;
    const invitation = await db.invitation.findFirstOrThrow({
      where: { email: target.email },
    });
    await db.invitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      service.execute(target.sessionId, { action: "accept", token }),
    ).rejects.toThrow("INVALID_INVITATION");
    await service.execute(owner.sessionId, {
      action: "cancel",
      invitationId: invitation.id,
    });
    expect(
      (await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } }))
        .status,
    ).toBe("REVOKED");
    const failedDelivery = workspaceService(db, async () => {
      throw new Error("synthetic SMTP failure");
    });
    await expect(
      failedDelivery.execute(owner.sessionId, {
        action: "invite",
        email: `${prefix}-failed@example.test`,
        role: "PREPARER",
        locale: "en",
      }),
    ).rejects.toThrow("MAIL_DELIVERY_FAILED");
    expect(
      (
        await db.invitation.findFirstOrThrow({
          where: { email: `${prefix}-failed@example.test` },
        })
      ).status,
    ).toBe("REVOKED");
  });
  it("protects the last owner and prevents admin promotion", async () => {
    const ownerMembership = await db.membership.findUniqueOrThrow({
      where: {
        organizationId_userId: { organizationId: orgId, userId: owner.id },
      },
    });
    await expect(
      service.execute(owner.sessionId, {
        action: "revoke",
        memberId: ownerMembership.id,
      }),
    ).rejects.toThrow("LAST_OWNER");
    const admin = await actor("admin");
    await service.execute(owner.sessionId, {
      action: "invite",
      email: admin.email,
      role: "ADMIN",
      locale: "en",
    });
    await service.execute(admin.sessionId, {
      action: "accept",
      token: delivered.at(-1)!.token,
    });
    await expect(
      service.execute(admin.sessionId, {
        action: "invite",
        email: "synthetic@example.test",
        role: "OWNER",
        locale: "en",
      }),
    ).rejects.toThrow("FORBIDDEN");
    const adminMembership = await db.membership.findUniqueOrThrow({
      where: {
        organizationId_userId: { organizationId: orgId, userId: admin.id },
      },
    });
    await expect(
      service.execute(admin.sessionId, {
        action: "role",
        memberId: adminMembership.id,
        role: "OWNER",
      }),
    ).rejects.toThrow("FORBIDDEN");
    const target = await actor("pending-issuer");
    await service.execute(admin.sessionId, {
      action: "invite",
      email: target.email,
      role: "REVIEWER",
      locale: "en",
    });
    const token = delivered.at(-1)!.token;
    await service.execute(owner.sessionId, {
      action: "role",
      memberId: adminMembership.id,
      role: "PREPARER",
    });
    await expect(
      service.execute(target.sessionId, { action: "accept", token }),
    ).rejects.toThrow("INVALID_INVITATION");
    await expect(
      service.withActive(admin.sessionId, "team.manage", async () => true),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("Better Auth with real database", () => {
  it("requires email verification, verifies password hashing, reset replay denial and session revocation", async () => {
    const mail: Mail[] = [];
    const auth = createAuth(
      db,
      async (message) => {
        mail.push(message);
      },
      {
        BETTER_AUTH_URL: "http://127.0.0.1:3000",
        BETTER_AUTH_SECRET: "synthetic-test-only-secret-1234567890",
        SMTP_HOST: "localhost",
        SMTP_PORT: "1025",
        SMTP_FROM: "test@example.test",
      },
    );
    const email = `${prefix}-auth@example.test`;
    const password = "Synthetic-test-password-482!";
    const signup = await auth.api.signUpEmail({
      body: { email, password, name: "Synthetic auth user" },
    });
    userIds.push(signup.user.id);
    expect(signup.token).toBeNull();
    const stored = await db.account.findFirstOrThrow({
      where: { userId: signup.user.id },
    });
    expect(stored.password).not.toBe(password);
    await expect(
      auth.api.signInEmail({ body: { email, password } }),
    ).rejects.toThrow();
    const verifyUrl = mail.at(-1)!.text.match(/https?:\/\/\S+/)![0];
    const verified = await auth.handler(new Request(verifyUrl));
    expect(verified.status).toBeLessThan(400);
    const signedIn = await auth.api.signInEmail({ body: { email, password } });
    expect(await db.session.count({ where: { userId: signup.user.id } })).toBe(
      1,
    );
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/en/auth/reset" },
    });
    const resetUrl = new URL(mail.at(-1)!.text.match(/https?:\/\/\S+/)![0]);
    const token = resetUrl.pathname.split("/").at(-1)!;
    await auth.api.resetPassword({
      body: { token, newPassword: "Synthetic-new-password-482!" },
    });
    expect(await db.session.count({ where: { userId: signup.user.id } })).toBe(
      0,
    );
    await expect(
      auth.api.resetPassword({ body: { token, newPassword: password } }),
    ).rejects.toThrow();
    await expect(
      auth.api.signInEmail({ body: { email, password } }),
    ).rejects.toThrow();
    expect(signedIn.token).toBeTruthy();
    // HTTP origin enforcement is exercised against the actual Next route in auth.spec.ts.
  });
});
