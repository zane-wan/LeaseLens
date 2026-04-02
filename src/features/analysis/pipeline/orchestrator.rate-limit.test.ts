import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/pdf";
import { extractClauses, categorizeClause } from "@/lib/clause-extractor";
import { retrieveContext } from "@/lib/rag";
import { analyzeClause } from "@/lib/llm";
import { runAnalysisPipeline } from "./orchestrator";

const mockPrisma = vi.mocked(prisma);
const mockExtractPdf = vi.mocked(extractPdfText);
const mockExtractClauses = vi.mocked(extractClauses);
const mockCategorize = vi.mocked(categorizeClause);
const mockRetrieve = vi.mocked(retrieveContext);
const mockAnalyze = vi.mocked(analyzeClause);

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("runAnalysisPipeline rate-limit protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
      s3Key: "uploads/offer.pdf",
      userId: "user-1",
      fileName: "offer.pdf",
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

  it("limits concurrent clause analyses", async () => {
    mockExtractPdf.mockResolvedValue("lease text");
    mockExtractClauses.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        text: `Clause ${i + 1}`,
        source: "form400_schedule_a" as const,
      })),
    );
    mockCategorize.mockResolvedValue("other");
    mockRetrieve.mockResolvedValue([]);

    let inFlight = 0;
    let maxInFlight = 0;
    const resolvers: Array<() => void> = [];

    mockAnalyze.mockImplementation(
      () =>
        new Promise((resolve) => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          resolvers.push(() => {
            inFlight--;
            resolve({
              status: "compliant",
              clauseTitle: "Clause",
              reason: "OK",
              citations: [],
              severity: null,
              issue: null,
              legalBasis: null,
              suggestion: null,
            });
          });
        }),
    );

    const pipelinePromise = runAnalysisPipeline("agreement-1");
    await flushMicrotasks();

    expect(mockAnalyze).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(3);

    resolvers.splice(0, 3).forEach((resolve) => resolve());
    await flushMicrotasks();

    expect(mockAnalyze).toHaveBeenCalledTimes(5);
    expect(maxInFlight).toBe(3);

    resolvers.splice(0).forEach((resolve) => resolve());
    await pipelinePromise;

    expect(maxInFlight).toBeLessThanOrEqual(3);
  });
});
