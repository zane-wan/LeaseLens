import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Unit tests for the analysis pipeline orchestrator.
// All external dependencies (Prisma, S3, OpenAI) are mocked.
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    analysis: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    agreement: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    clauseResult: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/pdf", () => ({
  extractPdfText: vi.fn(),
}));

vi.mock("@/lib/clause-extractor", () => ({
  extractClauses: vi.fn(),
  categorizeClause: vi.fn(),
}));

vi.mock("@/lib/rag", () => ({
  retrieveContext: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  analyzeClause: vi.fn(),
}));

import { runAnalysisPipeline } from "./orchestrator";
import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/pdf";
import { extractClauses, categorizeClause } from "@/lib/clause-extractor";
import { retrieveContext } from "@/lib/rag";
import { analyzeClause } from "@/lib/llm";

const mockPrisma = vi.mocked(prisma);
const mockExtractPdf = vi.mocked(extractPdfText);
const mockExtractClauses = vi.mocked(extractClauses);
const mockCategorize = vi.mocked(categorizeClause);
const mockRetrieve = vi.mocked(retrieveContext);
const mockAnalyze = vi.mocked(analyzeClause);

describe("runAnalysisPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.analysis.upsert.mockResolvedValue({
      id: "analysis-1",
      agreementId: "agreement-1",
      status: "PROCESSING",
      overallSummary: null,
      riskScore: null,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.agreement.update.mockResolvedValue({} as never);
    mockPrisma.agreement.findUniqueOrThrow.mockResolvedValue({
      id: "agreement-1",
      s3Key: "uploads/test.pdf",
      userId: "user-1",
      fileName: "test.pdf",
      s3Url: null,
      status: "PENDING",
      isGenerated: false,
      prevDoc: null,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.analysis.update.mockResolvedValue({} as never);
    mockPrisma.clauseResult.createMany.mockResolvedValue({ count: 0 });
  });

  it("completes successfully with clauses found", async () => {
    mockExtractPdf.mockResolvedValue("15. Additional Terms\n(a) No pets allowed.");
    mockExtractClauses.mockResolvedValue([
      { text: "No pets allowed.", source: "section_15" },
    ]);
    mockCategorize.mockResolvedValue("pets");
    mockRetrieve.mockResolvedValue(["[RTA s. 14] No pet restrictions..."]);
    mockAnalyze.mockResolvedValue({
      status: "non_compliant",
      clauseTitle: "Pet Restriction",
      reason: "Blanket pet bans are void under s.14.",
      citations: ["RTA s. 14"],
      severity: "high",
      issue: "Blanket no-pets clause",
      legalBasis: "RTA s. 14 prohibits no-pet provisions",
      suggestion: "Remove the no-pets clause.",
    });

    await runAnalysisPipeline("agreement-1");

    // Should create analysis record
    expect(mockPrisma.analysis.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agreementId: "agreement-1" },
      }),
    );

    // Should extract PDF text
    expect(mockExtractPdf).toHaveBeenCalledWith("uploads/test.pdf");

    // Should extract clauses
    expect(mockExtractClauses).toHaveBeenCalled();

    // Should categorize the clause
    expect(mockCategorize).toHaveBeenCalledWith("No pets allowed.");

    // Should retrieve context with category filter
    expect(mockRetrieve).toHaveBeenCalledWith("No pets allowed.", {
      category: "pets",
    });

    // Should analyze the clause with retrieved context
    expect(mockAnalyze).toHaveBeenCalledWith("No pets allowed.", [
      "[RTA s. 14] No pet restrictions...",
    ]);

    // Should store clause results
    expect(mockPrisma.clauseResult.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          analysisId: "analysis-1",
          clauseText: "No pets allowed.",
          compliance: "NON_COMPLIANT",
          severity: "HIGH",
        }),
      ],
    });

    // Should complete analysis
    expect(mockPrisma.analysis.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          riskScore: expect.any(Number),
        }),
      }),
    );
  });

  it("handles no clauses found gracefully", async () => {
    mockExtractPdf.mockResolvedValue("Standard lease with no custom clauses.");
    mockExtractClauses.mockResolvedValue([]);

    await runAnalysisPipeline("agreement-1");

    // Should NOT call categorize, retrieve, or analyze
    expect(mockCategorize).not.toHaveBeenCalled();
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockAnalyze).not.toHaveBeenCalled();

    // Should still complete
    expect(mockPrisma.analysis.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          riskScore: 0,
          overallSummary: "No custom clauses were found in this lease to analyze.",
        }),
      }),
    );
  });

  it("handles multiple clauses in parallel", async () => {
    mockExtractPdf.mockResolvedValue("lease text");
    mockExtractClauses.mockResolvedValue([
      { text: "No pets.", source: "section_15" },
      { text: "Key deposit $500.", source: "section_15" },
      { text: "No guests after 10pm.", source: "section_15" },
    ]);
    mockCategorize
      .mockResolvedValueOnce("pets")
      .mockResolvedValueOnce("deposits")
      .mockResolvedValueOnce("guests");
    mockRetrieve.mockResolvedValue(["[RTA s. 14] context..."]);
    mockAnalyze.mockResolvedValue({
      status: "compliant",
      clauseTitle: "Test",
      reason: "OK",
      citations: [],
      severity: null,
      issue: null,
      legalBasis: null,
      suggestion: null,
    });

    await runAnalysisPipeline("agreement-1");

    // All three clauses should be analyzed
    expect(mockAnalyze).toHaveBeenCalledTimes(3);
    expect(mockCategorize).toHaveBeenCalledTimes(3);
  });

  it("sets FAILED status on error", async () => {
    mockExtractPdf.mockRejectedValue(new Error("S3 connection failed"));

    await expect(runAnalysisPipeline("agreement-1")).rejects.toThrow(
      "S3 connection failed",
    );

    // Should mark both analysis and agreement as FAILED
    expect(mockPrisma.analysis.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "S3 connection failed",
        }),
      }),
    );
    expect(mockPrisma.agreement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "FAILED" },
      }),
    );
  });

  it("computes risk score correctly", async () => {
    mockExtractPdf.mockResolvedValue("text");
    mockExtractClauses.mockResolvedValue([
      { text: "clause 1", source: "section_15" },
      { text: "clause 2", source: "section_15" },
      { text: "clause 3", source: "section_15" },
      { text: "clause 4", source: "section_15" },
    ]);
    mockCategorize.mockResolvedValue("other");
    mockRetrieve.mockResolvedValue([]);

    // 1 non-compliant, 1 needs_review, 2 compliant
    mockAnalyze
      .mockResolvedValueOnce({
        status: "non_compliant",
        clauseTitle: "Bad clause",
        reason: "Violates law",
        citations: ["s.1"],
        severity: "high",
        issue: "issue",
        legalBasis: "basis",
        suggestion: "fix it",
      })
      .mockResolvedValueOnce({
        status: "needs_review",
        clauseTitle: "Ambiguous",
        reason: "Unclear",
        citations: [],
        severity: "medium",
        issue: "unclear",
        legalBasis: null,
        suggestion: null,
      })
      .mockResolvedValueOnce({
        status: "compliant",
        clauseTitle: "Good 1",
        reason: "Fine",
        citations: [],
        severity: null,
        issue: null,
        legalBasis: null,
        suggestion: null,
      })
      .mockResolvedValueOnce({
        status: "compliant",
        clauseTitle: "Good 2",
        reason: "Fine",
        citations: [],
        severity: null,
        issue: null,
        legalBasis: null,
        suggestion: null,
      });

    await runAnalysisPipeline("agreement-1");

    // Risk score: (1*2 + 1) / (4*2) * 100 = 3/8 * 100 = 37.5 → 38
    const updateCall = mockPrisma.analysis.update.mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data.status === "COMPLETED",
    );
    expect(updateCall).toBeDefined();
    const data = (updateCall![0] as { data: { riskScore: number } }).data;
    expect(data.riskScore).toBe(38);
  });
});
