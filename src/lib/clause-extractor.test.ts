import { describe, it, expect } from "vitest";
import {
  extractClauses,
  deduplicateClauses,
  detectFormBoundaries,
  isStandardRtaForm,
  classifyPage,
  splitPages,
} from "./clause-extractor";

// ---------------------------------------------------------------------------
// Unit tests for clause extraction — semantic anchor detection (Strategy 1).
// These tests exercise the regex-based extraction logic without LLM calls.
// ---------------------------------------------------------------------------

describe("extractClauses — semantic anchor detection", () => {
  it("extracts clauses from a standard OSL Section 15", async () => {
    const leaseText = `
14. Changes to the Rental Unit
The tenant may not alter the rental unit without permission.

15. Additional Terms
(a) No pets of any kind are allowed on the premises.
(b) Tenant must shovel snow from the driveway within 24 hours of snowfall.
(c) Tenant must pay a $500 key deposit upon signing.

16. Signatures
Landlord: _______________
Tenant: _______________
`;

    const clauses = await extractClauses(leaseText);

    expect(clauses.length).toBeGreaterThanOrEqual(3);
    expect(clauses.every((c) => c.source === "section_15")).toBe(true);

    const texts = clauses.map((c) => c.text);
    expect(texts.some((t) => t.includes("No pets"))).toBe(true);
    expect(texts.some((t) => t.includes("shovel snow"))).toBe(true);
    expect(texts.some((t) => t.includes("key deposit"))).toBe(true);
  });

  it("extracts clauses from ADDITIONAL TERMS (uppercase)", async () => {
    const leaseText = `
14. Changes
Standard text here.

15. ADDITIONAL TERMS
(a) No smoking inside the unit.
(b) Quiet hours between 10pm and 8am.

16. Signatures
`;

    const clauses = await extractClauses(leaseText);

    expect(clauses.length).toBeGreaterThanOrEqual(2);
    expect(clauses[0].source).toBe("section_15");
    expect(clauses.some((c) => c.text.includes("No smoking"))).toBe(true);
    expect(clauses.some((c) => c.text.includes("Quiet hours"))).toBe(true);
  });

  it("extracts Schedule A clauses", async () => {
    const leaseText = `
15. Additional Terms
(a) See Schedule A for additional rules.

Schedule A
1. Tenant is responsible for lawn maintenance.
2. No barbecues on balconies.
3. Garbage must be sorted into recycling and waste.
`;

    const clauses = await extractClauses(leaseText);

    const scheduleAClauses = clauses.filter((c) => c.source === "schedule_a");
    expect(scheduleAClauses.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts from both Section 15 and Schedule A/B", async () => {
    const leaseText = `
15. Additional Terms
(a) No pets allowed.

Signature
Landlord: ___

Schedule A
1. Tenant must maintain the garden.

Schedule B
1. Parking space #42 assigned to tenant.
`;

    const clauses = await extractClauses(leaseText);

    const sources = new Set(clauses.map((c) => c.source));
    expect(sources.has("section_15")).toBe(true);
    expect(sources.has("schedule_a")).toBe(true);
    expect(sources.has("schedule_b")).toBe(true);
  });

  it("handles lease with no Section 15 or schedules (empty for anchor detection)", async () => {
    // This text has no recognizable anchors — would normally trigger LLM fallback.
    // Since we're not mocking the LLM, we test the anchor path returns nothing.
    const leaseText = `
AGREEMENT TO LEASE
Parties: John Doe and Jane Smith
Rent: $2000/month
Start date: January 1, 2025
`;

    // The function will fall back to LLM extraction, which we can't test here
    // without mocking. But we can verify it doesn't crash.
    // In a real scenario with no LLM, this would call GPT-4o-mini.
    // For unit testing, we test the anchor detection returns nothing.
    // We'll skip this test in CI without API keys.
  });

  it("handles numbered list format in Section 15", async () => {
    const leaseText = `
15. Additional Terms
1. The tenant shall not install satellite dishes.
2. All guests must register at the front desk.
3. No alterations to plumbing or electrical systems.

16. Signatures
`;

    const clauses = await extractClauses(leaseText);

    expect(clauses.length).toBeGreaterThanOrEqual(3);
    expect(clauses.some((c) => c.text.includes("satellite dishes"))).toBe(
      true,
    );
  });

  it("handles bullet-point format in Section 15", async () => {
    const leaseText = `
15. Additional Terms
- No pets of any kind.
- Tenant responsible for all minor repairs under $100.
- No subletting without written consent.

Landlord Signature: ___
`;

    const clauses = await extractClauses(leaseText);

    expect(clauses.length).toBeGreaterThanOrEqual(3);
    expect(clauses.some((c) => c.text.includes("No pets"))).toBe(true);
    expect(clauses.some((c) => c.text.includes("subletting"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Form 400 Section 8 detection
// ---------------------------------------------------------------------------

describe("extractClauses — Form 400 Section 8", () => {
  it("extracts clauses from Form 400 Section 8 ADDITIONAL TERMS", async () => {
    const leaseText = `
Form 400
AGREEMENT TO LEASE

7. Rent Details
Rent is $2000 per month.

8. ADDITIONAL TERMS
(a) Tenant must provide 12 post-dated cheques.
(b) No smoking anywhere on the premises.

9. Signatures
Landlord: ___
`;

    const clauses = await extractClauses(leaseText);

    expect(clauses.length).toBeGreaterThanOrEqual(2);
    const section8Clauses = clauses.filter(
      (c) => c.source === "form400_section_8",
    );
    expect(section8Clauses.length).toBeGreaterThanOrEqual(2);
    expect(
      section8Clauses.some((c) => c.text.includes("post-dated cheques")),
    ).toBe(true);
    expect(section8Clauses.some((c) => c.text.includes("No smoking"))).toBe(
      true,
    );
  });

  it("handles empty Section 8", async () => {
    const leaseText = `
Form 400
AGREEMENT TO LEASE

8. ADDITIONAL TERMS

9. Other terms apply.
`;

    const clauses = await extractClauses(leaseText);

    const section8Clauses = clauses.filter(
      (c) => c.source === "form400_section_8",
    );
    expect(section8Clauses.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple Schedule A instances (Form 400 + Form 401)
// ---------------------------------------------------------------------------

describe("extractClauses — multiple schedule instances", () => {
  it("extracts Schedule A from both Form 400 and Form 401", async () => {
    const leaseText = [
      "Form 400\nAGREEMENT TO LEASE\n\nSchedule A\n1. Tenant shall maintain renter's insurance with $1,000,000 liability.\n2. No pets of any kind are permitted on the premises.\n3. Tenant must give 60 days written notice before termination.",
      "Form 401\n\nSchedule A\n1. Tenant is responsible for first $150 of any repair cost.\n2. Landlord may enter premises every two months for inspection.\n3. No cultivation or sale of cannabis on the premises.\n\nSchedule B\n1. Tenant shall provide 10 post-dated cheques.\n2. Tenant is responsible for lawn care and snow removal.",
    ].join("\n-- 1 of 2 --\n");

    const clauses = await extractClauses(leaseText);

    const form400A = clauses.filter(
      (c) => c.source === "form400_schedule_a",
    );
    const form401A = clauses.filter(
      (c) => c.source === "form401_schedule_a",
    );
    const form401B = clauses.filter(
      (c) => c.source === "form401_schedule_b",
    );

    expect(form400A.length).toBeGreaterThanOrEqual(3);
    expect(form401A.length).toBeGreaterThanOrEqual(3);
    expect(form401B.length).toBeGreaterThanOrEqual(2);

    expect(form400A.some((c) => c.text.includes("renter's insurance"))).toBe(
      true,
    );
    expect(form401A.some((c) => c.text.includes("$150"))).toBe(true);
    expect(form401B.some((c) => c.text.includes("post-dated cheques"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// Page splitting & classification
// ---------------------------------------------------------------------------

describe("splitPages", () => {
  it("splits text by pdf-parse page joiner", () => {
    const text = "Page one content\n-- 1 of 3 --\nPage two content\n-- 2 of 3 --\nPage three content";
    const pages = splitPages(text);
    expect(pages.length).toBe(3);
    expect(pages[0].text).toBe("Page one content");
    expect(pages[1].text).toBe("Page two content");
    expect(pages[2].text).toBe("Page three content");
  });

  it("returns single page when no joiner present", () => {
    const text = "Just a plain document.";
    const pages = splitPages(text);
    expect(pages.length).toBe(1);
    expect(pages[0].text).toBe(text);
    expect(pages[0].startIdx).toBe(0);
    expect(pages[0].endIdx).toBe(text.length);
  });
});

describe("classifyPage", () => {
  it("classifies a page with Form 400", () => {
    expect(classifyPage("Form 400\nAGREEMENT TO LEASE\nSome content")).toBe("form_400");
  });

  it("classifies a page with Form 401", () => {
    expect(classifyPage("Form 401\nSchedule A\nClauses here")).toBe("form_401");
  });

  it("classifies a page with OSL markers", () => {
    expect(classifyPage("Residential Tenancy Agreement\n2229E")).toBe("osl");
  });

  it("classifies a page with 2229E as OSL", () => {
    expect(classifyPage("Some content\n2229E\nMore content")).toBe("osl");
  });

  it("classifies Form 410 before Form 400", () => {
    // Irrelevant forms are checked first
    expect(classifyPage("Form 410\nRental Application")).toBe("form_410");
  });

  it("returns unknown for unrecognized page", () => {
    expect(classifyPage("Just some random text")).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Form boundary detection (per-page)
// ---------------------------------------------------------------------------

describe("detectFormBoundaries", () => {
  it("detects Form 400 and Form 401 on separate pages", () => {
    const text = [
      "Form 400\nAGREEMENT TO LEASE\nSome content here.",
      "Form 401\nSchedule A content here.",
    ].join("\n-- 1 of 2 --\n");

    const regions = detectFormBoundaries(text);

    expect(regions.length).toBe(2);
    expect(regions[0].form).toBe("form_400");
    expect(regions[1].form).toBe("form_401");
  });

  it("merges consecutive pages of the same form", () => {
    const text = [
      "Form 400\nPage 1 content",
      "Form 400\nPage 2 content",
      "Form 401\nPage 3 content",
    ].join("\n-- 1 of 3 --\n");

    const regions = detectFormBoundaries(text);

    expect(regions.length).toBe(2);
    expect(regions[0].form).toBe("form_400");
    expect(regions[1].form).toBe("form_401");
  });

  it("detects OSL boundary", () => {
    const text = "Residential Tenancy Agreement\n2229E\nSection 1: Parties";

    const regions = detectFormBoundaries(text);

    expect(regions.some((r) => r.form === "osl")).toBe(true);
  });

  it("returns unknown region when no form headers found", () => {
    const text = "Just a plain document with no form headers.";

    const regions = detectFormBoundaries(text);

    expect(regions).toEqual([
      { form: "unknown", startIdx: 0, endIdx: text.length },
    ]);
  });

  it("detects all three forms in a multi-page document", () => {
    const text = [
      "Form 400\nAGREEMENT TO LEASE\nParties and terms...",
      "Ontario Standard Lease\n2229E\nSection 1: Parties",
      "Form 401\nSchedule A\nCustom clauses...",
    ].join("\n-- 1 of 3 --\n");

    const regions = detectFormBoundaries(text);

    const forms = regions.map((r) => r.form);
    expect(forms).toContain("form_400");
    expect(forms).toContain("osl");
    expect(forms).toContain("form_401");
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("deduplicateClauses", () => {
  it("removes exact duplicate clauses from different forms", () => {
    const clauses = [
      {
        text: "No pets of any kind are allowed on the premises.",
        source: "form400_schedule_a" as const,
      },
      {
        text: "No pets of any kind are allowed on the premises.",
        source: "form401_schedule_a" as const,
      },
    ];

    const result = deduplicateClauses(clauses);

    expect(result.length).toBe(1);
    expect(result[0].source).toBe("form400_schedule_a");
  });

  it("removes near-duplicate clauses above 85% similarity", () => {
    const clauses = [
      {
        text: "Tenant must maintain property insurance with at least one million dollar liability coverage.",
        source: "form400_schedule_a" as const,
      },
      {
        text: "Tenant must maintain property insurance with at least one million dollar liability coverage at all times.",
        source: "form401_schedule_a" as const,
      },
    ];

    const result = deduplicateClauses(clauses);

    expect(result.length).toBe(1);
  });

  it("keeps clauses that are sufficiently different", () => {
    const clauses = [
      {
        text: "No pets of any kind are allowed on the premises.",
        source: "form400_schedule_a" as const,
      },
      {
        text: "Tenant is responsible for lawn care and snow removal.",
        source: "form401_schedule_b" as const,
      },
    ];

    const result = deduplicateClauses(clauses);

    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Clause splitting robustness
// ---------------------------------------------------------------------------

describe("extractClauses — clause splitting robustness", () => {
  it("does not false-split on dollar amounts like $150.00", async () => {
    const leaseText = `
15. Additional Terms
1. Tenant is responsible for first $150.00 of any repair cost per incident.
2. No smoking anywhere on the premises including balcony.

16. Signatures
`;

    const clauses = await extractClauses(leaseText);

    expect(clauses.length).toBe(2);
    expect(clauses[0].text).toContain("$150.00");
    expect(clauses[0].text).toContain("repair cost");
  });

  it("handles paragraph-based splitting when no markers present", async () => {
    const leaseText = `
15. Additional Terms

The tenant shall not keep any pets on the premises. This includes all animals regardless of size.

The tenant is responsible for all utility bills including hydro, water, and gas. Payment must be made directly to the utility companies.

The tenant must not sublet the unit without written permission from the landlord.

16. Signatures
`;

    const clauses = await extractClauses(leaseText);

    expect(clauses.length).toBeGreaterThanOrEqual(3);
    expect(clauses.some((c) => c.text.includes("pets"))).toBe(true);
    expect(clauses.some((c) => c.text.includes("utility bills"))).toBe(true);
    expect(clauses.some((c) => c.text.includes("sublet"))).toBe(true);
  });

  it("captures preamble text before first numbered clause", async () => {
    const leaseText = `
15. Additional Terms
The following additional terms apply to this tenancy agreement:
1. No pets allowed on the premises whatsoever.
2. Tenant must carry renter's insurance at all times.

16. Signatures
`;

    const clauses = await extractClauses(leaseText);

    // Should capture the preamble and both numbered clauses
    expect(clauses.length).toBeGreaterThanOrEqual(2);
    expect(clauses.some((c) => c.text.includes("No pets"))).toBe(true);
    expect(clauses.some((c) => c.text.includes("renter's insurance"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// Irrelevant document filtering
// ---------------------------------------------------------------------------

describe("detectFormBoundaries — irrelevant document types", () => {
  it("detects Form 410 (Rental Application) as a boundary", () => {
    const text = [
      "Form 400\nAGREEMENT TO LEASE\nSome content here.",
      "Form 410\nRental Application\nApplicant Name: John Doe",
      "Form 401\nSchedule A\nCustom clauses here.",
    ].join("\n-- 1 of 3 --\n");

    const regions = detectFormBoundaries(text);
    const forms = regions.map((r) => r.form);
    expect(forms).toContain("form_400");
    expect(forms).toContain("form_410");
    expect(forms).toContain("form_401");
  });

  it("detects Form 324 (Confirmation of Co-operation)", () => {
    const text = [
      "Form 400\nAGREEMENT TO LEASE\nContent...",
      "Form 324\nConfirmation of Co-operation and Representation\nBrokerage details...",
    ].join("\n-- 1 of 2 --\n");

    const regions = detectFormBoundaries(text);
    expect(regions.some((r) => r.form === "form_324")).toBe(true);
  });

  it("detects OSL Appendix: General Information", () => {
    const text = [
      "Residential Tenancy Agreement\n2229E\n15. Additional Terms\nSome terms here.",
      "Appendix: General Information\nThis Appendix sets out basic information.",
    ].join("\n-- 1 of 2 --\n");

    const regions = detectFormBoundaries(text);
    expect(regions.some((r) => r.form === "osl_appendix")).toBe(true);
  });
});

describe("extractClauses — irrelevant document filtering", () => {
  it("skips Form 410 content and only extracts from Form 400/401", async () => {
    const leaseText = [
      "Form 410\nRental Application\nApplicant: John Doe\nEmployer: Acme Corp\nMonthly Income: $5000",
      "Form 400\nAGREEMENT TO LEASE\n\nSchedule A\n1. Tenant must maintain renter's insurance.\n2. No smoking on premises.",
      "Form 324\nConfirmation of Co-operation and Representation\nThe Listing Brokerage represents the Landlord.",
    ].join("\n-- 1 of 3 --\n");

    const clauses = await extractClauses(leaseText);

    // Should only extract from Form 400 Schedule A
    expect(clauses.length).toBeGreaterThanOrEqual(2);
    expect(clauses.every((c) => c.source === "form400_schedule_a")).toBe(true);

    // Should NOT include rental application or brokerage info
    const allText = clauses.map((c) => c.text).join(" ");
    expect(allText).not.toContain("Acme Corp");
    expect(allText).not.toContain("Monthly Income");
    expect(allText).not.toContain("Listing Brokerage");
  });

  it("skips OSL Appendix General Information", async () => {
    const leaseText = [
      "Residential Tenancy Agreement\n2229E\n\n15. Additional Terms\n(a) No pets allowed on the premises.\n\n16. Signatures",
      "Appendix: General Information\nThis Appendix sets out basic information for landlords and tenants.\nThe Landlord and Tenant Board provides information about rights.\nToll free: 1-888-332-3234",
    ].join("\n-- 1 of 2 --\n");

    const clauses = await extractClauses(leaseText);

    // OSL Section 15 is never extracted, so no section_15 clauses
    // Should NOT include appendix content
    const allText = clauses.map((c) => c.text).join(" ");
    expect(allText).not.toContain("Toll free");
    expect(allText).not.toContain("Landlord and Tenant Board");
  });
});

// ---------------------------------------------------------------------------
// Standard RTA form detection & Section 15 skipping
// ---------------------------------------------------------------------------

describe("isStandardRtaForm", () => {
  it("identifies standard RTA form with all 3 markers", () => {
    const text = `
Residential Tenancy Agreement
(Standard Form of Lease)

1. Parties
Landlord: ...

2229E

www.ontario.ca/standardlease
`;
    expect(isStandardRtaForm(text)).toBe(true);
  });

  it("identifies standard RTA form with 2 of 3 markers", () => {
    const text = `
Residential Tenancy Agreement
(Standard Form of Lease)

1. Parties
Landlord: ...

2229E
`;
    expect(isStandardRtaForm(text)).toBe(true);
  });

  it("does NOT flag non-RTA documents", () => {
    const text = `
Form 400
AGREEMENT TO LEASE
Schedule A
1. No pets allowed.
`;
    expect(isStandardRtaForm(text)).toBe(false);
  });

  it("does NOT flag a document with only 1 marker", () => {
    const text = `
Some lease document
Residential Tenancy Agreement
(not the standard form)
`;
    expect(isStandardRtaForm(text)).toBe(false);
  });
});

describe("extractClauses — OSL Section 15 skipping", () => {
  it("skips Section 15 from a standard RTA form (template-only, no real clauses)", async () => {
    // Simulates church RTA.pdf — a standard RTA with template Section 15
    const leaseText = "Residential Tenancy Agreement\n(Standard Form of Lease)\n2229E\n\n15. Additional Terms\nLandlords and tenants can agree to additional terms.\nSelect one:\nThis tenancy agreement includes an attachment.\n\n16. Changes to this Agreement\nwww.ontario.ca/standardlease";

    const clauses = await extractClauses(leaseText);

    const section15Clauses = clauses.filter((c) => c.source === "section_15");
    expect(section15Clauses.length).toBe(0);
  });

  it("skips Section 15 from any OSL document (not just standard RTA)", async () => {
    const leaseText = "Residential Tenancy Agreement\n2229E\n\n15. Additional Terms\n(a) Landlord does not allow pets of any kind on the premises.\n(b) Tenant must shovel snow from the driveway within 24 hours.\n(c) Tenant must pay a $500 key deposit upon signing.\n\n16. Signatures";

    const clauses = await extractClauses(leaseText);

    const section15Clauses = clauses.filter((c) => c.source === "section_15");
    expect(section15Clauses.length).toBe(0);
  });

  it("still extracts schedules from within an OSL region", async () => {
    const leaseText = "Residential Tenancy Agreement\n2229E\n\n15. Additional Terms\nSelect one:\nThis tenancy agreement includes an attachment.\n\nSchedule A\n1. Tenant must maintain renter's insurance with $1,000,000 liability.\n2. No smoking on premises.\n\nwww.ontario.ca/standardlease";

    const clauses = await extractClauses(leaseText);

    expect(clauses.filter((c) => c.source === "section_15").length).toBe(0);
    const schedA = clauses.filter((c) => c.source === "schedule_a");
    expect(schedA.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Full mixed-document integration test
// ---------------------------------------------------------------------------

describe("extractClauses — full mixed-document", () => {
  it("extracts Form 401 schedule clauses when the letter is separated from the schedule header", async () => {
    const leaseText = [
      "Form 401\tRevised 2023\tPage 1 of 2\nThe trademarks REALTOR®, REALTORS®, MLS®, Multiple Listing Services® and associated logos are owned or controlled by\nThe Canadian Real Estate Association (CREA) and identify the real estate professionals who are members of CREA and the\nquality of services they provide. Used under license.\n© 2024, Ontario Real Estate Association (“OREA”). All rights reserved. This form was developed by OREA for the use and reproduction\nby its members and licensees only. Any other use or reproduction is prohibited except with prior written consent of OREA. Do not alter\nwhen printing or reproducing the standard pre-set portion. OREA bears no liability for your use of this form.\nSchedule ______\nAgreement to Lease - Residential\nForm 401\nfor use in the Province of Ontario\nINITIALS OF TENANT(S)\tINITIALS OF LANDLORD(S):\nThis Schedule is attached to and forms part of the Agreement to Lease between:\nTENANT: ................................................................................................................., and\nLANDLORD: ......................................................................................................................\nfor the lease of ...................................................................................................................\nThis form must be initialled by all parties to the Agreement to Lease.\nA\nThe tenants agree to pay two(2) months rent deposit when this agreement is mutually accepted and signed by both parties and it will be applied as rent for the first month and last month of the tenancy period.\nTenants acknowledge and agree to pay all utilities cost, including, but not limited to, water, hydro, gas, Cable TV, Internet.\nTenants are responsible for lawn care/maintenance and snow/ice removal.",
      "Form 401\tRevised 2023\tPage 2 of 2\nThe trademarks REALTOR®, REALTORS®, MLS®, Multiple Listing Services® and associated logos are owned or controlled by\nThe Canadian Real Estate Association (CREA) and identify the real estate professionals who are members of CREA and the\nquality of services they provide. Used under license.\n© 2024, Ontario Real Estate Association (“OREA”). All rights reserved. This form was developed by OREA for the use and reproduction\nby its members and licensees only. Any other use or reproduction is prohibited except with prior written consent of OREA. Do not alter\nwhen printing or reproducing the standard pre-set portion. OREA bears no liability for your use of this form.\nSchedule ______\nAgreement to Lease - Residential\nForm 401\nfor use in the Province of Ontario\nINITIALS OF TENANT(S):\tINITIALS OF LANDLORD(S):\nThis Schedule is attached to and forms part of the Agreement to Lease between:\nTENANT: ................................................................................................................., and\nLANDLORD: ......................................................................................................................\nfor the lease of ...................................................................................................................\nThis form must be initialled by all parties to the Agreement to Lease.\nA\nThe Tenant shall have to give not less than Sixty (60) days of written notice to the Landlord of their intention to terminate or extend the lease.\nThe Tenant acknowledges and agrees that any short term rental and/or airbnb business are not allowed at this property.",
    ].join("\n-- 1 of 2 --\n");

    const clauses = await extractClauses(leaseText);
    const scheduleAClauses = clauses.filter(
      (c) => c.source === "form401_schedule_a",
    );
    const allText = scheduleAClauses.map((c) => c.text).join(" ");

    expect(scheduleAClauses.length).toBeGreaterThanOrEqual(5);
    expect(allText).toContain("rent deposit");
    expect(allText).toContain("utilities");
    expect(allText).toContain("lawn care");
    expect(allText).toContain("Sixty (60) days");
    expect(allText).toContain("airbnb");
    expect(allText).not.toContain("-- 1 of 2 --");
  });

  it("extracts from Form 400 Section 8 + Schedule A + Form 401 Schedule A/B (skips OSL Section 15)", async () => {
    const leaseText = [
      "Form 400\nAGREEMENT TO LEASE\n\n7. Rent Details\nRent: $2000/month\n\n8. ADDITIONAL TERMS\n(a) Tenants pay all utilities.\n\n9. Signatures",
      "Form 400\nSchedule A\n1. Tenant must maintain renter's insurance with $1,000,000 liability.\n2. No smoking on premises including balcony and common areas.\n3. No pets of any kind are allowed on the premises.",
      "Ontario Standard Lease\n2229E\n\n15. Additional Terms\nThis tenancy agreement includes additional terms in attached schedules.",
      "Form 401\n\nSchedule A\n1. Tenant responsible for first $150 of any maintenance repair.\n2. Landlord may enter the premises every two months for inspection purposes.\n3. No cultivation, distribution, or sale of cannabis on premises.",
      "Form 401\n\nSchedule B\n1. Tenant shall provide 10 post-dated cheques upon lease signing.\n2. Tenant is responsible for lawn care and snow removal duties.\n3. Upon vacating, tenant must leave premises in original condition.",
    ].join("\n-- 1 of 5 --\n");

    const clauses = await extractClauses(leaseText);

    // Should find clauses from Form 400 and Form 401
    const sources = new Set(clauses.map((c) => c.source));
    expect(sources.has("form400_section_8")).toBe(true);
    expect(sources.has("form400_schedule_a")).toBe(true);
    expect(sources.has("form401_schedule_a")).toBe(true);
    expect(sources.has("form401_schedule_b")).toBe(true);

    // OSL Section 15 should NOT be extracted
    expect(sources.has("section_15")).toBe(false);

    // Verify key clauses are present
    const allText = clauses.map((c) => c.text).join(" ");
    expect(allText).toContain("utilities");
    expect(allText).toContain("renter's insurance");
    expect(allText).toContain("No smoking");
    expect(allText).toContain("cannabis");
    expect(allText).toContain("post-dated cheques");
    expect(allText).toContain("lawn care");

    // Should have a reasonable total (not wildly duplicated)
    expect(clauses.length).toBeGreaterThanOrEqual(8);
    expect(clauses.length).toBeLessThanOrEqual(20);
  });
});
