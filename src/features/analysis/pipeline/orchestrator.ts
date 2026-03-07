import { retrieveContext } from "@/lib/rag";
import { analyzeClause, type ComplianceResult } from "@/lib/llm";

// ---------------------------------------------------------------------------
// Pipeline orchestrator — fans out RAG + LLM calls in parallel across clauses.
// ---------------------------------------------------------------------------

export async function analyzeAgreement(
  clauses: string[],
): Promise<ComplianceResult[]> {
  const results = await Promise.all(
    clauses.map(async (clause) => {
      const context = await retrieveContext(clause);
      return analyzeClause(clause, context);
    }),
  );

  return results;
}
