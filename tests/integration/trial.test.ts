import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import {
  trialService,
  type PersistDraft,
} from "../../apps/web/src/server/trial/service";
import {
  jakartaDate,
  TRIAL_DURATION_MS,
} from "../../apps/web/src/server/trial/state";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const service = trialService(db);
const users: string[] = [];
const orgs: string[] = [];
// Internal test-only neutral draft. Never installed by production migrations or exposed via HTTP.
const fixtureSchema = z
  .object({
    reference: z.string().trim().min(1).max(100),
    amount: z.string().regex(/^(0|[1-9]\d{0,15})\.\d{2}$/),
    currency: z.literal("IDR"),
    date: z.iso.date(),
  })
  .strict();
function request(key = randomUUID(), reference = "SYNTHETIC-TEST-ONLY") {
  const payload = fixtureSchema.parse({
    reference,
    amount: "100.00",
    currency: "IDR",
    date: "2026-11-16",
  });
  const persist: PersistDraft = async (tx, context) => {
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO test_trial_draft (id, "userId", "organizationId", reference, amount, currency, "documentDate") VALUES (${id}, ${context.userId}, ${context.organizationId}, ${payload.reference}, ${payload.amount}::numeric, ${payload.currency}, ${payload.date}::date)`;
    return { id };
  };
  return {
    input: {
      idempotencyKey: key,
      payloadFingerprint: createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
    },
    persist,
  };
}
async function actor(verified = true, role: "PREPARER" | "OWNER" = "PREPARER") {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: "Synthetic trial user",
      email: `${userId}@example.test`,
      emailVerified: verified,
    },
  });
  const organization = await db.organization.create({
    data: {
      name: "Synthetic trial workspace",
      legalName: "Synthetic only",
      memberships: { create: { userId, role } },
    },
  });
  orgs.push(organization.id);
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: organization.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { userId, sessionId, organizationId: organization.id };
}
async function seedTrial(userId: string, expiresAt: Date) {
  await db.trialAccount.create({
    data: {
      userId,
      activatedAt: new Date(expiresAt.getTime() - TRIAL_DURATION_MS),
      expiresAt,
    },
  });
}
async function seedReceipt(
  userId: string,
  organizationId: string,
  daysAgo: number,
  slot: number,
) {
  const at = new Date(Date.now() - daysAgo * 86400000);
  await db.trialUsage.create({
    data: {
      userId,
      organizationId,
      idempotencyKey: randomUUID(),
      transactionId: randomUUID(),
      requestHash: "0".repeat(64),
      jakartaDate: jakartaDate(at),
      createdAt: at,
      slot,
    },
  });
}
beforeAll(async () => {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS test_trial_draft (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, "organizationId" text NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE, reference text NOT NULL CHECK(length(reference)>0), amount numeric(20,2) NOT NULL CHECK(amount>=0), currency char(3) NOT NULL, "documentDate" date NOT NULL)`,
  );
});
afterAll(async () => {
  await db.trialUsage.deleteMany({ where: { userId: { in: users } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
describe("atomic trial on real PostgreSQL", () => {
  it("uses UTC sessions and preserves instants despite a non-UTC database default", async () => {
    const at = new Date("2026-11-13T22:42:37.244Z");
    const [row] = await db.$queryRaw<
      { timezone: string; instant: Date; day: string }[]
    >`SELECT current_setting('TimeZone') AS timezone, ${at}::timestamptz AS instant, to_char(${at}::timestamptz AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day`;
    expect(row.timezone).toBe("UTC");
    expect(row.instant.toISOString()).toBe(at.toISOString());
    expect(row.day).toBe("2026-11-14");
    const [clock] = await db.$queryRaw<
      { now: Date; epoch: string }[]
    >`SELECT clock_timestamp() AS now, extract(epoch FROM clock_timestamp())::text AS epoch`;
    expect(
      Math.abs(clock.now.getTime() - Number(clock.epoch) * 1000),
    ).toBeLessThan(10);
  });
  it("activates only verified accounts, once even under 10 simultaneous requests", async () => {
    const unverified = await actor(false);
    await expect(service.activate(unverified.sessionId)).rejects.toThrow(
      "UNVERIFIED",
    );
    const a = await actor();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.activate(a.sessionId)),
    );
    expect(new Set(results.map((result) => result.activatedAt)).size).toBe(1);
    expect(
      new Date(results[0].expiresAt!).getTime() -
        new Date(results[0].activatedAt!).getTime(),
    ).toBe(TRIAL_DURATION_MS);
    expect(await db.trialAccount.count({ where: { userId: a.userId } })).toBe(
      1,
    );
    await expect(
      db.trialAccount.update({
        where: { userId: a.userId },
        data: { activatedAt: new Date() },
      }),
    ).rejects.toThrow();
  });
  it("commits exactly one draft across 10 concurrent requests in two workspaces", async () => {
    const a = await actor();
    await service.activate(a.sessionId);
    const second = await db.organization.create({
      data: {
        name: "Concurrent synthetic",
        legalName: "Synthetic only",
        memberships: { create: { userId: a.userId, role: "PREPARER" } },
      },
    });
    orgs.push(second.id);
    const sessionId = randomUUID();
    await db.session.create({
      data: {
        id: sessionId,
        token: randomUUID(),
        userId: a.userId,
        activeOrganizationId: second.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) => {
        const r = request();
        return service.create(
          index % 2 ? sessionId : a.sessionId,
          r.input,
          r.persist,
        );
      }),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results
        .filter((result) => result.status === "rejected")
        .every((result) => result.reason.message === "DAILY_LIMIT"),
    ).toBe(true);
    expect(await db.trialUsage.count({ where: { userId: a.userId } })).toBe(1);
    const rows = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) AS count FROM test_trial_draft WHERE "userId"=${a.userId}`;
    expect(Number(rows[0].count)).toBe(1);
  });
  it("replays one key concurrently without reinserting or consuming quota", async () => {
    const a = await actor();
    await service.activate(a.sessionId);
    const r = request();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.create(a.sessionId, r.input, r.persist),
      ),
    );
    expect(new Set(results.map((result) => result.transactionId)).size).toBe(1);
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    const altered = request(r.input.idempotencyKey, "DIFFERENT");
    await expect(
      service.create(a.sessionId, altered.input, altered.persist),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("does not refund deletion/edit or recreate deleted drafts on retry", async () => {
    const a = await actor();
    await service.activate(a.sessionId);
    const r = request();
    const created = await service.create(a.sessionId, r.input, r.persist);
    await expect(
      db.trialUsage.update({
        where: { transactionId: created.transactionId },
        data: { slot: 2 },
      }),
    ).rejects.toThrow();
    await db.$executeRaw`UPDATE test_trial_draft SET reference='SYNTHETIC-EDIT' WHERE id=${created.transactionId}`;
    expect((await service.snapshot(a.sessionId)).remainingToday).toBe(0);
    await db.$executeRaw`DELETE FROM test_trial_draft WHERE id=${created.transactionId}`;
    expect(await service.create(a.sessionId, r.input, r.persist)).toEqual({
      ...created,
      replay: true,
    });
    const another = request();
    await expect(
      service.create(a.sessionId, another.input, another.persist),
    ).rejects.toThrow("DAILY_LIMIT");
    expect(await db.trialUsage.count({ where: { userId: a.userId } })).toBe(1);
  });
  it("shares account quota across workspaces and rejects cross-workspace key reuse", async () => {
    const a = await actor();
    await service.activate(a.sessionId);
    const r = request();
    await service.create(a.sessionId, r.input, r.persist);
    const second = await db.organization.create({
      data: {
        name: "Second synthetic",
        legalName: "Synthetic",
        memberships: { create: { userId: a.userId, role: "PREPARER" } },
      },
    });
    orgs.push(second.id);
    await db.session.update({
      where: { id: a.sessionId },
      data: { activeOrganizationId: second.id },
    });
    await expect(
      service.create(a.sessionId, r.input, r.persist),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const other = request();
    await expect(
      service.create(a.sessionId, other.input, other.persist),
    ).rejects.toThrow("DAILY_LIMIT");
    await db.organization.delete({ where: { id: a.organizationId } });
    expect((await service.snapshot(a.sessionId)).remainingToday).toBe(0);
  });
  it("enforces 3 lifetime slots even when a fourth local date fits inside 72 hours", async () => {
    const a = await actor();
    await seedTrial(a.userId, new Date(Date.now() + 3600000));
    await seedReceipt(a.userId, a.organizationId, 2, 1);
    await seedReceipt(a.userId, a.organizationId, 1, 2);
    const r = request();
    await service.create(a.sessionId, r.input, r.persist);
    expect((await service.snapshot(a.sessionId)).state).toBe("TOTAL_LIMIT");
    const more = request();
    await expect(
      service.create(a.sessionId, more.input, more.persist),
    ).rejects.toThrow("TOTAL_LIMIT");
    await expect(
      seedReceipt(a.userId, a.organizationId, 3, 4),
    ).rejects.toThrow();
  });
  it("rejects unactivated/expired trials and activation cannot extend expiry", async () => {
    const a = await actor();
    const r = request();
    await expect(
      service.create(a.sessionId, r.input, r.persist),
    ).rejects.toThrow("NOT_ACTIVATED");
    const expiry = new Date(Date.now() - 1);
    await seedTrial(a.userId, expiry);
    expect((await service.activate(a.sessionId)).expiresAt).toBe(
      expiry.toISOString(),
    );
    await expect(
      service.create(a.sessionId, r.input, r.persist),
    ).rejects.toThrow("EXPIRED");
  });
  it("rolls back both persisted draft and quota on persistence failure, then permits retry", async () => {
    const a = await actor();
    await service.activate(a.sessionId);
    const r = request();
    await expect(
      service.create(a.sessionId, r.input, async (tx, context) => {
        await r.persist(tx, context);
        throw new Error("SYNTHETIC_FAILURE");
      }),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect((await service.snapshot(a.sessionId)).usedTotal).toBe(0);
    const rows = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) AS count FROM test_trial_draft WHERE "userId"=${a.userId}`;
    expect(Number(rows[0].count)).toBe(0);
    expect((await service.create(a.sessionId, r.input, r.persist)).replay).toBe(
      false,
    );
  });
  it("rolls back a draft when the trial expires during persistence", async () => {
    const a = await actor();
    await seedTrial(a.userId, new Date(Date.now() + 1500));
    let persisted = false;
    const r = request();
    await expect(
      service.create(a.sessionId, r.input, async (tx, context) => {
        const draft = await r.persist(tx, context);
        persisted = true;
        await tx.$executeRaw`SELECT pg_sleep(1.8)`;
        return draft;
      }),
    ).rejects.toThrow("EXPIRED");
    expect(persisted).toBe(true);
    expect(await db.trialUsage.count({ where: { userId: a.userId } })).toBe(0);
    const rows = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) AS count FROM test_trial_draft WHERE "userId"=${a.userId}`;
    expect(Number(rows[0].count)).toBe(0);
  });
  it("checks roles and membership even for successful-key retries", async () => {
    const owner = await actor(true, "OWNER");
    await service.activate(owner.sessionId);
    const r = request();
    await expect(
      service.create(owner.sessionId, r.input, r.persist),
    ).rejects.toThrow("FORBIDDEN");
    const a = await actor();
    await service.activate(a.sessionId);
    await service.create(a.sessionId, r.input, r.persist);
    await db.membership.deleteMany({ where: { userId: a.userId } });
    await expect(
      service.create(a.sessionId, r.input, r.persist),
    ).rejects.toThrow("FORBIDDEN");
    await db.session.delete({ where: { id: a.sessionId } });
    await expect(service.snapshot(a.sessionId)).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });
  it("validates a neutral draft before any allowance is consumed", async () => {
    expect(() =>
      fixtureSchema.parse({
        reference: "",
        amount: "-1.00",
        currency: "IDR",
        date: "bad",
      }),
    ).toThrow();
    const a = await actor();
    await service.activate(a.sessionId);
    await expect(
      service.create(
        a.sessionId,
        { idempotencyKey: "bad", payloadFingerprint: "" },
        request().persist,
      ),
    ).rejects.toThrow();
    expect((await service.snapshot(a.sessionId)).usedTotal).toBe(0);
  });
});
