import "server-only";
import { billingService } from "../billing/service";
import { getDatabase } from "../database";
import { exportService } from "../export/service";
import { ocrService } from "../ocr/service";
import { reportsService } from "../reports/service";
import { taxService } from "../tax/service";
import { getTaxCrypto } from "./crypto";
import { importBatchService } from "./imports";
import { intakeService } from "./service";
import { localDocumentStorage } from "./storage";

export function getIntake() {
  return intakeService(getDatabase(), getTaxCrypto(), localDocumentStorage());
}
export function getImports() {
  return importBatchService(getDatabase(), getTaxCrypto());
}
export function getOcr() {
  return ocrService(getDatabase(), localDocumentStorage());
}
export function getTax() {
  return taxService(getDatabase());
}
export function getExport() {
  return exportService(getDatabase(), getTaxCrypto(), localDocumentStorage());
}
export function getBilling() {
  return billingService(getDatabase(), getTaxCrypto());
}
export function getReports() {
  return reportsService(getDatabase());
}
