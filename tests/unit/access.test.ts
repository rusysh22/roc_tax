import { describe, expect, it } from "vitest";
import {
  can,
  canAssign,
  workspaceCommandSchema,
} from "../../apps/web/src/server/workspaces/policy";
import { authConfiguration } from "../../apps/web/src/server/auth/config";
import { readJson } from "../../apps/web/src/server/http";
import { accountMessages } from "../../apps/web/src/i18n/account";
describe("access boundaries", () => {
  it("does not give owners tax approval or allow admin escalation", () => {
    expect(can("OWNER", "tax.approve")).toBe(false);
    expect(can("APPROVER", "tax.approve")).toBe(true);
    expect(can("PREPARER", "team.manage")).toBe(false);
    expect(canAssign("ADMIN", "OWNER")).toBe(false);
    expect(canAssign("ADMIN", "ADMIN")).toBe(false);
    expect(canAssign("OWNER", "ADMIN")).toBe(true);
  });
  it("rejects client actor/tenant injection and unrecognized roles", () => {
    expect(
      workspaceCommandSchema.safeParse({
        action: "invite",
        email: "test@example.test",
        locale: "en",
        role: "SUPERADMIN",
      }).success,
    ).toBe(false);
    expect(
      workspaceCommandSchema.safeParse({
        action: "revoke",
        memberId: "x",
        organizationId: "another-tenant",
        userId: "owner",
      }).success,
    ).toBe(false);
  });
  it("rejects unsafe auth configuration and permits explicit loopback development", () => {
    const env = {
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      BETTER_AUTH_SECRET: "synthetic-test-only-secret-1234567890",
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      SMTP_FROM: "test@example.test",
    };
    expect(authConfiguration(env).local).toBe(true);
    expect(() =>
      authConfiguration({ ...env, BETTER_AUTH_URL: "http://example.com" }),
    ).toThrow("AUTH_NOT_CONFIGURED");
    expect(() =>
      authConfiguration({ ...env, BETTER_AUTH_URL: "https://example.com" }),
    ).toThrow("AUTH_NOT_CONFIGURED");
    expect(() =>
      authConfiguration({ ...env, BETTER_AUTH_SECRET: "short" }),
    ).toThrow("AUTH_NOT_CONFIGURED");
  });
  it("bounds request bodies and rejects malformed JSON", async () => {
    const request = (body: string) =>
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
    await expect(readJson(request("{bad}"))).rejects.toThrow();
    await expect(
      readJson(request(JSON.stringify({ value: "x".repeat(100) })), 20),
    ).rejects.toThrow();
    expect(await readJson(request('{"valid":true}'))).toEqual({ valid: true });
  });
  it("keeps account translation keys aligned", () => {
    expect(Object.keys(accountMessages.id).sort()).toEqual(
      Object.keys(accountMessages.en).sort(),
    );
    expect(Object.keys(accountMessages.id.roles)).toEqual(
      Object.keys(accountMessages.en.roles),
    );
  });
});
