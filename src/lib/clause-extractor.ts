// ---------------------------------------------------------------------------
// Clause extraction — isolates custom clauses from uploaded lease PDFs.
//
// Three-phase pipeline:
//   Phase 1: Detect form boundaries (Form 400, Form 401, OSL)
//   Phase 2: Multi-anchor extraction within each form region
//   Phase 3: Deduplication across forms + improved clause splitting
//
// Falls back to LLM-based extraction for non-standard formats.
// ---------------------------------------------------------------------------

import { generateObject } from "ai";
import { z } from "zod";
import { openai } from "@/config/llm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedClause {
  text: string;
  source:
    | "section_15"
    | "schedule_a"
    | "schedule_b"
    | "schedule_c"
    | "form400_section_8"
    | "form400_schedule_a"
    | "form400_schedule_b"
    | "form400_schedule_c"
    | "form401_schedule_a"
    | "form401_schedule_b"
    | "form401_schedule_c"
    | "llm_extracted";
}

interface FormRegion {
  form: "form_400" | "form_401" | "osl" | "unknown";
  startIdx: number;
  endIdx: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Extract custom clauses from lease text.
 * Detects form boundaries, extracts from all regions, deduplicates,
 * then falls back to LLM extraction if nothing found.
 */
export async function extractClauses(
  leaseText: string,
): Promise<ExtractedClause[]> {
  // Phase 1: Detect form boundaries
  const regions = detectFormBoundaries(leaseText);

  // Phase 2: Extract from all regions
  const rawClauses = extractFromRegions(leaseText, regions);

  if (rawClauses.length > 0) {
    // Phase 3: Deduplicate across forms
    return deduplicateClauses(rawClauses);
  }

  // Fallback: LLM extraction
  return extractClausesWithLLM(leaseText);
}

// ---------------------------------------------------------------------------
// Phase 1: Form Boundary Detection
// ---------------------------------------------------------------------------

const FORM_PATTERNS: { form: FormRegion["form"]; pattern: RegExp }[] = [
  { form: "form_400", pattern: /(?:^|\n)\s*(?:OREA\s+)?Form\s+400\b/gim },
  {
    form: "form_400",
    pattern: /(?:^|\n)\s*(?:AGREEMENT|OFFER)\s+TO\s+LEASE\b/gim,
  },
  { form: "form_401", pattern: /(?:^|\n)\s*(?:OREA\s+)?Form\s+401\b/gim },
  {
    form: "osl",
    pattern:
      /(?:^|\n)\s*(?:Ontario\s+)?Standard\s+(?:Form\s+of\s+)?Lease\b/gim,
  },
  {
    form: "osl",
    pattern: /(?:^|\n)\s*Residential\s+Tenancy\s+Agreement\b/gim,
  },
];

/**
 * Segment document text into form regions (Form 400, Form 401, OSL).
 * Returns a single "unknown" region if no form headers are found.
 */
export function detectFormBoundaries(text: string): FormRegion[] {
  const hits: { form: FormRegion["form"]; idx: number }[] = [];

  for (const { form, pattern } of FORM_PATTERNS) {
    // Reset lastIndex for global regex reuse
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      if (m.index !== undefined) {
        // Avoid duplicate hits for the same form at nearby positions
        const isDuplicate = hits.some(
          (h) => h.form === form && Math.abs(h.idx - m.index!) < 200,
        );
        if (!isDuplicate) {
          hits.push({ form, idx: m.index });
        }
      }
    }
  }

  if (hits.length === 0) {
    return [{ form: "unknown", startIdx: 0, endIdx: text.length }];
  }

  // Sort by position
  hits.sort((a, b) => a.idx - b.idx);

  // Deduplicate overlapping form detections at the same position
  // (e.g., "Form 400" and "AGREEMENT TO LEASE" on the same page)
  const deduped: typeof hits = [];
  for (const hit of hits) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.form === hit.form && hit.idx - prev.idx < 500) {
      continue; // skip — same form detected nearby
    }
    deduped.push(hit);
  }

  // Build regions
  const regions: FormRegion[] = [];
  for (let i = 0; i < deduped.length; i++) {
    regions.push({
      form: deduped[i].form,
      startIdx: deduped[i].idx,
      endIdx: i < deduped.length - 1 ? deduped[i + 1].idx : text.length,
    });
  }

  return regions;
}

// ---------------------------------------------------------------------------
// Phase 2: Region-Based Extraction
// ---------------------------------------------------------------------------

/**
 * Route each detected form region to the appropriate extractors.
 */
