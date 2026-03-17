import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Unit tests for RAG retrieval — tests RRF algorithm and search orchestration.
// Database-dependent tests are marked with .skip unless RDS is available.
// ---------------------------------------------------------------------------

// Mock external dependencies for unit tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("@/lib/embedding", () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

import { retrieveContext, hybridSearch } from "./rag";
import { prisma } from "@/lib/prisma";

const mockQueryRaw = vi.mocked(prisma.$queryRawUnsafe);

describe("retrieveContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted context strings with citations", async () => {
    const vectorResults = [
      {
        id: "1",
        content: "No landlord shall charge a pet deposit.",
        fullCitation: "RTA s. 14",
        section: "14",
        sectionTitle: "No pet restrictions",
        category: "pets",
        score: 0.9,
      },
    ];
    const keywordResults = [
      {
        id: "1",
        content: "No landlord shall charge a pet deposit.",
        fullCitation: "RTA s. 14",
        section: "14",
        sectionTitle: "No pet restrictions",
        category: "pets",
        score: 0.8,
      },
    ];

    // First call = vector search, second call = keyword search
    mockQueryRaw.mockResolvedValueOnce(vectorResults);
    mockQueryRaw.mockResolvedValueOnce(keywordResults);

    const results = await retrieveContext("no pets allowed");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toContain("[RTA s. 14]");
    expect(results[0]).toContain("No landlord shall charge a pet deposit.");
  });

  it("returns empty array when no results found", async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const results = await retrieveContext("completely unrelated query xyz");

    expect(results).toEqual([]);
  });

  it("passes category filter when provided", async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    mockQueryRaw.mockResolvedValueOnce([]);

    await retrieveContext("no pets", { category: "pets" });

    // Vector search call should include category parameter
    const vectorCall = mockQueryRaw.mock.calls[0];
    expect(vectorCall[0]).toContain("category = $2");
    expect(vectorCall[2]).toBe("pets");

    // Keyword search call should include category parameter
    const keywordCall = mockQueryRaw.mock.calls[1];
    expect(keywordCall[0]).toContain("category = $2");
    expect(keywordCall[2]).toBe("pets");
  });

  it("omits category filter when not provided", async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    mockQueryRaw.mockResolvedValueOnce([]);

    await retrieveContext("no pets");

    const vectorCall = mockQueryRaw.mock.calls[0];
    expect(vectorCall[0]).not.toContain("category = $2");
  });
});

describe("hybridSearch — RRF merging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges vector and keyword results via RRF", async () => {
    const vectorResults = [
      { id: "a", content: "Section A", fullCitation: "RTA s. 1", section: "1", sectionTitle: "Title A", category: "rent", score: 0.95 },
      { id: "b", content: "Section B", fullCitation: "RTA s. 2", section: "2", sectionTitle: "Title B", category: "rent", score: 0.90 },
      { id: "c", content: "Section C", fullCitation: "RTA s. 3", section: "3", sectionTitle: "Title C", category: "rent", score: 0.85 },
    ];

    const keywordResults = [
      { id: "b", content: "Section B", fullCitation: "RTA s. 2", section: "2", sectionTitle: "Title B", category: "rent", score: 0.91 },
      { id: "a", content: "Section A", fullCitation: "RTA s. 1", section: "1", sectionTitle: "Title A", category: "rent", score: 0.80 },
      { id: "d", content: "Section D", fullCitation: "RTA s. 4", section: "4", sectionTitle: "Title D", category: "rent", score: 0.70 },
    ];

    mockQueryRaw.mockResolvedValueOnce(vectorResults);
    mockQueryRaw.mockResolvedValueOnce(keywordResults);

    const results = await hybridSearch("test query", { topK: 3 });

    expect(results.length).toBe(3);

    // "b" appears at rank 2 in vector and rank 1 in keyword → highest combined RRF
    // "a" appears at rank 1 in vector and rank 2 in keyword → second highest
    // Both should be in top 2
    const ids = results.map((r) => r.id);
    expect(ids.includes("a")).toBe(true);
    expect(ids.includes("b")).toBe(true);

    // "b" should rank higher because: 1/(60+2) + 1/(60+1) > 1/(60+1) + 1/(60+2)
    // Actually they're equal in this case. Let me reconsider.
    // vector: a=rank0, b=rank1, c=rank2
    // keyword: b=rank0, a=rank1, d=rank2
    // RRF(a) = 1/(60+1) + 1/(60+2) = 1/61 + 1/62
    // RRF(b) = 1/(60+2) + 1/(60+1) = 1/62 + 1/61
    // They're equal! So order depends on iteration. Both should be in top-2.
    expect(ids[0] === "a" || ids[0] === "b").toBe(true);
  });

  it("respects topK parameter", async () => {
    const vectorResults = [
      { id: "1", content: "C1", fullCitation: "s.1", section: "1", sectionTitle: "T1", category: "other", score: 0.9 },
      { id: "2", content: "C2", fullCitation: "s.2", section: "2", sectionTitle: "T2", category: "other", score: 0.8 },
      { id: "3", content: "C3", fullCitation: "s.3", section: "3", sectionTitle: "T3", category: "other", score: 0.7 },
    ];

    mockQueryRaw.mockResolvedValueOnce(vectorResults);
    mockQueryRaw.mockResolvedValueOnce([]);

    const results = await hybridSearch("test", { topK: 2 });
    expect(results.length).toBe(2);
  });

  it("deduplicates results appearing in both searches", async () => {
    const sameResult = {
      id: "same",
      content: "Same section",
      fullCitation: "RTA s. 14",
      section: "14",
      sectionTitle: "Same",
      category: "pets",
      score: 0.9,
    };

    mockQueryRaw.mockResolvedValueOnce([sameResult]);
    mockQueryRaw.mockResolvedValueOnce([sameResult]);

    const results = await hybridSearch("pets", { topK: 5 });

    // Should appear exactly once (deduplicated by id)
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("same");

    // Combined score should be higher than single-source score
    // RRF from vector (rank 0): 1/(60+1) ≈ 0.0164
    // RRF from keyword (rank 0): 1/(60+1) ≈ 0.0164
    // Combined: ≈ 0.0328
    expect(results[0].score).toBeGreaterThan(1 / 61);
  });
});
