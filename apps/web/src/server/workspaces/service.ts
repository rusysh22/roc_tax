import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  AccessError,
  can,
  canAssign,
  type Permission,
  type WorkspaceCommand,
} from "./policy";

type Tx = Prisma.TransactionClient;
export type InvitationDelivery = {
  to: string;
  token: string;
  locale: "id" | "en";
};
export const invitationHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// sessionId is obtained from Better Auth on the server, never from request JSON.
export async function requireActor(db: Tx, sessionId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date())
    throw new AccessError("UNAUTHENTICATED");
  if (!session.user.emailVerified) throw new AccessError("UNVERIFIED");
  return session;
}
async function lockWorkspace(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${id} FOR UPDATE`;
}
export async function requireMembership(
  tx: Tx,
  sessionId: string,
  organizationId: string,
  permission?: Permission,
) {
  const session = await requireActor(tx, sessionId);
  const membership = await tx.membership.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: session.userId },
    },
  });
  if (!membership || (permission && !can(membership.role, permission)))
    throw new AccessError("FORBIDDEN");
  return { session, membership };
}
async function audit(
  tx: Tx,
  organizationId: string,
  actorId: string,
  action: string,
  targetId?: string,
) {
  await tx.workspaceAudit.create({
    data: { organizationId, actorId, action, targetId },
  });
}

export function workspaceService(
  db: PrismaClient,
  deliver: (mail: InvitationDelivery) => Promise<void>,
) {
  async function withActive<T>(
    sessionId: string,
    permission: Permission | undefined,
    action: (
      tx: Tx,
      actor: Awaited<ReturnType<typeof requireMembership>>,
    ) => Promise<T>,
  ) {
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;
    return db.$transaction(async (tx) => {
      // Membership mutations and protected operations share this lock, closing revocation races.
      await lockWorkspace(tx, organizationId);
      const actor = await requireMembership(
        tx,
        sessionId,
        organizationId,
        permission,
      );
      if (actor.session.activeOrganizationId !== organizationId)
        throw new AccessError("CONFLICT");
      return action(tx, actor);
    });
  }
  async function snapshot(sessionId: string) {
    const session = await requireActor(db, sessionId);
    const memberships = await db.membership.findMany({
      where: { userId: session.userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    const workspaces = memberships.map((m) => ({
      id: m.organizationId,
      name: m.organization.name,
      role: m.role,
    }));
    if (!session.activeOrganizationId) return { workspaces, active: null };
    try {
      const active = await withActive(
        sessionId,
        undefined,
        async (tx, { membership }) => {
          const organization = await tx.organization.findUniqueOrThrow({
            where: { id: membership.organizationId },
          });
          const manager = can(membership.role, "team.manage");
          const members = manager
            ? await tx.membership.findMany({
                where: { organizationId: organization.id },
                select: {
                  id: true,
                  role: true,
                  user: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: "asc" },
              })
            : [];
          const invitations = manager
            ? await tx.invitation.findMany({
                where: {
                  organizationId: organization.id,
                  status: { in: ["PENDING", "PENDING_DELIVERY"] },
                },
                select: { id: true, email: true, role: true, expiresAt: true },
                orderBy: { createdAt: "desc" },
                take: 100,
              })
            : [];
          return {
            id: organization.id,
            name: organization.name,
            legalName: organization.legalName,
            role: membership.role,
            members,
            invitations,
          };
        },
      );
      return { workspaces, active };
    } catch (error) {
      if (
        error instanceof AccessError &&
        ["FORBIDDEN", "NO_WORKSPACE"].includes(error.code)
      )
        return { workspaces, active: null };
      throw error;
    }
  }
  async function execute(sessionId: string, command: WorkspaceCommand) {
    if (command.action === "create") {
      return db.$transaction(async (tx) => {
        const session = await requireActor(tx, sessionId);
        // Serialize per-account creation for abuse limits; no trial is activated here.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${session.userId} FOR UPDATE`;
        if (
          (await tx.membership.count({
            where: { userId: session.userId, role: "OWNER" },
          })) >= 20
        )
          throw new AccessError("RATE_LIMITED");
        const organization = await tx.organization.create({
          data: {
            name: command.name,
            legalName: command.legalName,
            memberships: { create: { userId: session.userId, role: "OWNER" } },
          },
        });
        await tx.session.update({
          where: { id: sessionId },
          data: { activeOrganizationId: organization.id },
        });
        await audit(tx, organization.id, session.userId, "WORKSPACE_CREATED");
      });
    }
    if (command.action === "select") {
      return db.$transaction(async (tx) => {
        await lockWorkspace(tx, command.organizationId);
        await requireMembership(tx, sessionId, command.organizationId);
        await tx.session.update({
          where: { id: sessionId },
          data: { activeOrganizationId: command.organizationId },
        });
      });
    }
    if (command.action === "accept") {
      const candidate = await db.invitation.findUnique({
        where: { tokenHash: invitationHash(command.token) },
      });
      if (!candidate) throw new AccessError("INVALID_INVITATION");
      return db.$transaction(async (tx) => {
        await lockWorkspace(tx, candidate.organizationId);
        const session = await requireActor(tx, sessionId);
        const invitation = await tx.invitation.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        if (
          invitation.status !== "PENDING" ||
          invitation.expiresAt <= new Date() ||
          invitation.email !== session.user.email.toLowerCase()
        )
          throw new AccessError("INVALID_INVITATION");
        const issuer = await tx.membership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: invitation.invitedBy,
            },
          },
        });
        if (!issuer || !canAssign(issuer.role, invitation.role))
          throw new AccessError("INVALID_INVITATION");
        if (
          await tx.membership.findUnique({
            where: {
              organizationId_userId: {
                organizationId: invitation.organizationId,
                userId: session.userId,
              },
            },
          })
        )
          throw new AccessError("CONFLICT");
        await tx.membership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: session.userId,
            role: invitation.role,
          },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
        await tx.session.update({
          where: { id: sessionId },
          data: { activeOrganizationId: invitation.organizationId },
        });
        await audit(
          tx,
          invitation.organizationId,
          session.userId,
          "INVITATION_ACCEPTED",
          invitation.id,
        );
      });
    }
    if (command.action === "invite") {
      const token = randomBytes(32).toString("hex");
      const invitation = await withActive(
        sessionId,
        "team.manage",
        async (tx, { session, membership }) => {
          if (!canAssign(membership.role, command.role))
            throw new AccessError("FORBIDDEN");
          const organizationId = membership.organizationId;
          const recent = await tx.invitation.count({
            where: {
              invitedBy: session.userId,
              createdAt: { gte: new Date(Date.now() - 3600000) },
            },
          });
          if (recent >= 20) throw new AccessError("RATE_LIMITED");
          if (
            await tx.membership.findFirst({
              where: { organizationId, user: { email: command.email } },
            })
          )
            throw new AccessError("CONFLICT");
          if (
            await tx.invitation.findFirst({
              where: {
                organizationId,
                email: command.email,
                status: { in: ["PENDING", "PENDING_DELIVERY"] },
                expiresAt: { gt: new Date() },
              },
            })
          )
            throw new AccessError("CONFLICT");
          const invitation = await tx.invitation.create({
            data: {
              organizationId,
              email: command.email,
              role: command.role,
              invitedBy: session.userId,
              tokenHash: invitationHash(token),
              expiresAt: new Date(Date.now() + 48 * 3600000),
            },
          });
          await audit(
            tx,
            organizationId,
            session.userId,
            "INVITATION_CREATED",
            invitation.id,
          );
          return invitation;
        },
      );
      try {
        await deliver({ to: invitation.email, token, locale: command.locale });
        await db.invitation.updateMany({
          where: { id: invitation.id, status: "PENDING_DELIVERY" },
          data: { status: "PENDING" },
        });
      } catch {
        await db.invitation.updateMany({
          where: { id: invitation.id, status: "PENDING_DELIVERY" },
          data: { status: "REVOKED" },
        });
        throw new Error("MAIL_DELIVERY_FAILED");
      }
      return;
    }
    return withActive(
      sessionId,
      "team.manage",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        if (command.action === "cancel") {
          const invitation = await tx.invitation.findFirst({
            where: { id: command.invitationId, organizationId },
          });
          if (!invitation || !canAssign(membership.role, invitation.role))
            throw new AccessError("FORBIDDEN");
          await tx.invitation.updateMany({
            where: {
              id: invitation.id,
              organizationId,
              status: { in: ["PENDING", "PENDING_DELIVERY"] },
            },
            data: { status: "REVOKED" },
          });
          await audit(
            tx,
            organizationId,
            session.userId,
            "INVITATION_REVOKED",
            invitation.id,
          );
          return;
        }
        const target = await tx.membership.findFirst({
          where: { id: command.memberId, organizationId },
        });
        if (
          !target ||
          !canAssign(membership.role, target.role) ||
          (command.action === "role" &&
            !canAssign(membership.role, command.role))
        )
          throw new AccessError("FORBIDDEN");
        if (
          target.role === "OWNER" &&
          (command.action === "revoke" || command.role !== "OWNER") &&
          (await tx.membership.count({
            where: { organizationId, role: "OWNER" },
          })) <= 1
        )
          throw new AccessError("LAST_OWNER");
        if (command.action === "revoke") {
          await tx.membership.delete({ where: { id: target.id } });
          await tx.session.updateMany({
            where: {
              userId: target.userId,
              activeOrganizationId: organizationId,
            },
            data: { activeOrganizationId: null },
          });
          await tx.invitation.updateMany({
            where: {
              organizationId,
              invitedBy: target.userId,
              status: { in: ["PENDING", "PENDING_DELIVERY"] },
            },
            data: { status: "REVOKED" },
          });
        } else {
          await tx.membership.update({
            where: { id: target.id },
            data: { role: command.role },
          });
          // Old invitations must not survive a change in issuer authority.
          await tx.invitation.updateMany({
            where: {
              organizationId,
              invitedBy: target.userId,
              status: { in: ["PENDING", "PENDING_DELIVERY"] },
            },
            data: { status: "REVOKED" },
          });
        }
        await audit(
          tx,
          organizationId,
          session.userId,
          command.action === "revoke"
            ? "MEMBERSHIP_REVOKED"
            : `ROLE_CHANGED_${command.role}`,
          target.id,
        );
      },
    );
  }
  return { snapshot, execute, withActive };
}
