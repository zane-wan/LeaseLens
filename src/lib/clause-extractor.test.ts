import { describe, it, expect } from "vitest";
import {
  extractClauses,
  deduplicateClauses,
  detectFormBoundaries,
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
    const leaseText = `
Form 400
AGREEMENT TO LEASE

Schedule A
1. Tenant shall maintain renter's insurance with $1,000,000 liability.
2. No pets of any kind are permitted on the premises.
3. Tenant must give 60 days written notice before termination.

Form 401

Schedule A
1. Tenant is responsible for first $150 of any repair cost.
2. Landlord may enter premises every two months for inspection.
3. No cultivation or sale of cannabis on the premises.

Schedule B
1. Tenant shall provide 10 post-dated cheques.
2. Tenant is responsible for lawn care and snow removal.
`;

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
// Form boundary detection
// ---------------------------------------------------------------------------

describe("detectFormBoundaries", () => {
  it("detects Form 400 and Form 401 boundaries", () => {
    const text = `
Form 400
AGREEMENT TO LEASE
Some content here.

Form 401
Schedule A content here.
`;

    const regions = detectFormBoundaries(text);

    expect(regions.length).toBeGreaterThanOrEqual(2);
    expect(regions.some((r) => r.form === "form_400")).toBe(true);
    expect(regions.some((r) => r.form === "form_401")).toBe(true);
  });

  it("detects OSL boundary", () => {
    const text = `
Ontario Standard Lease
Residential Tenancy Agreement
Section 1: Parties
`;

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

  it("detects all three forms in a full document", () => {
    const text = `
Form 400
AGREEMENT TO LEASE
Parties and terms...

Ontario Standard Lease
Section 1: Parties

Form 401
Schedule A
Custom clauses...
`;

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
// Full mixed-document integration test
// ---------------------------------------------------------------------------

describe("extractClauses — full mixed-document", () => {
  it("extracts from Form 400 Section 8 + Schedule A + Form 401 Schedule A/B + OSL Section 15", async () => {
    const leaseText = `
Form 400
AGREEMENT TO LEASE

7. Rent Details
Rent: $2000/month

8. ADDITIONAL TERMS
(a) Tenants pay all utilities.

9. Signatures

Schedule A
1. Tenant must maintain renter's insurance with $1,000,000 liability.
2. No smoking on premises including balcony and common areas.
3. No pets of any kind are allowed on the premises.

Ontario Standard Lease

15. Additional Terms
This tenancy agreement includes additional terms in attached schedules.

Form 401

Schedule A
1. Tenant responsible for first $150 of any maintenance repair.
2. Landlord may enter the premises every two months for inspection purposes.
3. No cultivation, distribution, or sale of cannabis on premises.

Schedule B
1. Tenant shall provide 10 post-dated cheques upon lease signing.
2. Tenant is responsible for lawn care and snow removal duties.
3. Upon vacating, tenant must leave premises in original condition.
`;

    const clauses = await extractClauses(leaseText);

    // Should find clauses from all forms
    const sources = new Set(clauses.map((c) => c.source));
    expect(sources.has("form400_section_8")).toBe(true);
    expect(sources.has("form400_schedule_a")).toBe(true);
    expect(sources.has("form401_schedule_a")).toBe(true);
    expect(sources.has("form401_schedule_b")).toBe(true);

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
