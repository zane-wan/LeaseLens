import { describe, expect, it } from "vitest";
import {
  normalizeComplianceResult,
  type ComplianceResult,
} from "./llm";

describe("normalizeComplianceResult", () => {
  it("downgrades mandatory post-dated cheque clauses to needs_review", () => {
    const clause =
      "The Tenants agree to provide ten [10] post dated cheques for the balance of the lease on occupancy.";
    const result: ComplianceResult = {
      status: "non_compliant",
      clauseTitle: "Post-Dated Cheques",
      reason: "This requires post-dated cheques.",
      citations: [],
      severity: "high",
      issue: "Mandatory payment method",
      legalBasis: null,
      suggestion: null,
    };

    const normalized = normalizeComplianceResult(clause, result);

    expect(normalized.status).toBe("needs_review");
    expect(normalized.severity).toBe("high");
    expect(normalized.issue).toBe("Post-dated cheque requirement");
    expect(normalized.citations).toContain("RTA s. 108");
    expect(normalized.reason).toContain("post-dated cheques");
  });

  it("leaves non-post-dated clauses unchanged", () => {
    const clause = "No smoking is permitted anywhere on the premises.";
    const result: ComplianceResult = {
      status: "non_compliant",
      clauseTitle: "Smoking Ban",
      reason: "Original reason",
      citations: ["RTA s. 14"],
      severity: "high",
      issue: "Issue",
      legalBasis: "Basis",
      suggestion: "Suggestion",
    };

    expect(normalizeComplianceResult(clause, result)).toEqual(result);
  });
});
