import type { PrismaClient } from "../../generated/prisma/client";
import { requireActor, requireMembership } from "../workspaces/service";

/**
 * Getting-started checklist derived from real workspace data, so the guided
 * tour can tick steps off automatically (no manual "mark as done").
 */
export function onboardingService(db: PrismaClient) {
  async function progress(sessionId: string) {
    const session = await requireActor(db, sessionId);
    const organizationId = session.activeOrganizationId;
    if (!organizationId)
      return {
        role: null,
        steps: {
          workspace: false,
          team: false,
          company: false,
          counterparty: false,
          transaction: false,
          approved: false,
          exported: false,
        },
      };
    const { membership } = await requireMembership(
      db,
      sessionId,
      organizationId,
    );
    const where = { organizationId };
    const [
      members,
      invitations,
      companies,
      counterparties,
      transactions,
      approved,
      exports,
    ] = await Promise.all([
      db.membership.count({ where }),
      db.invitation.count({ where }),
      db.company.count({ where }),
      db.counterparty.count({ where }),
      db.transaction.count({ where }),
      db.transaction.count({
        where: {
          organizationId,
          status: {
            in: [
              "APPROVED",
              "EXPORTED",
              "CORETAX_ACCEPTED",
              "CORETAX_REJECTED",
            ],
          },
        },
      }),
      db.xmlExportBatch.count({ where }),
    ]);
    return {
      role: membership.role,
      steps: {
        workspace: true,
        team: members > 1 || invitations > 0,
        company: companies > 0,
        counterparty: counterparties > 0,
        transaction: transactions > 0,
        approved: approved > 0,
        exported: exports > 0,
      },
    };
  }
  return { progress };
}
