import "server-only";
import { getDatabase } from "../database";
import { readPublicCatalog, type PublicCatalog } from "./public-catalog";

export type { PublicCatalog };

export async function getPublicCatalog(): Promise<PublicCatalog> {
  // A missing or misconfigured database must fail closed on the public pricing
  // page instead of crashing it.
  let db: ReturnType<typeof getDatabase>;
  try {
    db = getDatabase();
  } catch {
    return { state: "UNAVAILABLE", plans: [], checkoutUrl: null };
  }
  return readPublicCatalog(db);
}
