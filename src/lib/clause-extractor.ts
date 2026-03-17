// ---------------------------------------------------------------------------
// Clause extraction — isolates custom clauses from uploaded lease PDFs.
//
// Strategy 1 (primary): Semantic anchor detection for OSL-format leases.
//   Finds "Section 15 / Additional Terms" and Schedule A/B/C.
//
// Strategy 2 (fallback): LLM-based extraction for non-standard formats
//   (Form 400, older leases, custom-drafted).
// ---------------------------------------------------------------------------

import { generateObject } from "ai";
import { z } from "zod";
import { openai } from "@/config/llm";

export interface ExtractedClause {
  text: string;
  source:
    | "section_15"
    | "schedule_a"
    | "schedule_b"
    | "schedule_c"
    | "llm_extracted";
}

/**
 * Extract custom clauses from lease text.
 * Tries semantic anchors first; falls back to LLM extraction.
 */
export async function extractClauses(
  leaseText: string,
): Promise<ExtractedClause[]> {
  // Strategy 1: Semantic anchor detection (OSL format)
  const section15 = extractSection15(leaseText);
  const schedules = extractSchedules(leaseText);

  if (section15.length > 0 || schedules.length > 0) {
    return [...section15, ...schedules];
  }

  // Strategy 2: LLM-based extraction (non-standard format)
  return extractClausesWithLLM(leaseText);
}

// ---------------------------------------------------------------------------
// Strategy 1: Semantic Anchor Detection
// ---------------------------------------------------------------------------

function extractSection15(text: string): ExtractedClause[] {
  const headerPatterns = [
    /(?:^|\n)\s*15\.\s*(?:Additional\s+Terms?|ADDITIONAL\s+TERMS?)/i,
    /(?:^|\n)\s*(?:Section\s+15|SECTION\s+15)[:\s]/i,
    /(?:^|\n)\s*(?:Additional\s+Terms?|ADDITIONAL\s+TERMS?)\s*(?:\n|$)/i,
  ];

  let startIdx = -1;
  for (const pattern of headerPatterns) {
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      startIdx = match.index + match[0].length;
      break;
    }
  }

  if (startIdx === -1) return [];

  // Find the end: next numbered section, signature block, or schedule
  const endPatterns = [
    /(?:^|\n)\s*16\.\s/m,
    /(?:^|\n)\s*(?:Signature|SIGNATURE)/im,
    /(?:^|\n)\s*(?:Landlord|LANDLORD)\s*(?:'s\s+)?(?:Signature|Sign)/im,
    /(?:^|\n)\s*(?:Tenant|TENANT)\s*(?:'s\s+)?(?:Signature|Sign)/im,
    /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+[A-C]\b/im,
  ];

  let endIdx = text.length;
  const remaining = text.slice(startIdx);
  for (const pattern of endPatterns) {
    const match = remaining.match(pattern);
    if (match?.index !== undefined) {
      endIdx = Math.min(endIdx, startIdx + match.index);
    }
  }

  const sectionText = text.slice(startIdx, endIdx).trim();
  if (!sectionText) return [];

  return splitIntoClauses(sectionText, "section_15");
}

function extractSchedules(text: string): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];

  const schedules: {
    pattern: RegExp;
    source: "schedule_a" | "schedule_b" | "schedule_c";
  }[] = [
    {
      pattern: /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+A\b/im,
      source: "schedule_a",
    },
    {
      pattern: /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+B\b/im,
      source: "schedule_b",
    },
    {
      pattern: /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+C\b/im,
      source: "schedule_c",
    },
  ];

  // Find all schedule positions
  const positions: { start: number; end: number; source: ExtractedClause["source"] }[] = [];

  for (const { pattern, source } of schedules) {
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      positions.push({
        start: match.index + match[0].length,
        end: text.length,
        source,
      });
    }
  }

  // Sort by position and set end boundaries
  positions.sort((a, b) => a.start - b.start);
  for (let i = 0; i < positions.length - 1; i++) {
    positions[i].end = positions[i + 1].start - (positions[i + 1].start - positions[i].start > 0 ? positions[i + 1].start - positions[i].start - (positions[i + 1].end - positions[i + 1].start) : 0);
  }

  // Simpler: each schedule ends where the next one begins
  for (let i = 0; i < positions.length; i++) {
    const endIdx = i < positions.length - 1
      ? positions[i + 1].start - 20 // back up before the next "Schedule X" header
      : text.length;

    const scheduleText = text.slice(positions[i].start, endIdx).trim();
    if (scheduleText.length > 20) {
      clauses.push(...splitIntoClauses(scheduleText, positions[i].source));
    }
  }

  return clauses;
}

/**
 * Split a block of text into individual clauses by common markers.
 */
function splitIntoClauses(
  text: string,
  source: ExtractedClause["source"],
): ExtractedClause[] {
  // Split by lettered items (a), (b), numbered items (1), (2), or bullet markers
  const parts = text
    .split(/(?:^|\n)\s*(?:\([a-z]\)|\(\d+\)|\d+[\.)]\s|[•\-\*]\s)/m)
    .map((p) => p.trim())
    .filter((p) => p.length > 15);

  if (parts.length === 0) {
    // No clause markers found — treat the whole block as one clause
    return text.trim().length > 15 ? [{ text: text.trim(), source }] : [];
  }

  return parts.map((p) => ({ text: p, source }));
}

// ---------------------------------------------------------------------------
// Strategy 2: LLM-based extraction (fallback)
// ---------------------------------------------------------------------------

async function extractClausesWithLLM(
  leaseText: string,
): Promise<ExtractedClause[]> {
  // Truncate to ~12K chars to keep token costs low with GPT-4o-mini
  const truncated = leaseText.slice(0, 12_000);

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      clauses: z.array(
        z.object({
          text: z.string().describe("The exact clause text from the document"),
        }),
      ),
    }),
    temperature: 0.1,
    system: `You are a legal document analyst specializing in Ontario residential leases.
Extract only the clauses that impose specific rules, obligations, or restrictions on the tenant or landlord beyond standard lease terms.
Ignore standard administrative details (names, addresses, rent amount, lease start/end dates, standard legal boilerplate that appears in every Ontario Standard Lease).
Return each custom clause as a separate item with its exact text from the document.`,
    prompt: `Extract the custom clauses from this lease:\n\n${truncated}`,
  });

  return object.clauses.map((c) => ({ text: c.text, source: "llm_extracted" as const }));
}

// ---------------------------------------------------------------------------
// Clause categorization — tags each clause for category-filtered RAG retrieval
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  "pets",
  "maintenance",
  "deposits",
  "entry",
  "termination",
  "rent",
  "guests",
  "parking",
  "utilities",
  "subletting",
  "other",
] as const;

export type ClauseCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Classify a clause into an RTA category using GPT-4o-mini.
 * Used to filter RAG retrieval to relevant statute sections.
 */
export async function categorizeClause(
  clauseText: string,
): Promise<ClauseCategory> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      category: z
        .enum(VALID_CATEGORIES)
        .describe("The legal topic category this clause relates to"),
    }),
    temperature: 0,
    system:
      "Classify the following lease clause into exactly one category based on its primary legal topic.",
    prompt: clauseText,
  });

  return object.category;
}
