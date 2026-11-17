export const bppuTaxCertificates = [
  "N/A",
  "TaxExAr22",
  "TaxExAr23",
  "TaxExIntDep",
  "TaxExIntPhtb",
  "DTP",
  "PP23",
  "ETC",
] as const;
export type BppuTaxCertificate = (typeof bppuTaxCertificates)[number];

export const bppuGovTreasurerOpts = ["N/A", "Imprest", "Direct"] as const;
export type BppuGovTreasurerOpt = (typeof bppuGovTreasurerOpts)[number];

/**
 * Exact intersection between xl/xmlMaps.xml Schema3 DocType enum and the BPPU
 * v.3 REF!F19:F32 validation list, plus all Schema3 tokens accepted by parser.
 */
export const bppuReferenceDocTypes = [
  "CommercialInvoice",
  "TaxInvoice",
  "Contract",
  "PaymentProof",
  "StatementLetter",
] as const;
export type BppuReferenceDocType = (typeof bppuReferenceDocTypes)[number];

export const bppuSchema3DocTypes = [
  "TaxInvoice",
  "CommercialInvoice",
  "Announchment",
  "Contract",
  "PaymentProof",
  "DeedofEngangement",
  "DeedofGeneralMeetingStakeholder",
  "StatementLetter",
  "BankAccountNumber",
] as const;

export const bppuElementOrder = [
  "TaxPeriodMonth",
  "TaxPeriodYear",
  "CounterpartTin",
  "IDPlaceOfBusinessActivityOfIncomeRecipient",
  "TaxCertificate",
  "TaxObjectCode",
  "TaxBase",
  "Rate",
  "Document",
  "DocumentNumber",
  "DocumentDate",
  "IDPlaceOfBusinessActivity",
  "GovTreasurerOpt",
  "SP2DNumber",
  "WithholdingDate",
] as const;
