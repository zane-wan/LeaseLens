/**
 * RTA Ingestion Script
 *
 * Parses the Ontario Residential Tenancies Act from a .txt file (converted from .doc),
 * chunks by section, generates contextual descriptions + embeddings, and stores in pgvector.
 *
 * Usage: npx tsx scripts/ingest-rta.ts
 */

import fs from "fs"
import path from "path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import OpenAI from "openai"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RtaSection {
  part: string
  partTitle: string
  section: string
  subsection: string | null
  sectionTitle: string
  fullCitation: string
  content: string
}

// ---------------------------------------------------------------------------
// 1. Parse RTA text into sections
// ---------------------------------------------------------------------------

function parseRtaSections(rawText: string): RtaSection[] {
  // Strip HYPERLINK artifacts from the .doc conversion
  let text = rawText.replace(/HYPERLINK\s+"[^"]*"(?:\s+\\[lo]\s+"[^"]*")?/g, "")
  text = text.replace(/HYPERLINK[^\n]*/g, "")
  // Normalize Unicode line/paragraph separators (U+2028, U+2029) to spaces
  text = text.replace(/[\u2028\u2029]/g, " ")
  // Collapse multiple spaces
  text = text.replace(/ {2,}/g, " ")

  // Find the body — skip Table of Contents
  // Look for "PART I INTRODUCTION" followed by actual section text
  const tocEnd = text.indexOf("PART I INTRODUCTION\nPurposes of Act\n")
  if (tocEnd < 0) {
    throw new Error("Cannot find start of RTA body text")
  }
  const body = text.substring(tocEnd)

  // Split into parts first
  const partPattern = /^(PART [IVX]+(?:\.[0-9])?)\s+(.+?)$/gm
  const partPositions: Array<{ index: number; part: string; partTitle: string }> = []

  let partMatch
  while ((partMatch = partPattern.exec(body)) !== null) {
    partPositions.push({
      index: partMatch.index,
      part: partMatch[1].replace("PART ", ""),
      partTitle: partMatch[2].trim(),
    })
  }

  // Parse sections using the pattern: section title on one line, then "N (1)" or "N " starting body
  // Pattern: a line with section title, followed by section number and body
  const sectionPattern = /^(.+)\n(\d+(?:\.\d+)?)\s+(\(1\)\s+)?(.+?)(?=\n.+\n\d+(?:\.\d+)?\s+(?:\(1\)\s+)?|$)/gms

  // Actually, let's use a simpler approach: split by section number pattern
  const sections: RtaSection[] = []

  // Match: section number at start of line, optionally followed by (1)
  // e.g. "134 (1)  Unless otherwise prescribed..."
  // or   "14 No landlord shall..."
  // Allow titles starting with quotes, special chars, etc.
  const sectionSplitPattern = /\n(?=[^\n]{3,80}\n\d+(?:\.\d+)?\s)/g
  const sectionBlocks = body.split(sectionSplitPattern)

  let currentPart = ""
  let currentPartTitle = ""

  for (const block of sectionBlocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    // Check for PART header
    const partHeaderMatch = trimmed.match(/^PART ([IVX]+(?:\.[0-9])?)\s+(.+?)$/m)
    if (partHeaderMatch) {
      currentPart = partHeaderMatch[1]
      currentPartTitle = partHeaderMatch[2].trim()
    }

    // Check for sub-headers like "SECURITY OF TENURE", "ILLEGAL ADDITIONAL CHARGES"
    // These are ALL CAPS lines that aren't PART headers

    // Extract section number and content
    // Pattern: title line(s) then number then content
    const lines = trimmed.split("\n")
    let sectionTitle = ""
    let sectionNum = ""
    let sectionBody = ""
    let foundSection = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Check if this line is a section number start
      const numMatch = line.match(/^(\d+(?:\.\d+)?)\s+(.*)/)
      if (numMatch && !foundSection) {
        sectionNum = numMatch[1]
        sectionBody = numMatch[2]
        foundSection = true
        // Collect remaining lines as body
        sectionBody += "\n" + lines.slice(i + 1).join("\n")
        break
      } else if (!foundSection) {
        // Lines before the section number are the title
        // Skip PART headers, sub-headers (ALL CAPS), and "CONTENTS"
        if (!line.startsWith("PART ") && line !== "CONTENTS" && !/^[A-Z\s,–—-]{10,}$/.test(line)) {
          if (sectionTitle) sectionTitle += " "
          sectionTitle += line
        }
      }
    }

    if (!foundSection || !sectionNum) continue

    // Clean up title and body
    sectionTitle = sectionTitle
      .replace(/\s+/g, " ")
      .trim()
    sectionBody = sectionBody
      .replace(/\s+/g, " ")
      .trim()

    // Remove "Section Amendments with date in force" footer text
    const amendIdx = sectionBody.indexOf("Section Amendments with date in force")
    if (amendIdx > 0) {
      sectionBody = sectionBody.substring(0, amendIdx).trim()
    }

    // Remove trailing amendment references like "2006, c. 17, s. 134 (1)."
    // but keep the legal content

    if (!sectionTitle || !sectionBody) continue

    // Check if body is too long (>768 tokens ≈ 3000 chars) — split by subsection
    if (sectionBody.length > 3000) {
      // Split by subsection pattern: (1), (2), (3), etc.
      const subsections = splitBySubsection(sectionBody, sectionNum)
      if (subsections.length > 1) {
        for (const sub of subsections) {
          sections.push({
            part: currentPart,
            partTitle: currentPartTitle,
            section: sectionNum,
            subsection: sub.num,
            sectionTitle,
            fullCitation: `RTA s. ${sectionNum}(${sub.num})`,
            content: sub.text,
          })
        }
        continue
      }
    }

    sections.push({
      part: currentPart,
      partTitle: currentPartTitle,
      section: sectionNum,
      subsection: null,
      sectionTitle,
      fullCitation: `RTA s. ${sectionNum}`,
      content: sectionBody,
    })
  }

  return sections
}

