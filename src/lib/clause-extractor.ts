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

type FormType =
  | "form_400"
  | "form_401"
  | "osl"
  | "form_410"
  | "form_324"
  | "form_105"
  | "osl_appendix"
  | "unknown";

/** Document types that never contain custom lease clauses. */
const IRRELEVANT_FORMS: ReadonlySet<FormType> = new Set([
  "form_410", // Rental Application — personal info only
  "form_324", // Confirmation of Co-operation — brokerage info
  "form_105", // Agreement of Purchase and Sale — different transaction
  "osl_appendix", // OSL Appendix: General Information — government boilerplate
]);

interface FormRegion {
  form: FormType;
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

  // Only fall back to LLM if the document is truly unrecognized.
  // If we identified known forms but found no clauses, that's a valid
  // result (e.g., a pure RTA with no additional terms).
  const hasKnownForms = regions.some((r) => r.form !== "unknown");
  if (hasKnownForms) {
    return [];
  }

  // Fallback: LLM extraction for completely unrecognized documents
  return extractClausesWithLLM(leaseText);
}

// ---------------------------------------------------------------------------
// Phase 1: Form Boundary Detection
// ---------------------------------------------------------------------------

/**
 * Patterns used to classify a single page's form type.
 * Each page is checked against all patterns; the first match wins.
 *
 * Two tiers:
 *   1. Form NUMBER patterns (e.g., "Form 400") — most reliable, always in
 *      page header/footer. Checked first to avoid false positives from
 *      title patterns appearing in body text (e.g., Form 400 mentions
 *      "Rental Application" in its body, which would falsely match Form 410).
 *   2. Title/marker patterns — fallback for pages without a form number.
 */
const PAGE_FORM_PATTERNS: { form: FormRegion["form"]; pattern: RegExp }[] = [
  // --- Tier 1: Form number patterns (highest priority) ---
  { form: "form_410", pattern: /Form\s+410\b/im },
  { form: "form_324", pattern: /Form\s+324\b/im },
  { form: "form_105", pattern: /Form\s+105\b/im },
  { form: "form_400", pattern: /Form\s+400\b/im },
  { form: "form_401", pattern: /Form\s+401\b/im },

  // --- Tier 2: Title / structural marker patterns (fallback) ---
  {
    form: "osl_appendix",
    pattern: /Appendix:?\s*General\s+Information/im,
  },
  {
    form: "osl",
    pattern: /(?:Ontario\s+)?Standard\s+(?:Form\s+of\s+)?Lease/im,
  },
  { form: "osl", pattern: /Residential\s+Tenancy\s+Agreement/im },
  { form: "osl", pattern: /2229E/ },
  { form: "osl", pattern: /www\.ontario\.ca\/standardlease/im },
];

/** Page joiner inserted by pdf-parse between pages (default format). */
const PAGE_JOINER_PATTERN = /\n-- \d+ of \d+ --\n/;

/**
 * Classify a single page of text into a form type.
 * Returns the first matching form, or "unknown" if nothing matches.
 */
export function classifyPage(pageText: string): FormType {
  for (const { form, pattern } of PAGE_FORM_PATTERNS) {
    if (pattern.test(pageText)) return form;
  }
  return "unknown";
}

/**
 * Split full PDF text into individual pages using the pdf-parse page joiner.
 * Returns an array of { text, startIdx, endIdx } for each page.
 */
export function splitPages(
  text: string,
): { text: string; startIdx: number; endIdx: number }[] {
  const pages: { text: string; startIdx: number; endIdx: number }[] = [];
  const joinerRegex = new RegExp(PAGE_JOINER_PATTERN.source, "g");
  let lastEnd = 0;

  for (const m of text.matchAll(joinerRegex)) {
    if (m.index !== undefined) {
      pages.push({ text: text.slice(lastEnd, m.index), startIdx: lastEnd, endIdx: m.index });
      lastEnd = m.index + m[0].length;
    }
  }
  // Last page (or the only page if no joiner found)
  pages.push({ text: text.slice(lastEnd), startIdx: lastEnd, endIdx: text.length });

  return pages;
}

/**
 * Segment document text into form regions by classifying each page.
 *
 * Per-page detection: each PDF page has its form identifier (e.g., "Form 400"
 * in the header/footer), so we split by the pdf-parse page joiner, classify
 * each page, then merge consecutive pages of the same form type into regions.
 *
 * Falls back to treating the entire text as a single "unknown" region when
 * no page joiners are present (e.g., single-page documents or plain text).
 */
