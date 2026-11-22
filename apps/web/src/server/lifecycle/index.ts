import "server-only";
import { getDatabase } from "../database";
import { localDocumentStorage } from "../intake/storage";
import { invoicingService } from "../invoicing/service";
import { lifecycleService } from "./service";

export function getLifecycle() {
  return lifecycleService(getDatabase(), localDocumentStorage());
}
export function getInvoicing() {
  return invoicingService(getDatabase());
}