function splitBySubsection(
  text: string,
  sectionNum: string,
): Array<{ num: string; text: string }> {
  // Split on subsection markers: (1), (2), etc.
  const parts = text.split(/(?=\(\d+\)\s)/)
  const results: Array<{ num: string; text: string }> = []

  for (const part of parts) {
    const match = part.match(/^\((\d+)\)\s+(.*)/)
    if (match) {
      results.push({ num: match[1], text: part.trim() })
    } else if (results.length > 0) {
      // Append to previous subsection
      results[results.length - 1].text += " " + part.trim()
    } else {
      // Text before first subsection
      results.push({ num: "1", text: part.trim() })
    }
  }

  // Merge very short subsections (< 50 chars) with the next one
  const merged: Array<{ num: string; text: string }> = []
  for (let i = 0; i < results.length; i++) {
    if (results[i].text.length < 100 && i + 1 < results.length) {
      results[i + 1].text = results[i].text + " " + results[i + 1].text
    } else {
      merged.push(results[i])
    }
  }

  return merged
}

// ---------------------------------------------------------------------------
// 2. Generate contextual descriptions
// ---------------------------------------------------------------------------

async function generateContext(section: RtaSection): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 150,
    messages: [
      {
        role: "system",
        content:
          "You write brief context descriptions for legal statute sections. Be specific about the legal topic. Output only the context description, nothing else.",
      },
      {
        role: "user",
        content: `Write a 1-2 sentence context description for this section of the Ontario Residential Tenancies Act, 2006.\n\nSection: ${section.fullCitation} — ${section.sectionTitle}\nPart: ${section.part} — ${section.partTitle}\n\nText:\n${section.content.substring(0, 500)}`,
      },
    ],
  })

  return response.choices[0].message.content?.trim() ?? ""
}

// ---------------------------------------------------------------------------
// 3. Classify section category
// ---------------------------------------------------------------------------

