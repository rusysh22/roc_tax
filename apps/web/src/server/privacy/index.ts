import "server-only";
import { getDatabase } from "../database";
import { getTaxCrypto } from "../intake/crypto";
import { privacyService } from "./service";

export function getPrivacy() {
  return privacyService(getDatabase(), getTaxCrypto());
}
