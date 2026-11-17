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
import { ocrService } from "../../apps/web/src/server/ocr/service";
import { trialService } from "../../apps/web/src/server/trial/service";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const storageDir = mkdtempSync(
  path.join(os.tmpdir(), "serentax-ocr-integration-"),
);
const crypto = createTaxCrypto("synthetic-ocr-integration-secret-0123456789");
const storage = localDocumentStorage(storageDir);
const intake = intakeService(db, crypto, storage);
const trials = trialService(db);
const fakeEnv: NodeJS.ProcessEnv = {
  SYNTHETIC_OCR_SECRET: "synthetic-never-leaked-token-999999999999",
};
const ocr = ocrService(db, storage, { env: fakeEnv, retryBaseDelayMs: 1 });

const users: string[] = [];
const orgs: string[] = [];
const providerSlugs: string[] = [];

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
      name: "Synthetic OCR org",
      legalName: "Synthetic OCR entity",
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

async function createDraftWithDoc(
  ownerSession: string,
  preparerSession: string,
  pdfBody: string,
  fileName = "invoice.pdf",
) {
  const company = await intake.mutateCompany(ownerSession, {
    action: "create",
    company: { name: "OCR Branch", legalName: "PT Synthetic OCR" },
  });
  const cp = await intake.mutateCounterparty(ownerSession, {
    action: "create",
    counterparty: {
      kind: "VENDOR",
      name: "PT Synthetic Vendor",
      identityType: "NPWP",
      identity: "9876543210987654",
      countryCode: "ID",
    },
  });
  const created = (await intake.createTransaction(preparerSession, {
    action: "create",
    idempotencyKey: randomUUID(),
    draft: {
      companyId: company.id,
      counterpartyId: cp.id,
      taxFamily: "UNCLASSIFIED",
      documentType: "SUPPLIER_INVOICE",
      invoiceNumber: "MANUAL-INIT-01",
      documentDate: "2026-11-16",
      taxPeriod: "2026-11",
      currency: "IDR",
      lines: [{ description: "Initial", quantity: "1", unitPrice: "1000.00" }],
    },
    acknowledgeDuplicates: false,
  })) as { transactionId: string };
  const doc = await intake.attachDocument(
    preparerSession,
    created.transactionId,
    {
      bytes: Buffer.from(pdfBody, "utf-8"),
      declaredType: "application/pdf",
      fileName,
    },
  );
  return { transactionId: created.transactionId, documentId: doc.id };
}

