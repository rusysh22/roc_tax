import "server-only";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/database";

export type ShellSession =
  | { state: "unavailable" }
  | { state: "anonymous" }
  | { state: "unverified" }
  | {
      state: "ready";
      user: { name: string; email: string; superadmin: boolean };
    };

/** Resolves the signed-in user for the app shell (fresh, no cookie cache). */
export async function shellSession(): Promise<ShellSession> {
  let session;
  try {
    session = await getAuth().api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    });
  } catch {
    return { state: "unavailable" };
  }
  if (!session) return { state: "anonymous" };
  if (!session.user.emailVerified) return { state: "unverified" };
  const row = await getDatabase().user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });
  return {
    state: "ready",
    user: {
      name: session.user.name,
      email: session.user.email,
      superadmin: row?.platformRole === "SUPERADMIN",
    },
  };
}