export function detectFormBoundaries(text: string): FormRegion[] {
  const pages = splitPages(text);

  // Classify each page
  const classified = pages.map((p) => ({
    form: classifyPage(p.text),
    startIdx: p.startIdx,
    endIdx: p.endIdx,
  }));

  // Merge consecutive pages of the same form type into regions
  const regions: FormRegion[] = [];
  for (const page of classified) {
    const prev = regions[regions.length - 1];
    if (prev && prev.form === page.form) {
      // Extend the previous region to include this page
      prev.endIdx = page.endIdx;
    } else {
      regions.push({ form: page.form, startIdx: page.startIdx, endIdx: page.endIdx });
    }
  }

  return regions;
}

// ---------------------------------------------------------------------------
// Phase 2: Region-Based Extraction
// ---------------------------------------------------------------------------

/**
 * Route each detected form region to the appropriate extractors.
 * Irrelevant document types (Form 410, 324, 105, OSL Appendix) are skipped.
 */
function extractFromRegions(
  text: string,
  regions: FormRegion[],
): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];

  for (const region of regions) {
    // Skip irrelevant document types entirely
    if (IRRELEVANT_FORMS.has(region.form)) continue;

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
        // OSL Section 15 is never extracted — it is either the standard RTA
        // template explanation or a checkbox referencing separate attachments.
        // Real additional terms live in Schedule A/B/C or other attached forms.
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
// Text Cleaning — strip OREA page decoration & form-field placeholders
// ---------------------------------------------------------------------------

/**
 * Remove OREA boilerplate that appears on every page of OREA forms:
 * - Copyright / trademark block
 * - Form label headers ("Agreement to Lease - Residential", "Form 400", etc.)
 * - INITIALS OF TENANT(S) / LANDLORD(S) lines
 * - "This form must be initialled..." / "This Schedule is attached to..."
 * - Dot-filled placeholder lines (empty form fields)
 * - Page headers like "Form 400 Revised Feb 2024 Page 1 of 5"
 */
function cleanOreaBoilerplate(text: string): string {
  return (
    text
      // pdf-parse page joiners
      .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, "")
      // OREA copyright / trademark block (multi-line)
      .replace(
        /The trademarks REALTOR®[\s\S]*?OREA bears no liability for your use of this form\./g,
        "",
      )
      // Shorter copyright variant
      .replace(
        /© \d{4}, Ontario Real Estate Association[\s\S]*?OREA bears no liability[^\n]*/g,
        "",
      )
      // Page header: "Form 400 Revised Feb 2024 Page 1 of 5" or "Form 401 Revised 2023 Page 1 of 3"
      .replace(
        /Form\s+\d+\s+Revised(?:\s+\w+)?\s+\d{4}\s+Page\s+\d+\s+of\s+\d+/g,
        "",
      )
      // Form label: "Agreement to Lease - Residential" or similar on its own line
      .replace(/^\s*Agreement\s+to\s+Lease\s*[-–—]\s*Residential\s*$/gm, "")
      // "Form 400 for use in the Province of Ontario" on its own line
      .replace(/^\s*Form\s+\d+\s*\n\s*for use in the Province of Ontario\s*$/gm, "")
      // INITIALS lines
      .replace(/^\s*INITIALS\s+OF[^\n]*$/gm, "")
      // "This form must be initialled by all parties..."
      .replace(/^\s*This form must be initialled[^\n]*/gm, "")
      // "This Schedule is attached to and forms part of..."
      .replace(/^\s*This Schedule is attached to and forms part of[^\n]*/gm, "")
      // Dot-filled lines (10+ dots, possibly with some text around them)
      .replace(/^[.\s]{10,}$/gm, "")
      // Lines that are mostly dots with minimal text (e.g., "................... (Witness)")
      .replace(/^.*\.{10,}.*$/gm, "")
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Section Extractors
// ---------------------------------------------------------------------------

/**
 * Detect whether a region belongs to the Ontario Standard RTA form
 * by looking for structural markers unique to the government template:
 *   1. "2229E" — form number printed in page footers
 *   2. "Residential Tenancy Agreement" + "(Standard Form of Lease)" — title header
 *   3. "www.ontario.ca/standardlease" — URL on the last page
 *
 * If the region IS a standard RTA form, its Section 15 is just the template
 * explanation (checkboxes, examples of void terms) — no real custom clauses.
 * Actual additional terms, if any, live in separate attachments outside the form.
 */
const RTA_FORM_MARKERS = [
  /2229E/,
  /Residential\s+Tenancy\s+Agreement[\s\S]{0,80}Standard\s+Form\s+of\s+Lease/i,
  /www\.ontario\.ca\/standardlease/i,
];

export function isStandardRtaForm(text: string): boolean {
  let matchCount = 0;
  for (const marker of RTA_FORM_MARKERS) {
    if (marker.test(text)) matchCount++;
  }
  // 2 out of 3 markers is sufficient to identify the standard form
  return matchCount >= 2;
}

/**
 * Extract clauses from OSL Section 15 "Additional Terms".
 * Detects and skips the standard OSL template explanation that contains
 * no actual custom clauses (the real terms are in separate attachments).
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
    // Any numbered section ≥ 9 (handles PDFs where sections 9/10 are missing)
    /(?:^|\n)\s*(?:9|[1-9]\d+)\.\s/m,
    /(?:^|\n)\s*(?:Signature|SIGNATURE)/im,
    /(?:^|\n)\s*(?:Landlord|LANDLORD)\s*(?:'s\s+)?(?:Signature|Sign)/im,
    /(?:^|\n)\s*(?:Tenant|TENANT)\s*(?:'s\s+)?(?:Signature|Sign)/im,
    /(?:^|\n)\s*(?:Schedule|SCHEDULE)\s+[A-C]\b/im,
    /(?:^|\n)\s*SIGNED,?\s+SEALED/im,
  ];

  let endIdx = text.length;
  const remaining = text.slice(startIdx);
  for (const pattern of endPatterns) {
    const match = remaining.match(pattern);
    if (match?.index !== undefined) {
      endIdx = Math.min(endIdx, startIdx + match.index);
    }
  }

  let sectionText = cleanOreaBoilerplate(text.slice(startIdx, endIdx).trim());
  // Strip leading colon left over from "ADDITIONAL TERMS:" header
  sectionText = sectionText.replace(/^:\s*/, "").trim();
  if (!sectionText) return [];

  // Skip if text starts mid-sentence (lowercase / no subject) — this is
  // a boilerplate fragment from the form, not a real additional term.
  if (/^[a-z]/.test(sectionText)) return [];

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
  const cleanedText = cleanOreaBoilerplate(text);

  const scheduleConfigs: { pattern: RegExp; letter: "a" | "b" | "c" }[] = [
    {
      // Supports both "Schedule A" and Form 401-style "Schedule ______" + "A"
      pattern:
        /(?:^|\n)\s*(?:Schedule|SCHEDULE)(?:\s+A\b|\s+[_\-.]{2,}(?:\n\s*)+A\b)/gim,
      letter: "a",
    },
    {
      pattern:
        /(?:^|\n)\s*(?:Schedule|SCHEDULE)(?:\s+B\b|\s+[_\-.]{2,}(?:\n\s*)+B\b)/gim,
      letter: "b",
    },
    {
      pattern:
        /(?:^|\n)\s*(?:Schedule|SCHEDULE)(?:\s+C\b|\s+[_\-.]{2,}(?:\n\s*)+C\b)/gim,
      letter: "c",
    },
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
    for (const match of cleanedText.matchAll(pattern)) {
      if (match.index !== undefined) {
        positions.push({
          start: match.index,
          headerEnd: match.index + match[0].length,
          end: cleanedText.length,
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
      i < positions.length - 1 ? positions[i + 1].start : cleanedText.length;

    const scheduleText = cleanedText.slice(contentStart, contentEnd).trim();
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

  // Strategy 3: Sentence-boundary splitting for OREA-style continuous text.
  // In OREA Schedule A PDFs, clauses are separated by single newlines only.
  // Detect boundaries where a sentence-ending period is followed (on the
  // same or next line) by a new sentence starting with a capital letter
  // at the beginning of a line (not a continuation of a wrapped line).
  //
  // Heuristic: a "new clause start" is a line that begins with a capital
  // letter AND the previous line ended with a period (sentence end).
  const lines = text.split("\n");
  if (lines.length >= 2) {
    const clauseChunks: string[] = [];
    let current: string[] = [lines[0]];

    for (let i = 1; i < lines.length; i++) {
      const prevLine = lines[i - 1].trimEnd();
      const currLine = lines[i];
      // New clause starts when:
      //   - previous line ends with "." (sentence end)
      //   - current line starts with a capital letter (new sentence, no indent)
      //   - current line is not just a short fragment (> 30 chars)
      const prevEndsSentence = /\.\s*$/.test(prevLine);
      const currStartsNew = /^[A-Z]/.test(currLine);
      const currLongEnough = currLine.trim().length > 30;

      if (prevEndsSentence && currStartsNew && currLongEnough) {
        const chunk = current.join("\n").trim();
        if (chunk.length > 15) clauseChunks.push(chunk);
        current = [currLine];
      } else {
        current.push(currLine);
      }
    }
    // Push last chunk
    const lastChunk = current.join("\n").trim();
    if (lastChunk.length > 15) clauseChunks.push(lastChunk);

    if (clauseChunks.length > 1) {
      return clauseChunks.map((p) => ({ text: p, source }));
    }
  }

  // Strategy 4: Treat the whole block as one clause
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