async function classifyCategory(section: RtaSection): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 20,
    messages: [
      {
        role: "system",
        content:
          "Classify this legal section into exactly ONE category. Respond with only the category name, lowercase.\n\nCategories: pets, maintenance, deposits, entry, termination, rent, guests, parking, utilities, subletting, discrimination, privacy, other",
      },
      {
        role: "user",
        content: `${section.fullCitation} — ${section.sectionTitle}\n\n${section.content.substring(0, 300)}`,
      },
    ],
  })

  const category = response.choices[0].message.content?.trim().toLowerCase() ?? "other"
  const validCategories = [
    "pets", "maintenance", "deposits", "entry", "termination",
    "rent", "guests", "parking", "utilities", "subletting",
    "discrimination", "privacy", "other",
  ]
  return validCategories.includes(category) ? category : "other"
}

// ---------------------------------------------------------------------------
// 4. Generate embeddings
// ---------------------------------------------------------------------------

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  })
  return response.data[0].embedding
}

// ---------------------------------------------------------------------------
// 5. Store in database
// ---------------------------------------------------------------------------

async function storeChunk(
  section: RtaSection,
  context: string,
  category: string,
  embedding: number[],
): Promise<void> {
  const contentWithContext = `[Context: ${context}]\n\n${section.content}`
  const vectorStr = `[${embedding.join(",")}]`

  await prisma.$executeRawUnsafe(
    `INSERT INTO "RtaChunk" (
      id, source, part, "partTitle", section, subsection, "sectionTitle",
      "fullCitation", category, content, "contentWithContext", "searchText",
      embedding, "createdAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      to_tsvector('english', $9), $11::vector, NOW()
    )`,
    "RTA",
    section.part,
    section.partTitle,
    section.section,
    section.subsection,
    section.sectionTitle,
    section.fullCitation,
    category,
    section.content,
    contentWithContext,
    vectorStr,
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== RTA Ingestion Script ===\n")

  // Read the text file
  const txtPath = path.join(process.cwd(), "data", "rta-full-text.txt")
  if (!fs.existsSync(txtPath)) {
    console.error("Error: data/rta-full-text.txt not found. Run: textutil -convert txt data/rta-full-text.doc")
    process.exit(1)
  }

  const rawText = fs.readFileSync(txtPath, "utf-8")
  console.log(`Read ${rawText.length} chars from rta-full-text.txt`)

  // Parse sections
  console.log("Parsing sections...")
  const sections = parseRtaSections(rawText)
  console.log(`Found ${sections.length} sections\n`)

  if (sections.length === 0) {
    console.error("No sections parsed. Check the text file format.")
    process.exit(1)
  }

  // Show sample
  console.log("Sample sections:")
  for (const s of sections.slice(0, 3)) {
    console.log(`  ${s.fullCitation} — ${s.sectionTitle} (${s.content.length} chars)`)
  }
  console.log("  ...")
  console.log()

  // Clear existing data
  const existing = await prisma.$executeRawUnsafe(`DELETE FROM "RtaChunk" WHERE source = 'RTA'`)
  console.log(`Cleared ${existing} existing RTA chunks\n`)

  // Process each section
  let processed = 0
  const batchSize = 5

  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (section) => {
        try {
          // Generate context, category, and embedding in parallel
          const [context, category] = await Promise.all([
            generateContext(section),
            classifyCategory(section),
          ])

          const contentWithContext = `[Context: ${context}]\n\n${section.content}`
          const embedding = await embedText(contentWithContext)

          await storeChunk(section, context, category, embedding)
          processed++

          console.log(
            `  [${processed}/${sections.length}] ${section.fullCitation} — ${section.sectionTitle} → ${category}`,
          )
        } catch (err) {
          console.error(`  ERROR on ${section.fullCitation}:`, err)
        }
      }),
    )
  }

  console.log(`\nDone! Ingested ${processed}/${sections.length} sections.`)

  // Create indexes
  console.log("\nCreating indexes...")
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS rta_chunks_embedding_idx ON "RtaChunk" USING hnsw (embedding vector_cosine_ops)`,
    )
    console.log("  Created HNSW index on embedding")
  } catch {
    console.log("  HNSW index already exists or failed (non-critical)")
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS rta_chunks_search_idx ON "RtaChunk" USING gin ("searchText")`,
    )
    console.log("  Created GIN index on searchText")
  } catch {
    console.log("  GIN index already exists or failed (non-critical)")
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
