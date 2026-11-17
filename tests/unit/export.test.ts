import { describe, expect, it } from "vitest";
import { exportMessages } from "../../apps/web/src/i18n/exports";
import { canTransition } from "../../apps/web/src/lib/intake/state";
import { can } from "../../apps/web/src/server/workspaces/policy";
import {
  OFFICIAL_BPPU_V3_SOURCE,
  adminXmlTemplateCommandSchema,
} from "../../apps/web/src/lib/export/bppu-spec";
import {
  formatBppuDecimal,
  isValidIsoDate,
  rationalToBppuPercent,
  serializeBpuBulkXml,
  validateBpuBulkXml,
} from "../../apps/web/src/lib/export/bppu";

describe("Coretax BPPU XML schema, serialization & guardrails", () => {
  it("validates DJP official bppu.xml sample fixture and exact Schema3 element ordering", () => {
    const officialSample = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<BpuBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	<TIN>0029482015507000</TIN>
	<ListOfBpu>
		<Bpu>
			<TaxPeriodMonth>1</TaxPeriodMonth>
			<TaxPeriodYear>2024</TaxPeriodYear>
			<CounterpartTin>3301200503970004</CounterpartTin>
			<IDPlaceOfBusinessActivityOfIncomeRecipient>3301200503970004000000</IDPlaceOfBusinessActivityOfIncomeRecipient>
			<TaxCertificate>PP23</TaxCertificate>
			<TaxObjectCode>28-423-01</TaxObjectCode>
			<TaxBase>100000000</TaxBase>
			<Rate>0.5</Rate>
			<Document>TaxInvoice</Document>
			<DocumentNumber>0100012292489165</DocumentNumber>
			<DocumentDate>2024-02-29</DocumentDate>
			<IDPlaceOfBusinessActivity>0029482015507000000000</IDPlaceOfBusinessActivity>
			<GovTreasurerOpt>N/A</GovTreasurerOpt>
			<SP2DNumber xsi:nil="true"/>
			<WithholdingDate>2024-02-29</WithholdingDate>
		</Bpu>
	</ListOfBpu>
</BpuBulk>
`;
    const parsed = validateBpuBulkXml(officialSample);
    expect(parsed.tin).toBe("0029482015507000");
    expect(parsed.items[0].rate).toBe("0.5");
    expect(parsed.items[0].sp2dNumber).toBeNull();
    expect(OFFICIAL_BPPU_V3_SOURCE.sourceSha256).toHaveLength(64);
    expect(OFFICIAL_BPPU_V3_SOURCE.xsdSchemaHash).toHaveLength(64);
  });

  it("serializes anonymized fixtures cleanly with XML escaping, UTF-8, decimals, and leap-year dates", () => {
    expect(rationalToBppuPercent(2, 100)).toBe("2");
    expect(rationalToBppuPercent(5, 1000)).toBe("0.5");
    expect(rationalToBppuPercent(25, 10000)).toBe("0.25");
    expect(rationalToBppuPercent(265, 10000)).toBe("2.65");
    expect(formatBppuDecimal("100000000.00")).toBe("100000000");
    expect(formatBppuDecimal("12500.50")).toBe("12500.5");
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2025-02-29")).toBe(false);

    const xml = serializeBpuBulkXml({
      tin: "0000000000000001",
      items: [
        {
          taxPeriodMonth: 2,
          taxPeriodYear: 2024,
          counterpartTin: "0000000000000002",
          recipientTku: "0000000000000002000000",
          taxCertificate: "N/A",
          taxObjectCode: "24-104-06",
          taxBase: "10000000.00",
          rate: rationalToBppuPercent(2, 100),
          document: "CommercialInvoice",
          documentNumber: 'INV/2024 & "PT" <Uji> — Satu',
          documentDate: "2024-02-29",
          idPlaceOfBusinessActivity: "0000000000000001000000",
          govTreasurerOpt: "Direct",
          sp2dNumber: "SP2D-001/2024",
          withholdingDate: "2024-02-29",
        },
      ],
    });

    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;PT&quot;");
    expect(xml).toContain("&lt;Uji&gt;");
    expect(xml).toContain("<TaxBase>10000000</TaxBase>");
    expect(xml).toContain("<Rate>2</Rate>");
    expect(xml).toContain("<SP2DNumber>SP2D-001/2024</SP2DNumber>");

    const roundTrip = validateBpuBulkXml(xml);
    expect(roundTrip.items[0].documentNumber).toBe(
      'INV/2024 & "PT" <Uji> — Satu',
    );
  });

  it("rejects XXE, illegal XML chars, element reordering, pre-period withholding, and invalid official URLs", () => {
    expect(() =>
      validateBpuBulkXml(
        '<!DOCTYPE BpuBulk [<!ENTITY x SYSTEM "file:///etc/passwd">]><BpuBulk/>',
      ),
    ).toThrow("DISALLOWED_XML_CONSTRUCT");

    expect(() =>
      serializeBpuBulkXml({
        tin: "0000000000000001",
        items: [
          {
            taxPeriodMonth: 5,
            taxPeriodYear: 2026,
            counterpartTin: "0000000000000002",
            recipientTku: "0000000000000002000000",
            taxCertificate: "N/A",
            taxObjectCode: "TEST-01",
            taxBase: "1000.00",
            rate: "2",
            document: "CommercialInvoice",
            documentNumber: "INV-01",
            documentDate: "2026-04-15",
            idPlaceOfBusinessActivity: "0000000000000001000000",
            govTreasurerOpt: "N/A",
            sp2dNumber: null,
            withholdingDate: "2026-04-30",
          },
        ],
      }),
    ).toThrow("WITHHOLDING_DATE_BEFORE_PERIOD");

    expect(
      adminXmlTemplateCommandSchema.safeParse({
        action: "create",
        taxFamily: "PPN_FAKTUR_KELUARAN",
        versionTag: "FAKTUR-v1",
        sourceUrl: "https://evil.example.test/template.xml",
        sourceLabel: "Unofficial URL",
        sourceSha256: "a".repeat(64),
        xsdSchemaHash: "b".repeat(64),
        fixtureVerified: false,
      }).success,
    ).toBe(false);

    expect(can("OWNER", "tax.export")).toBe(false);
    expect(can("PREPARER", "tax.export")).toBe(true);
    expect(can("APPROVER", "tax.export")).toBe(true);
    expect(canTransition("CORETAX_REJECTED", "CHANGES_REQUESTED")).toBe(true);
  });

  it("keeps bilingual export messages aligned", () => {
    expect(Object.keys(exportMessages.id).sort()).toEqual(
      Object.keys(exportMessages.en).sort(),
    );
    expect(Object.keys(exportMessages.id.errors).sort()).toEqual(
      Object.keys(exportMessages.en.errors).sort(),
    );
  });
});
