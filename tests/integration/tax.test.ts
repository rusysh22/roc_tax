import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import { intakeService } from "../../apps/web/src/server/intake/service";
import { localDocumentStorage } from "../../apps/web/src/server/intake/storage";
import { taxService } from "../../apps/web/src/server/tax/service";
import { trialService } from "../../apps/web/src/server/trial/service";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const storageDir = mkdtempSync(
  path.join(os.tmpdir(), "serentax-tax-integration-"),
);
const crypto = createTaxCrypto("synthetic-tax-integration-secret-0123456789");
const intake = intakeService(db, crypto, localDocumentStorage(storageDir));
const tax = taxService(db);
const trials = trialService(db);

const users: string[] = [];
const orgs: string[] = [];
const ruleIds: string[] = [];

async function createActor(
  role: Role = "OWNER",
  platformRole: "NONE" | "SUPERADMIN" = "NONE",
) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      platformRole,
    },
  });
  const org = await db.organization.create({
    data: {
      name: "Synthetic Tax Org",
      legalName: "Synthetic Tax Entity",
      memberships: { create: { userId, role } },
    },
  });
  orgs.push(org.id);
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: org.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { userId, sessionId, organizationId: org.id };
}

async function addMember(
  organizationId: string,
  role: Role,
  activateTrial = false,
) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
    },
  });
  await db.membership.create({
    data: { organizationId, userId, role },
  });
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: organizationId,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  if (activateTrial) await trials.activate(sessionId);
  return { userId, sessionId };
}

