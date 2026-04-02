import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/pdf";
import { extractClauses, categorizeClause } from "@/lib/clause-extractor";
import { retrieveContext } from "@/lib/rag";
import { analyzeClause, type ComplianceResult } from "@/lib/llm";

// ---------------------------------------------------------------------------
// Pipeline orchestrator — end-to-end lease analysis.
//
// 1. Update status to PROCESSING
// 2. Extract PDF text from S3
// 3. Isolate custom clauses (semantic anchors / LLM fallback)
// 4. Per clause: categorize → RAG retrieve → LLM analyze (in parallel)
// 5. Store ClauseResult records + overall summary
// 6. Update status to COMPLETED (or FAILED)
// ---------------------------------------------------------------------------

/** Map LLM output labels to Prisma enum values. */
const COMPLIANCE_MAP = {
  compliant: "COMPLIANT",
  non_compliant: "NON_COMPLIANT",
  needs_review: "NEEDS_REVIEW",
} as const;

const SEVERITY_MAP = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
} as const;

const ANALYSIS_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex++;
      if (currentIndex >= items.length) return;

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function runAnalysisPipeline(agreementId: string): Promise<void> {
  // Create or update Analysis record → PROCESSING
  const analysis = await prisma.analysis.upsert({
    where: { agreementId },
    update: { status: "PROCESSING", startedAt: new Date(), errorMessage: null },
    create: {
      agreementId,
      status: "PROCESSING",
      startedAt: new Date(),
    },
  });

  await prisma.agreement.update({
    where: { id: agreementId },
    data: { status: "PROCESSING" },
  });

  try {
    // 1. Fetch the agreement to get the S3 key
    const agreement = await prisma.agreement.findUniqueOrThrow({
      where: { id: agreementId },
    });

    // 2. Extract PDF text
    const pdfText = await extractPdfText(agreement.s3Key);

    // 3. Isolate custom clauses
    const extractedClauses = await extractClauses(pdfText);

    if (extractedClauses.length === 0) {
      await completeAnalysis(analysis.id, agreementId, [], []);
      return;
    }

    // 4. Per clause: categorize → RAG → LLM (in parallel)
    const results = await mapWithConcurrency(
      extractedClauses,
      ANALYSIS_CONCURRENCY,
      async (clause, index) => {
        const category = await categorizeClause(clause.text);
        const context = await retrieveContext(clause.text, { category });
        const result = await analyzeClause(clause.text, context);
        return { index, clauseText: clause.text, source: clause.source, result };
      },
    );

    // 5. Store results
    await completeAnalysis(
      analysis.id,
      agreementId,
      results.map((r) => r.result),
      results.map((r) => ({ text: r.clauseText, index: r.index })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { status: "FAILED", errorMessage: message },
    });
    await prisma.agreement.update({
      where: { id: agreementId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

async function completeAnalysis(
  analysisId: string,
  agreementId: string,
  results: ComplianceResult[],
  clauses: { text: string; index: number }[],
): Promise<void> {
  // Compute summary stats
  const nonCompliant = results.filter((r) => r.status === "non_compliant").length;
  const needsReview = results.filter((r) => r.status === "needs_review").length;
  const total = results.length;

  const riskScore = total > 0
    ? Math.round(((nonCompliant * 2 + needsReview) / (total * 2)) * 100)
    : 0;

  const overallSummary = buildSummary(total, nonCompliant, needsReview);

  // Create ClauseResult records
  if (results.length > 0) {
    await prisma.clauseResult.createMany({
      data: results.map((r, i) => ({
        analysisId,
        clauseIndex: clauses[i].index,
        clauseTitle: r.clauseTitle,
        clauseText: clauses[i].text,
        compliance: COMPLIANCE_MAP[r.status],
        explanation: r.reason,
        rtaCitations: r.citations,
        severity: r.severity ? SEVERITY_MAP[r.severity] : null,
        issue: r.issue,
        legalBasis: r.legalBasis,
        suggestion: r.suggestion,
      })),
    });
  }

  // Finalize analysis
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      status: "COMPLETED",
      overallSummary,
      riskScore,
      completedAt: new Date(),
    },
  });

  await prisma.agreement.update({
    where: { id: agreementId },
    data: { status: "COMPLETED" },
  });
}

function buildSummary(
  total: number,
  nonCompliant: number,
  needsReview: number,
): string {
  if (total === 0) {
    return "No custom clauses were found in this lease to analyze.";
  }

  const compliant = total - nonCompliant - needsReview;
  const parts: string[] = [];

  parts.push(`Analyzed ${total} custom clause${total === 1 ? "" : "s"}.`);

  if (nonCompliant > 0) {
    parts.push(
      `${nonCompliant} clause${nonCompliant === 1 ? " is" : "s are"} non-compliant with the Residential Tenancies Act.`,
    );
  }
  if (needsReview > 0) {
    parts.push(
      `${needsReview} clause${needsReview === 1 ? "" : "s"} may need further legal review.`,
    );
  }
  if (compliant > 0 && compliant === total) {
    parts.push("All clauses appear compliant with Ontario tenancy law.");
  }

  return parts.join(" ");
}
