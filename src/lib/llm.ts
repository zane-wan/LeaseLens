import { generateObject } from "ai";
import { z } from "zod";
import { modelConfig, systemPrompts } from "@/config/llm";

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
    model: modelConfig.model,
    schema: complianceResultSchema,
    temperature: modelConfig.temperature,
    maxTokens: modelConfig.maxTokens,
    system: systemPrompts.analysis,
    prompt: `## Lease clause\n${clause}\n\n## Relevant legal context\n${contextBlock}`,
  });

  return object;
}
