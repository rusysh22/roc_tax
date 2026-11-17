import "server-only";
import { getDatabase } from "../database";
import { readPublicCatalog, type PublicCatalog } from "./public-catalog";

export type { PublicCatalog };

export async function getPublicCatalog(): Promise<PublicCatalog> {
  return readPublicCatalog(getDatabase());
}
