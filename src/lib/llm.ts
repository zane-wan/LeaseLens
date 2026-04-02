import { generateObject } from "ai";
import { z } from "zod";
import { analysisModelConfig, systemPrompts } from "@/config/llm";

// ---------------------------------------------------------------------------
// Output schema — matches ClauseResult fields in the Prisma schema
// ---------------------------------------------------------------------------

export const complianceResultSchema = z.object({
  status: z.enum(["compliant", "non_compliant", "needs_review"]),
  clauseTitle: z
    .string()
    .describe("Short descriptive title for this clause (e.g. 'Pet Restriction')"),
  reason: z
    .string()
    .describe("Plain-language explanation of the compliance assessment"),
  citations: z
    .array(z.string())
    .describe("Relevant statute section references (e.g. 'RTA s. 134(1)')"),
  severity: z
    .enum(["low", "medium", "high"])
    .nullable()
    .describe("Severity of the issue (null if compliant)"),
  issue: z
    .string()
    .nullable()
    .describe("Specific legal issue identified (null if compliant)"),
  legalBasis: z
    .string()
    .nullable()
    .describe("The legal basis for the assessment"),
  suggestion: z
    .string()
    .nullable()
    .describe("Suggested remediation or modification (null if compliant)"),
});

export type ComplianceResult = z.infer<typeof complianceResultSchema>;

function uniqStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isPostDatedChequeClause(clause: string): boolean {
  return /post[\s-]?dated\s+cheques?/i.test(clause);
}

function hasMandatoryPaymentWording(clause: string): boolean {
  return /\b(?:shall|must|required|agrees?\s+to\s+provide|provide|will\s+provide|upon\s+(?:signing|execution|occupancy))\b/i.test(
    clause,
  );
}

/**
 * Normalize common high-variance outputs so the UI remains consistent even if
 * the model overstates a clause's certainty.
 */
export function normalizeComplianceResult(
  clause: string,
  result: ComplianceResult,
): ComplianceResult {
  if (
    isPostDatedChequeClause(clause) &&
    (result.status === "non_compliant" || hasMandatoryPaymentWording(clause))
  ) {
    return {
      ...result,
      status: "needs_review",
      severity: result.severity ?? "medium",
      issue: "Post-dated cheque requirement",
      citations: uniqStrings([...result.citations, "RTA s. 108"]),
      legalBasis:
        "RTA s. 108 prohibits requiring a tenant or prospective tenant to provide post-dated cheques for rent. Clauses that appear to make post-dated cheques mandatory should be reviewed carefully, especially if the wording also suggests consent or mixes in otherwise permissible NSF-related terms.",
      reason:
        "This clause refers to post-dated cheques in a way that appears mandatory. Ontario law allows tenants to choose that payment method voluntarily, but a landlord cannot require it. Because these clauses often mix lawful and unlawful payment terms, this is better treated as needing review rather than an automatic non-compliance finding.",
      suggestion:
        "Revise the clause so any post-dated cheques are clearly optional and voluntary, and allow other lawful rent payment methods.",
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Single-clause analysis — one clause in, one judgment out.
// Parallel orchestration of multiple clauses lives in the pipeline orchestrator.
// ---------------------------------------------------------------------------

export async function analyzeClause(
  clause: string,
  legalContext: string[],
): Promise<ComplianceResult> {
  const contextBlock = legalContext.join("\n\n");

  const { object } = await generateObject({
    model: analysisModelConfig.model,
    schema: complianceResultSchema,
    temperature: analysisModelConfig.temperature,
    maxTokens: analysisModelConfig.maxTokens,
    system: systemPrompts.analysis,
    prompt: `## Lease clause\n${clause}\n\n## Relevant legal context\n${contextBlock}`,
  });

  return normalizeComplianceResult(clause, object);
}
