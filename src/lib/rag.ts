// ---------------------------------------------------------------------------
// RAG retrieval — hybrid search (vector + keyword) with Reciprocal Rank Fusion.
// Returns relevant RTA statute sections for a given lease clause.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/embedding";

export interface RagResult {
  id: string;
  content: string;
  fullCitation: string;
  section: string;
  sectionTitle: string;
  category: string;
  score: number;
}

/**
 * Retrieve relevant RTA context for a lease clause.
 * Returns formatted strings ready to inject into LLM prompt.
 */
export async function retrieveContext(
  query: string,
  options: { topK?: number; category?: string } = {},
): Promise<string[]> {
  const results = await hybridSearch(query, options);
  return results.map((r) => `[${r.fullCitation}] ${r.content}`);
}

/**
 * Hybrid search: vector similarity + keyword full-text search, merged with RRF.
 */
export async function hybridSearch(
  query: string,
  options: { topK?: number; category?: string } = {},
): Promise<RagResult[]> {
  const { topK = 5, category } = options;

  const queryEmbedding = await embedText(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(embeddingStr, { limit: 10, category }),
    keywordSearch(query, { limit: 10, category }),
  ]);

  return reciprocalRankFusion(vectorResults, keywordResults, topK);
}

// ---------------------------------------------------------------------------
// Internal search methods
// ---------------------------------------------------------------------------

interface SearchRow {
  id: string;
  content: string;
  fullCitation: string;
  section: string;
  sectionTitle: string;
  category: string;
  score: number;
}

async function vectorSearch(
  embeddingStr: string,
  options: { limit: number; category?: string },
): Promise<SearchRow[]> {
  const { limit, category } = options;

  if (category) {
    return prisma.$queryRawUnsafe<SearchRow[]>(
      `SELECT id, content, "fullCitation", section, "sectionTitle", category,
              1 - (embedding <=> $1::vector) AS score
       FROM "RtaChunk"
       WHERE embedding IS NOT NULL AND category = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      embeddingStr,
      category,
      limit,
    );
  }

  return prisma.$queryRawUnsafe<SearchRow[]>(
    `SELECT id, content, "fullCitation", section, "sectionTitle", category,
            1 - (embedding <=> $1::vector) AS score
     FROM "RtaChunk"
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    embeddingStr,
    limit,
  );
}

async function keywordSearch(
  query: string,
  options: { limit: number; category?: string },
): Promise<SearchRow[]> {
  const { limit, category } = options;

  if (category) {
    return prisma.$queryRawUnsafe<SearchRow[]>(
      `SELECT id, content, "fullCitation", section, "sectionTitle", category,
              ts_rank("searchText", plainto_tsquery('english', $1)) AS score
       FROM "RtaChunk"
       WHERE "searchText" @@ plainto_tsquery('english', $1) AND category = $2
       ORDER BY score DESC
       LIMIT $3`,
      query,
      category,
      limit,
    );
  }

  return prisma.$queryRawUnsafe<SearchRow[]>(
    `SELECT id, content, "fullCitation", section, "sectionTitle", category,
            ts_rank("searchText", plainto_tsquery('english', $1)) AS score
     FROM "RtaChunk"
     WHERE "searchText" @@ plainto_tsquery('english', $1)
     ORDER BY score DESC
     LIMIT $2`,
    query,
    limit,
  );
}

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion
// RRF_score(doc) = Σ 1 / (k + rank_i)   where k = 60
// ---------------------------------------------------------------------------

function reciprocalRankFusion(
  vectorResults: SearchRow[],
  keywordResults: SearchRow[],
  topK: number,
  k = 60,
): RagResult[] {
  const scores = new Map<string, { row: SearchRow; score: number }>();

  for (const [rank, row] of vectorResults.entries()) {
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(row.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(row.id, { row, score: rrfScore });
    }
  }

  for (const [rank, row] of keywordResults.entries()) {
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(row.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(row.id, { row, score: rrfScore });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ row, score }) => ({
      id: row.id,
      content: row.content,
      fullCitation: row.fullCitation,
      section: row.section,
      sectionTitle: row.sectionTitle,
      category: row.category,
      score,
    }));
}
