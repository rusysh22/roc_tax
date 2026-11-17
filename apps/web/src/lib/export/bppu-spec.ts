import { z } from "zod";
import { allTaxFamilies } from "../intake/tax-rules";
export {
  bppuElementOrder,
  bppuGovTreasurerOpts,
  bppuReferenceDocTypes,
  bppuSchema3DocTypes,
  bppuTaxCertificates,
  type BppuGovTreasurerOpt,
  type BppuReferenceDocType,
  type BppuTaxCertificate,
} from "./bppu-constants";

export const xmlTemplateStatuses = [
  "UNVERIFIED",
  "VERIFIED",
  "RETIRED",
] as const;
export type XmlTemplateStatus = (typeof xmlTemplateStatuses)[number];

export const coretaxOutcomeStatuses = [
  "CORETAX_SUBMITTED",
  "CORETAX_ACCEPTED",
  "CORETAX_REJECTED",
] as const;
export type CoretaxOutcomeStatus = (typeof coretaxOutcomeStatuses)[number];

export const OFFICIAL_BPPU_V3_SOURCE = {
  catalogPage:
    "https://pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml",
  versionTag: "BPPU-v3-2025-09",
  sourceUrl:
    "https://pajak.go.id/sites/default/files/2025-09/BPPU%20Excel%20to%20XML%20v.3.xlsx",
  sourceLabel: "DJP Coretax BPPU Excel to XML v.3 & official bppu.zip sample",
  sourcePublishedAt: "2025-09-04T04:32:24.000Z",
  sourceSha256:
    "b59813365bccdf9d63a47051d4d2b0b58c53351b8c981a6f33144be05b429089",
  referenceUrl: "https://pajak.go.id/sites/default/files/2024-12/bppu.zip",
  referenceSha256:
    "8a90ea38737bd8d5f0563c12c11ec076b91138f0865ac9f46fd0d4414b004deb",
  sampleXmlSha256:
    "bd52881b465315072fe3820f3f63b38b6e966d72e7da22ec94afcac1b55635e5",
  xsdSchemaHash:
    "9ccf6e1b0f36cb0936d0ad5e8725bfeb0bbd61e2174553162b3c8c7c4a1019d7",
} as const;

/** Families that currently have a verified official schema and XML serializer. */
export const exportCapableFamilies = ["PPH_UNIFIKASI_BPPU"] as const;

export const adminXmlTemplateCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      taxFamily: z.enum(allTaxFamilies),
      versionTag: z
        .string()
        .trim()
        .min(3)
        .max(64)
        .regex(/^[A-Za-z0-9._-]+$/),
      sourceUrl: z
        .string()
        .trim()
        .url()
        .refine(
          (val) => {
            try {
              const u = new URL(val);
              return (
                u.protocol === "https:" &&
                (u.hostname === "pajak.go.id" ||
                  u.hostname.endsWith(".pajak.go.id"))
              );
            } catch {
              return false;
            }
          },
          { message: "Must be an official https://*.pajak.go.id URL" },
        ),
      sourceLabel: z.string().trim().min(3).max(160),
      sourcePublishedAt: z.string().trim().datetime().nullable().optional(),
      sourceSha256: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-f0-9]{64}$/),
      referenceUrl: z.string().trim().url().nullable().optional(),
      referenceSha256: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-f0-9]{64}$/)
        .nullable()
        .optional(),
      xsdSchemaHash: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-f0-9]{64}$/),
      fixtureVerified: z.boolean().default(false),
      notes: z.string().trim().max(500).default(""),
    })
    .strict(),
  z
    .object({
      action: z.literal("set_status"),
      templateId: z.string().min(1).max(100),
      status: z.enum(xmlTemplateStatuses),
      fixtureVerified: z.boolean().optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .strict(),
]);
export type AdminXmlTemplateCommand = z.infer<
  typeof adminXmlTemplateCommandSchema
>;

export const generateExportSchema = z
  .object({
    companyId: z.string().min(1).max(100),
    taxFamily: z.enum(allTaxFamilies),
    taxPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    templateVersionTag: z.string().trim().min(3).max(64).optional(),
    transactionIds: z.array(z.string().min(1).max(100)).min(1).max(100),
    idempotencyKey: z.string().trim().min(8).max(120),
  })
  .strict();
export type GenerateExportInput = z.infer<typeof generateExportSchema>;

export const recordOutcomeSchema = z
  .object({
    outcome: z.enum(coretaxOutcomeStatuses),
    coretaxReference: z.string().trim().max(80).nullable().optional(),
    accountHint: z.string().trim().max(20).nullable().optional(),
    portalTimestamp: z.string().datetime().nullable().optional(),
    evidenceSha256: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
export type RecordOutcomeInput = z.infer<typeof recordOutcomeSchema>;