function extractFromRegions(
  text: string,
  regions: FormRegion[],
): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];

  for (const region of regions) {
    const regionText = text.slice(region.startIdx, region.endIdx);

    switch (region.form) {
      case "form_400":
        clauses.push(...extractSection8(regionText));
        clauses.push(...extractSchedules(regionText, "form_400"));
        break;
      case "form_401":
        clauses.push(...extractSchedules(regionText, "form_401"));
        break;
      case "osl":
        clauses.push(...extractSection15(regionText));
        clauses.push(...extractSchedules(regionText));
        break;
      case "unknown":
        // Try all extractors (backward-compatible behavior)
        clauses.push(...extractSection15(regionText));
        clauses.push(...extractSection8(regionText));
        clauses.push(...extractSchedules(regionText));
        break;
    }
  }

  return clauses;
}

// ---------------------------------------------------------------------------
// Section Extractors
// ---------------------------------------------------------------------------

/**
 * Extract clauses from OSL Section 15 "Additional Terms".
 */
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

/**
 * Extract clauses from Form 400 Section 8 "Additional Terms".
 */
function extractSection8(text: string): ExtractedClause[] {
  const headerPatterns = [
    /(?:^|\n)\s*8\.\s*(?:Additional\s+Terms?|ADDITIONAL\s+TERMS?)/i,
    /(?:^|\n)\s*(?:Section\s+8|SECTION\s+8)[:\s]/i,
    /(?:^|\n)\s*(?:Item\s+8|ITEM\s+8)[:\s]/i,
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

  const endPatterns = [
    /(?:^|\n)\s*9\.\s/m,
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

  return splitIntoClauses(sectionText, "form400_section_8");
}

// ---------------------------------------------------------------------------
// Schedule Extraction (supports multiple instances via matchAll)
// ---------------------------------------------------------------------------

type FormContext = "form_400" | "form_401";

function scheduleSource(
  letter: "a" | "b" | "c",
  formContext?: FormContext,
): ExtractedClause["source"] {
  if (formContext === "form_400") {
    return `form400_schedule_${letter}` as ExtractedClause["source"];
  }
  if (formContext === "form_401") {
    return `form401_schedule_${letter}` as ExtractedClause["source"];
  }
  return `schedule_${letter}` as ExtractedClause["source"];
}

/**
 * Extract clauses from all Schedule A/B/C instances in the text.
 * Uses matchAll to find every occurrence (not just the first).
 */
function extractSchedules(
  text: string,
  formContext?: FormContext,
): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];

  const scheduleConfigs: { pattern: RegExp; letter: "a" | "b" | "c" }[] = [
    { pattern: /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+A\b/gim, letter: "a" },
    { pattern: /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+B\b/gim, letter: "b" },
    { pattern: /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+C\b/gim, letter: "c" },
  ];

  // Collect all schedule positions
  const positions: {
    start: number;
    headerEnd: number;
    end: number;
    source: ExtractedClause["source"];
  }[] = [];

  for (const { pattern, letter } of scheduleConfigs) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index !== undefined) {
        positions.push({
          start: match.index,
          headerEnd: match.index + match[0].length,
          end: text.length,
          source: scheduleSource(letter, formContext),
        });
      }
    }
  }

  if (positions.length === 0) return [];

  // Sort by position in text
  positions.sort((a, b) => a.start - b.start);

  // Each schedule ends where the next one begins
  for (let i = 0; i < positions.length; i++) {
    const contentStart = positions[i].headerEnd;
    const contentEnd =
      i < positions.length - 1 ? positions[i + 1].start : text.length;

    const scheduleText = text.slice(contentStart, contentEnd).trim();
    if (scheduleText.length > 20) {
      clauses.push(...splitIntoClauses(scheduleText, positions[i].source));
    }
  }

  return clauses;
}

// ---------------------------------------------------------------------------
// Clause Splitting (improved)
// ---------------------------------------------------------------------------

/**
 * Split a block of text into individual clauses.
 *
 * Strategy:
 *   1. Try structured markers: numbered (1., 2.), lettered ((a), (b)), bullets
 *   2. Fall back to paragraph splitting (double newlines)
 *   3. Last resort: treat entire block as one clause
 */