afterAll(async () => {
  await db.trialUsage.deleteMany({ where: { userId: { in: users } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.taxRule.deleteMany({ where: { id: { in: ruleIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
  rmSync(storageDir, { recursive: true, force: true });
});

describe("tax rule engine & review workflow integration on real PostgreSQL", () => {
  it("blocks production approval on NON_PRODUCTION_TEST fixtures and enforces SME review metadata", async () => {
    const owner = await createActor("OWNER");
    const preparer = await addMember(owner.organizationId, "PREPARER", true);
    const admin = await createActor("OWNER", "SUPERADMIN");

    await expect(
      tax.mutateRule(owner.sessionId, {
        action: "create",
        code: "UNAUTH",
        version: 1,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        objectCode: "OBJ-1",
        name: "Unauthorized",
        effectiveFrom: "2026-01-01",
        rateNumerator: 2,
        rateDenominator: 100,
        sourceCitation: "Unverified",
        catalogStatus: "NON_PRODUCTION_TEST",
      }),
    ).rejects.toThrow("FORBIDDEN");

    await expect(
      tax.mutateRule(admin.sessionId, {
        action: "create",
        code: `NO-SME-${randomUUID().slice(0, 6).toUpperCase()}`,
        version: 1,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        objectCode: "OBJ-1",
        name: "Missing SME reviewer",
        effectiveFrom: "2026-01-01",
        rateNumerator: 2,
        rateDenominator: 100,
        sourceCitation: "Missing SME",
        catalogStatus: "SME_APPROVED",
      }),
    ).rejects.toThrow("SME_REVIEW_REQUIRED");

    const code = `NONPROD-${randomUUID().slice(0, 6).toUpperCase()}`;
    const objCode = `NP-${randomUUID().slice(0, 6).toUpperCase()}`;
    const nonProdRule = (await tax.mutateRule(admin.sessionId, {
      action: "create",
      code,
      version: 1,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: objCode,
      name: "Synthetic NON_PRODUCTION fixture",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
      rateNumerator: 2,
      rateDenominator: 100,
      sourceCitation: "NON_PRODUCTION synthetic fixture",
      catalogStatus: "NON_PRODUCTION_TEST",
    })) as { id: string };
    ruleIds.push(nonProdRule.id);

    const company = await intake.mutateCompany(owner.sessionId, {
      action: "create",
      company: { name: "Tax Branch", legalName: "PT Synthetic Tax" },
    });
    const cp = await intake.mutateCounterparty(owner.sessionId, {
      action: "create",
      counterparty: {
        kind: "VENDOR",
        name: "PT Synthetic Vendor",
        identityType: "NPWP",
        identity: "9876543210987654",
        countryCode: "ID",
      },
    });
    const created = (await intake.createTransaction(preparer.sessionId, {
      action: "create",
      idempotencyKey: randomUUID(),
      draft: {
        companyId: company.id,
        counterpartyId: cp.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "TAX-NP-01",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [
          { description: "Service", quantity: "1", unitPrice: "200000.00" },
        ],
      },
      acknowledgeDuplicates: false,
    })) as { transactionId: string };

    const evalRes = (await tax.executeReviewCommand(
      preparer.sessionId,
      created.transactionId,
      {
        action: "evaluate",
        taxFamily: "PPH_UNIFIKASI_BPPU",
        objectCode: objCode,
        allowNonProductionPreview: true,
      },
    )) as { taxAmount: string; blockers: { code: string }[]; status: string };

    expect(evalRes.taxAmount).toBe("4000.00");
    expect(evalRes.blockers.map((b) => b.code)).toContain(
      "RULE_NOT_SME_APPROVED",
    );
    expect(evalRes.status).toBe("DRAFT");

    await expect(
      tax.executeReviewCommand(preparer.sessionId, created.transactionId, {
        action: "submit",
        version: 1,
      }),
    ).rejects.toThrow("INVALID_STATE");
  });

  it("runs full submit -> review -> approve -> immutable snapshot -> reopen workflow and enforces segregation of duties", async () => {
    const admin = await createActor("OWNER", "SUPERADMIN");
    const code = `SME-TEST-${randomUUID().slice(0, 6).toUpperCase()}`;
    const objCode = `SMEOBJ-${randomUUID().slice(0, 6).toUpperCase()}`;
    const v1 = (await tax.mutateRule(admin.sessionId, {
      action: "create",
      code,
      version: 1,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: objCode,
      name: "Synthetic Test Rule v1 (3%)",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
      rateNumerator: 3,
      rateDenominator: 100,
      roundingMode: "HALF_UP",
      sourceCitation: "Synthetic SME-approved test citation v1",
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "Synthetic Tax SME",
    })) as { id: string };
    ruleIds.push(v1.id);

    const owner = await createActor("OWNER");
    const preparer = await addMember(owner.organizationId, "PREPARER", true);
    const reviewer = await addMember(owner.organizationId, "REVIEWER");
    const approver = await addMember(owner.organizationId, "APPROVER");

    const company = await intake.mutateCompany(owner.sessionId, {
      action: "create",
      company: { name: "Main Co", legalName: "PT Main Synthetic" },
    });
    const cp = await intake.mutateCounterparty(owner.sessionId, {
      action: "create",
      counterparty: {
        kind: "VENDOR",
        name: "PT Vendor",
        identityType: "NPWP",
        identity: "9876543210987654",
        countryCode: "ID",
      },
    });
    const created = (await intake.createTransaction(preparer.sessionId, {
      action: "create",
      idempotencyKey: randomUUID(),
      draft: {
        companyId: company.id,
        counterpartyId: cp.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "SME-FLOW-01",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [
          { description: "Audit", quantity: "1", unitPrice: "500000.00" },
        ],
      },
      acknowledgeDuplicates: false,
    })) as { transactionId: string };

    const eval1 = (await tax.executeReviewCommand(
      preparer.sessionId,
      created.transactionId,
      {
        action: "evaluate",
        taxFamily: "PPH_UNIFIKASI_BPPU",
        objectCode: objCode,
      },
    )) as { status: string; taxAmount: string; blockers: unknown[] };
    expect(eval1.status).toBe("VALIDATED");
    expect(eval1.taxAmount).toBe("15000.00");
    expect(eval1.blockers).toEqual([]);

    const submitted = (await tax.executeReviewCommand(
      preparer.sessionId,
      created.transactionId,
      { action: "submit", version: 1 },
    )) as { status: string; version: number };
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.version).toBe(2);

    // Revision locking: SUBMITTED draft cannot be edited directly.
    await expect(
      intake.mutateTransaction(preparer.sessionId, created.transactionId, {
        action: "update",
        version: 2,
        draft: {
          companyId: company.id,
          counterpartyId: cp.id,
          taxFamily: "PPH_UNIFIKASI_BPPU",
          documentType: "SUPPLIER_INVOICE",
          invoiceNumber: "SME-FLOW-01-EDITED",
          documentDate: "2026-11-16",
          taxPeriod: "2026-11",
          currency: "IDR",
          lines: [
            { description: "Audit", quantity: "1", unitPrice: "500000.00" },
          ],
        },
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("INVALID_STATE");

    // Reviewer requests changes with reason.
    const changed = (await tax.executeReviewCommand(
      reviewer.sessionId,
      created.transactionId,
      {
        action: "request_changes",
        version: 2,
        reason: "Please verify invoice description",
      },
    )) as { status: string; version: number };
    expect(changed.status).toBe("CHANGES_REQUESTED");
    expect(changed.version).toBe(3);

    // Preparer updates amount, re-evaluates (visible diff), and re-submits.
    await intake.mutateTransaction(preparer.sessionId, created.transactionId, {
      action: "update",
      version: 3,
      draft: {
        companyId: company.id,
        counterpartyId: cp.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "SME-FLOW-01",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [
          { description: "Audit v2", quantity: "1", unitPrice: "600000.00" },
        ],
      },
      acknowledgeDuplicates: false,
    });
    // Stale evaluation check: submitting before re-evaluating fails!
    await expect(
      tax.executeReviewCommand(preparer.sessionId, created.transactionId, {
        action: "submit",
        version: 4,
      }),
    ).rejects.toThrow("INVALID_STATE");

    const eval2 = (await tax.executeReviewCommand(
      preparer.sessionId,
      created.transactionId,
      { action: "evaluate", objectCode: objCode },
    )) as { status: string; taxAmount: string };
    expect(eval2.status).toBe("VALIDATED");
    expect(eval2.taxAmount).toBe("18000.00");

    await tax.executeReviewCommand(preparer.sessionId, created.transactionId, {
      action: "submit",
      version: 4,
    });

    // Self-approval blocked under STRICT_SEPARATION even if user also holds APPROVER.
    await db.membership.update({
      where: {
        organizationId_userId: {
          organizationId: owner.organizationId,
          userId: preparer.userId,
        },
      },
      data: { role: "APPROVER" },
    });
    await expect(
      tax.executeReviewCommand(preparer.sessionId, created.transactionId, {
        action: "approve",
        version: 5,
        soleUserOverrideAck: true,
      }),
    ).rejects.toThrow("SELF_APPROVAL_BLOCKED");

    // Distinct Approver succeeds and locks immutable snapshot.
    const approved = (await tax.executeReviewCommand(
      approver.sessionId,
      created.transactionId,
      { action: "approve", version: 5 },
    )) as { status: string; snapshotId: string; version: number };
    expect(approved.status).toBe("APPROVED");

    // Publish rule v2 (5%): historical snapshot remains untouched at 3% / 18000.00.
    const v2 = (await tax.mutateRule(admin.sessionId, {
      action: "create",
      code,
      version: 2,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: objCode,
      name: "Synthetic Test Rule v2 (5%)",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
      rateNumerator: 5,
      rateDenominator: 100,
      roundingMode: "HALF_UP",
      sourceCitation: "Synthetic SME-approved test citation v2",
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "Synthetic Tax SME",
    })) as { id: string };
    ruleIds.push(v2.id);

    const stateAfterRuleUpdate = await tax.getTransactionTaxState(
      approver.sessionId,
      created.transactionId,
    );
    expect(stateAfterRuleUpdate.snapshots[0].ruleVersion).toBe(1);
    expect(stateAfterRuleUpdate.snapshots[0].taxAmount).toBe("18000.00");

    // Snapshot & evaluation rows cannot be updated directly (DB trigger).
    await expect(
      db.taxEvaluationSnapshot.update({
        where: { id: approved.snapshotId },
        data: { taxAmount: "1.00" },
      }),
    ).rejects.toThrow();

    // Controlled reopen preserves snapshot and moves status to CHANGES_REQUESTED.
    const reopened = (await tax.executeReviewCommand(
      approver.sessionId,
      created.transactionId,
      { action: "reopen", version: 6, reason: "Reopen for v2 reassessment" },
    )) as { status: string; version: number };
    expect(reopened.status).toBe("CHANGES_REQUESTED");

    // SOLE_USER_EXCEPTION policy allows self-approval only with explicit ack.
    await tax.updateTaxPolicy(owner.sessionId, {
      segregationPolicy: "SOLE_USER_EXCEPTION",
    });
    await db.membership.update({
      where: {
        organizationId_userId: {
          organizationId: owner.organizationId,
          userId: preparer.userId,
        },
      },
      data: { role: "PREPARER" },
    });
    await tax.executeReviewCommand(preparer.sessionId, created.transactionId, {
      action: "evaluate",
      objectCode: objCode,
    });
    await tax.executeReviewCommand(preparer.sessionId, created.transactionId, {
      action: "submit",
      version: 7,
    });
    await db.membership.update({
      where: {
        organizationId_userId: {
          organizationId: owner.organizationId,
          userId: preparer.userId,
        },
      },
      data: { role: "APPROVER" },
    });
    await expect(
      tax.executeReviewCommand(preparer.sessionId, created.transactionId, {
        action: "approve",
        version: 8,
        soleUserOverrideAck: false,
      }),
    ).rejects.toThrow("SOLE_USER_ACK_REQUIRED");

    const soleApproved = (await tax.executeReviewCommand(
      preparer.sessionId,
      created.transactionId,
      { action: "approve", version: 8, soleUserOverrideAck: true },
    )) as { soleUserExceptionUsed: boolean };
    expect(soleApproved.soleUserExceptionUsed).toBe(true);

    // Cross-tenant isolation check.
    const other = await createActor("OWNER");
    await expect(
      tax.getTransactionTaxState(other.sessionId, created.transactionId),
    ).rejects.toThrow("NOT_FOUND");
  });
});
