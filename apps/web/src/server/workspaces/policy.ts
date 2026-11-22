import { z } from "zod";
export const roles = [
  "OWNER",
  "ADMIN",
  "PREPARER",
  "REVIEWER",
  "APPROVER",
] as const;
export type Role = (typeof roles)[number];
export const permissionList = [
  "team.manage",
  "draft.prepare",
  "tax.review",
  "tax.approve",
  "tax.export",
] as const;
export type Permission = (typeof permissionList)[number];
/** Single source of truth for the role matrix (also rendered in Settings). */
export const rolePermissions: Record<Role, readonly Permission[]> = {
  OWNER: ["team.manage"],
  ADMIN: ["team.manage"],
  PREPARER: ["draft.prepare", "tax.export"],
  REVIEWER: ["tax.review", "tax.export"],
  APPROVER: ["tax.approve", "tax.export"],
};
export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
export function canAssign(actor: Role, next: Role) {
  return (
    actor === "OWNER" ||
    (actor === "ADMIN" && !["OWNER", "ADMIN"].includes(next))
  );
}
export class AccessError extends Error {
  constructor(
    public code:
      | "UNAUTHENTICATED"
      | "UNVERIFIED"
      | "FORBIDDEN"
      | "NO_WORKSPACE"
      | "INVALID_INVITATION"
      | "LAST_OWNER"
      | "CONFLICT"
      | "RATE_LIMITED",
  ) {
    super(code);
  }
}
export const workspaceCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      name: z.string().trim().min(2).max(100),
      legalName: z.string().trim().min(2).max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal("select"),
      organizationId: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("invite"),
      email: z
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      role: z.enum(roles),
      locale: z.enum(["id", "en"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("accept"),
      token: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("role"),
      memberId: z.string().min(1).max(100),
      role: z.enum(roles),
    })
    .strict(),
  z
    .object({
      action: z.literal("revoke"),
      memberId: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("cancel"),
      invitationId: z.string().min(1).max(100),
    })
    .strict(),
]);
export type WorkspaceCommand = z.infer<typeof workspaceCommandSchema>;