function splitIntoClauses(
  text: string,
  source: ExtractedClause["source"],
): ExtractedClause[] {
  // Strategy 1: Find structured clause markers at the start of lines.
  // Uses matchAll for precise split positions.
  // - Lettered: (a), (b), (c) ...
  // - Parenthesized numbers: (1), (2), (3) ...
  // - Numbered with dot/paren at line start: "1. ", "2) "
  //   Negative lookbehind for $ avoids "$150. " and for digits avoids "10.5"
  const markerPattern =
    /(?:^|\n)\s*(?:\([a-z]\)\s|\(\d{1,3}\)\s|(?<!\$)(?<!\d)\d{1,3}\.\s(?!\d)|[•\-\*]\s)/gm;

  const matches = [...text.matchAll(markerPattern)];

  if (matches.length >= 2) {
    const parts: string[] = [];

    // Capture preamble before the first marker
    if (matches[0].index! > 0) {
      const preamble = text.slice(0, matches[0].index!).trim();
      if (preamble.length > 15) {
        parts.push(preamble);
      }
    }

    // Split at each marker
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end =
        i < matches.length - 1 ? matches[i + 1].index! : text.length;
      // Remove the marker prefix itself
      const raw = text.slice(start, end);
      const cleaned = raw
        .replace(
          /^\s*(?:\([a-z]\)\s*|\(\d{1,3}\)\s*|\d{1,3}[.)]\s*|[•\-\*]\s*)/,
          "",
        )
        .trim();
      if (cleaned.length > 15) {
        parts.push(cleaned);
      }
    }

    if (parts.length > 0) {
      return parts.map((p) => ({ text: p, source }));
    }
  }

  // Strategy 2: Paragraph-based splitting (double newlines)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 15);

  if (paragraphs.length > 1) {
    return paragraphs.map((p) => ({ text: p, source }));
  }

  // Strategy 3: Treat the whole block as one clause
  return text.trim().length > 15 ? [{ text: text.trim(), source }] : [];
}

// ---------------------------------------------------------------------------
// Phase 3: Deduplication
// ---------------------------------------------------------------------------

/**
 * Normalize text for deduplication comparison.
 */
function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute word-set Jaccard similarity between two strings.
 */
function wordOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 0));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 0));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Remove near-duplicate clauses that appear across multiple forms.
 * Keeps the first occurrence (earlier in document / higher-priority form).
 */
export function deduplicateClauses(
  clauses: ExtractedClause[],
): ExtractedClause[] {
  const result: ExtractedClause[] = [];
  const normalizedCache: string[] = [];

  for (const clause of clauses) {
    const normalized = normalizeForDedup(clause.text);

    let isDuplicate = false;
    for (const existing of normalizedCache) {
      if (wordOverlapRatio(normalized, existing) > 0.85) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(clause);
      normalizedCache.push(normalized);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// LLM-based extraction (fallback)
// ---------------------------------------------------------------------------

/**
 * Smart truncation: preserves content around schedule/additional-terms markers.
 */
function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const FRONT_CHARS = 4000;
  const MARKER_CONTEXT = 6000; // chars to keep around each marker

  // Always keep the front of the document
  const chunks: { start: number; end: number }[] = [
    { start: 0, end: Math.min(FRONT_CHARS, text.length) },
  ];

  // Find schedule and additional-terms markers
  const markerPatterns = [
    /(?:Schedule|SCHEDULE)\s+[A-C]\b/gi,
    /(?:Additional\s+Terms?|ADDITIONAL\s+TERMS?)/gi,
    /8\.\s*(?:Additional|ADDITIONAL)/gi,
  ];

  for (const pattern of markerPatterns) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      if (m.index !== undefined) {
        const start = Math.max(0, m.index - 500);
        const end = Math.min(text.length, m.index + MARKER_CONTEXT);
        chunks.push({ start, end });
      }
    }
  }

  // Merge overlapping chunks
  chunks.sort((a, b) => a.start - b.start);
  const merged: typeof chunks = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = merged[merged.length - 1];
    if (chunks[i].start <= prev.end) {
      prev.end = Math.max(prev.end, chunks[i].end);
    } else {
      merged.push(chunks[i]);
    }
  }

  // Build truncated text with gap indicators
  const parts: string[] = [];
  let totalLen = 0;
  for (const chunk of merged) {
    if (totalLen > 0) {
      parts.push("\n...[text omitted]...\n");
      totalLen += 25;
    }
    const slice = text.slice(chunk.start, chunk.end);
    if (totalLen + slice.length > maxChars) {
      parts.push(slice.slice(0, maxChars - totalLen));
      break;
    }
    parts.push(slice);
    totalLen += slice.length;
  }

  return parts.join("");
}

async function extractClausesWithLLM(
  leaseText: string,
): Promise<ExtractedClause[]> {
  const truncated = smartTruncate(leaseText, 48_000);

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
Look for custom clauses in these locations:
- Section 15 "Additional Terms" (Ontario Standard Lease)
- Section 8 "Additional Terms" (Form 400 Agreement to Lease)
- Schedule A, Schedule B, Schedule C (may appear multiple times from different forms — Form 400 and Form 401)
- Any other sections containing landlord-added rules or restrictions
Ignore standard administrative details (names, addresses, rent amount, lease start/end dates, standard legal boilerplate that appears in every Ontario Standard Lease).
Do NOT return duplicate clauses that appear in multiple schedules.
Return each custom clause as a separate item with its exact text from the document.`,
    prompt: `Extract the custom clauses from this lease:\n\n${truncated}`,
  });

  return object.clauses.map((c) => ({
    text: c.text,
    source: "llm_extracted" as const,
  }));
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