afterAll(async () => {
  await db.ocrProviderConfig.deleteMany({
    where: { slug: { in: providerSlugs } },
  });
  await db.trialUsage.deleteMany({ where: { userId: { in: users } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
  rmSync(storageDir, { recursive: true, force: true });
});

describe("configurable OCR provider integration on real PostgreSQL", () => {
  it("guards superadmin provider registry, enforces vendor approval and consent, and never leaks secrets", async () => {
    const owner = await createActor("OWNER", "NONE");
    const createdUser = await db.user.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    expect(createdUser.platformRole).toBe("NONE");

    await expect(ocr.listProviders(owner.sessionId)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(
      ocr.upsertProvider(owner.sessionId, {
        action: "upsert",
        slug: "unauth",
        displayName: "Unauthorized",
        adapterKey: "SYNTHETIC_TEST",
        model: "m",
        region: "id",
        maxPages: 5,
        timeoutMs: 5000,
        monthlyPageCap: 10,
        monthlySpendCapIdr: "1000.00",
        estimatedCostPerPageIdr: "100.00",
        retentionPolicy: "LOCAL_ONLY",
        processorNotice: "",
        vendorApproved: true,
        enabled: true,
      }),
    ).rejects.toThrow("FORBIDDEN");

    const admin = await createActor("OWNER", "SUPERADMIN");
    const unapprovedSlug = `unapproved-${randomUUID().slice(0, 6)}`;
    const extSlug = `ext-${randomUUID().slice(0, 6)}`;
    const synthSlug = `synth-${randomUUID().slice(0, 6)}`;
    providerSlugs.push(unapprovedSlug, extSlug, synthSlug);

    // SSRF endpoint rejected even for superadmin.
    await expect(
      ocr.upsertProvider(admin.sessionId, {
        action: "upsert",
        slug: extSlug,
        displayName: "SSRF Attempt",
        adapterKey: "EXTERNAL_NOT_CONFIGURED",
        endpointUrl: "http://169.254.169.254/latest",
        model: "ext",
        region: "id",
        maxPages: 5,
        timeoutMs: 5000,
        monthlyPageCap: 10,
        monthlySpendCapIdr: "1000.00",
        estimatedCostPerPageIdr: "100.00",
        retentionPolicy: "ZERO_RETENTION_REQUIRED",
        processorNotice: "",
        vendorApproved: false,
        enabled: false,
      }),
    ).rejects.toThrow("INVALID_ENDPOINT_URL");

    await ocr.upsertProvider(admin.sessionId, {
      action: "upsert",
      slug: unapprovedSlug,
      displayName: "Unapproved Vendor",
      adapterKey: "SYNTHETIC_TEST",
      model: "m",
      region: "id-jakarta",
      maxPages: 5,
      timeoutMs: 5000,
      monthlyPageCap: 10,
      monthlySpendCapIdr: "1000.00",
      estimatedCostPerPageIdr: "100.00",
      retentionPolicy: "LOCAL_ONLY",
      processorNotice: "Pending review",
      vendorApproved: false,
      enabled: true,
    });
    await ocr.upsertProvider(admin.sessionId, {
      action: "upsert",
      slug: extSlug,
      displayName: "External Unconfigured",
      adapterKey: "EXTERNAL_NOT_CONFIGURED",
      endpointUrl: "https://ocr.vendor.example/v1",
      secretRef: "SYNTHETIC_OCR_SECRET",
      model: "ext-v1",
      region: "ap-southeast-1",
      maxPages: 10,
      timeoutMs: 15000,
      monthlyPageCap: 100,
      monthlySpendCapIdr: "10000.00",
      estimatedCostPerPageIdr: "100.00",
      retentionPolicy: "ZERO_RETENTION_REQUIRED",
      processorNotice: "Not yet configured",
      vendorApproved: true,
      enabled: true,
    });
    await ocr.upsertProvider(admin.sessionId, {
      action: "upsert",
      slug: synthSlug,
      displayName: "Synthetic Test OCR",
      adapterKey: "SYNTHETIC_TEST",
      secretRef: "SYNTHETIC_OCR_SECRET",
      model: "synthetic-v1",
      region: "local-test",
      maxPages: 5,
      timeoutMs: 5000,
      monthlyPageCap: 10,
      monthlySpendCapIdr: "500.00",
      estimatedCostPerPageIdr: "100.00",
      retentionPolicy: "LOCAL_ONLY",
      processorNotice: "Synthetic local testing only",
      vendorApproved: true,
      enabled: true,
    });

    const providerList = await ocr.listProviders(admin.sessionId);
    expect(JSON.stringify(providerList)).not.toContain(
      "synthetic-never-leaked-token",
    );

    // Default tenant setting is NONE_MANUAL.
    const initialSettings = await ocr.getOrgOcrSettings(owner.sessionId);
    expect(initialSettings.effectiveStatus).toBe("NONE_MANUAL");
    expect(JSON.stringify(initialSettings)).not.toContain(
      "SYNTHETIC_OCR_SECRET",
    );

    await expect(
      ocr.updateOrgOcrSettings(owner.sessionId, {
        providerSlug: unapprovedSlug,
        externalAiConsent: true,
      }),
    ).rejects.toThrow("VENDOR_NOT_APPROVED");
    await expect(
      ocr.updateOrgOcrSettings(owner.sessionId, {
        providerSlug: extSlug,
        externalAiConsent: true,
      }),
    ).rejects.toThrow("OCR_NOT_CONFIGURED");
    await expect(
      ocr.updateOrgOcrSettings(owner.sessionId, {
        providerSlug: synthSlug,
        externalAiConsent: false,
      }),
    ).rejects.toThrow("CONSENT_REQUIRED");

    const updated = await ocr.updateOrgOcrSettings(owner.sessionId, {
      providerSlug: synthSlug,
      externalAiConsent: true,
    });
    expect(updated.effectiveStatus).toBe("READY");
  });

  it("runs async OCR, enforces low-confidence verification, handles prompt injection, and leaves trial quota untouched", async () => {
    const admin = await createActor("OWNER", "SUPERADMIN");
    const slug = `synth-run-${randomUUID().slice(0, 6)}`;
    providerSlugs.push(slug);
    await ocr.upsertProvider(admin.sessionId, {
      action: "upsert",
      slug,
      displayName: "Synthetic Run",
      adapterKey: "SYNTHETIC_TEST",
      secretRef: "SYNTHETIC_OCR_SECRET",
      model: "synthetic-v1",
      region: "local",
      maxPages: 5,
      timeoutMs: 5000,
      monthlyPageCap: 20,
      monthlySpendCapIdr: "1000.00",
      estimatedCostPerPageIdr: "100.00",
      retentionPolicy: "LOCAL_ONLY",
      processorNotice: "Test",
      vendorApproved: true,
      enabled: true,
    });

    const owner = await createActor("OWNER");
    const preparer = await addMember(owner.organizationId, "PREPARER", true);

    // With NONE default, enqueue fails cleanly while manual flow still works.
    const { transactionId, documentId } = await createDraftWithDoc(
      owner.sessionId,
      preparer.sessionId,
      "%PDF-1.4\nSYNTHETIC_LOW_CONFIDENCE\nSYNTHETIC_PROMPT_INJECTION\nDATE:2026-11-16\nITEM:Server rack\nQTY:2\nPRICE:250000.00\n",
    );
    await expect(
      ocr.enqueueJob(preparer.sessionId, transactionId, documentId),
    ).rejects.toThrow("OCR_DISABLED_NONE");

    await ocr.updateOrgOcrSettings(owner.sessionId, {
      providerSlug: slug,
      externalAiConsent: true,
    });

    const queued = await ocr.enqueueJob(
      preparer.sessionId,
      transactionId,
      documentId,
    );
    expect(queued.status).toBe("QUEUED");
    // Duplicate enqueue while active is rejected.
    await expect(
      ocr.enqueueJob(preparer.sessionId, transactionId, documentId),
    ).rejects.toThrow("JOB_ALREADY_ACTIVE");

    const processed = await ocr.processNextJob(queued.jobId);
    expect(processed?.status).toBe("SUCCEEDED");
    expect((await trials.snapshot(preparer.sessionId)).usedTotal).toBe(1);

    const view = await ocr.getTransactionOcr(preparer.sessionId, transactionId);
    expect(view.candidates).toHaveLength(1);
    const candidate = view.candidates[0];
    expect(candidate.promptInjectionDetected).toBe(true);
    expect(candidate.extractedFields.invoiceNumber.normalized).toBe(null);
    expect(
      candidate.extractedFields.counterpartyIdentity.requiresVerification,
    ).toBe(true);
    expect(candidate.extractedFields.currency.requiresVerification).toBe(true);

    // Must require explicit human verification checkbox for low-confidence/injected candidates.
    await expect(
      ocr.applyCandidates(
        preparer.sessionId,
        transactionId,
        candidate.id,
        false,
        {
          invoiceNumber: "INV-VERIFIED-99",
          lineDescription: "Server rack",
          quantity: "2",
          unitPrice: "250000.00",
        },
      ),
    ).rejects.toThrow("LOW_CONFIDENCE_VERIFICATION_REQUIRED");

    const applied = await ocr.applyCandidates(
      preparer.sessionId,
      transactionId,
      candidate.id,
      true,
      {
        invoiceNumber: "INV-VERIFIED-99",
        lineDescription: "Server rack",
        quantity: "2",
        unitPrice: "250000.00",
        verifiedCounterpartyIdentity: "9876543210987654",
      },
    );
    expect(applied.totalAmount).toBe("500000.00");
    // Still only 1 trial slot used across draft creation + OCR + candidate correction.
    expect((await trials.snapshot(preparer.sessionId)).usedTotal).toBe(1);

    const detail = await intake.getTransaction(
      preparer.sessionId,
      transactionId,
    );
    expect(detail.transaction.invoiceNumber).toBe("INV-VERIFIED-99");
    expect(
      detail.transaction.events.some(
        (e) => e.action === "OCR_CANDIDATES_APPLIED",
      ),
    ).toBe(true);

    // Cross-tenant access denied.
    const other = await createActor("OWNER");
    await expect(
      ocr.getTransactionOcr(other.sessionId, transactionId),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("retries transient provider errors to DEAD_LETTER, supports dead-letter retry, manual fallback, and spend caps", async () => {
    const admin = await createActor("OWNER", "SUPERADMIN");
    const slug = `synth-retry-${randomUUID().slice(0, 6)}`;
    providerSlugs.push(slug);
    await ocr.upsertProvider(admin.sessionId, {
      action: "upsert",
      slug,
      displayName: "Synthetic Retry & Cap",
      adapterKey: "SYNTHETIC_TEST",
      secretRef: "SYNTHETIC_OCR_SECRET",
      model: "synthetic-v1",
      region: "local",
      maxPages: 5,
      timeoutMs: 5000,
      monthlyPageCap: 2,
      monthlySpendCapIdr: "200.00",
      estimatedCostPerPageIdr: "100.00",
      retentionPolicy: "LOCAL_ONLY",
      processorNotice: "Test",
      vendorApproved: true,
      enabled: true,
    });

    const owner = await createActor("OWNER");
    const preparer = await addMember(owner.organizationId, "PREPARER", true);
    await ocr.updateOrgOcrSettings(owner.sessionId, {
      providerSlug: slug,
      externalAiConsent: true,
    });

    const { transactionId, documentId } = await createDraftWithDoc(
      owner.sessionId,
      preparer.sessionId,
      "%PDF-1.4\nSYNTHETIC_ERROR_RETRYABLE\n",
      "transient.pdf",
    );
    const queued = await ocr.enqueueJob(
      preparer.sessionId,
      transactionId,
      documentId,
    );

    // Attempt 1 & 2 -> FAILED_RETRYABLE, Attempt 3 -> DEAD_LETTER + tx returns to DRAFT for manual fallback.
    expect((await ocr.processNextJob(queued.jobId))?.status).toBe(
      "FAILED_RETRYABLE",
    );
    await new Promise((r) => setTimeout(r, 15));
    expect((await ocr.processNextJob(queued.jobId))?.status).toBe(
      "FAILED_RETRYABLE",
    );
    await new Promise((r) => setTimeout(r, 20));
    expect((await ocr.processNextJob(queued.jobId))?.status).toBe(
      "DEAD_LETTER",
    );

    const afterDead = await intake.getTransaction(
      preparer.sessionId,
      transactionId,
    );
    expect(afterDead.transaction.status).toBe("DRAFT");

    // Manual retry from DEAD_LETTER re-queues and succeeds if doc updated or falls back cleanly.
    const retried = await ocr.retryJob(
      preparer.sessionId,
      transactionId,
      queued.jobId,
    );
    expect(retried.status).toBe("QUEUED");
    const fb = await ocr.fallbackToManual(
      preparer.sessionId,
      transactionId,
      queued.jobId,
    );
    expect(fb.status).toBe("DRAFT");

    // Spend cap: 2nd successful job hits 200.00 IDR cap, 3rd job is blocked with SPEND_CAP_EXCEEDED.
    const okDoc1 = await intake.attachDocument(
      preparer.sessionId,
      transactionId,
      {
        bytes: Buffer.from("%PDF-1.4\nINVOICE:OK-1\n", "utf-8"),
        declaredType: "application/pdf",
        fileName: "ok1.pdf",
      },
    );
    const j1 = await ocr.enqueueJob(
      preparer.sessionId,
      transactionId,
      okDoc1.id,
    );
    expect((await ocr.processNextJob(j1.jobId))?.status).toBe("SUCCEEDED");

    const okDoc2 = await intake.attachDocument(
      preparer.sessionId,
      transactionId,
      {
        bytes: Buffer.from("%PDF-1.4\nINVOICE:OK-2\n", "utf-8"),
        declaredType: "application/pdf",
        fileName: "ok2.pdf",
      },
    );
    const j2 = await ocr.enqueueJob(
      preparer.sessionId,
      transactionId,
      okDoc2.id,
    );
    expect((await ocr.processNextJob(j2.jobId))?.status).toBe("SUCCEEDED");

    const okDoc3 = await intake.attachDocument(
      preparer.sessionId,
      transactionId,
      {
        bytes: Buffer.from("%PDF-1.4\nINVOICE:OK-3\n", "utf-8"),
        declaredType: "application/pdf",
        fileName: "ok3.pdf",
      },
    );
    await expect(
      ocr.enqueueJob(preparer.sessionId, transactionId, okDoc3.id),
    ).rejects.toThrow("SPEND_CAP_EXCEEDED");
  });
});
