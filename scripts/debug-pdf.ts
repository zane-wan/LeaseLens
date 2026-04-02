/**
 * Debug script: extract PDF text and run form detection on it.
 * Usage: npx tsx scripts/debug-pdf.ts "files/church RTA.pdf"
 */
import fs from "fs";
import path from "path";

// Polyfills (must run before pdf-parse import)
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error stub
  globalThis.DOMMatrix = class DOMMatrix {
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    is2D = true; isIdentity = true;
  };
}
if (typeof globalThis.Path2D === "undefined") {
  // @ts-expect-error stub
  globalThis.Path2D = class Path2D {};
}
if (typeof globalThis.ImageData === "undefined") {
  // @ts-expect-error stub
  globalThis.ImageData = class ImageData {
    width = 0; height = 0;
    data = new Uint8ClampedArray(0);
    constructor(w = 0, h = 0) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
  };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/debug-pdf.ts <path-to-pdf>");
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  console.log(`\n=== Extracting: ${absPath} ===\n`);

  const { PDFParse } = await import("pdf-parse");
  const buffer = fs.readFileSync(absPath);
  const parser = new PDFParse({ data: buffer, verbosity: -1 });
  const result = await parser.getText() as { text: string };
  const text = result.text;

  // Show raw text with page boundaries highlighted
  console.log("--- RAW TEXT (first 3000 chars) ---");
  console.log(text.slice(0, 3000));
  console.log("\n--- END ---\n");

  // Check for page joiners
  const joinerPattern = /\n-- \d+ of \d+ --\n/g;
  const joiners = [...text.matchAll(joinerPattern)];
  console.log(`Page joiners found: ${joiners.length}`);
  joiners.forEach((m, i) => {
    console.log(`  Page break ${i + 1}: "${m[0].trim()}" at position ${m.index}`);
  });

  // Split pages and classify
  const { splitPages, classifyPage, detectFormBoundaries } = await import("../src/lib/clause-extractor");
  const pages = splitPages(text);
  console.log(`\nPages: ${pages.length}`);
  pages.forEach((p, i) => {
    const form = classifyPage(p.text);
    const preview = p.text.slice(0, 80).replace(/\n/g, "\\n");
    console.log(`  Page ${i + 1}: form=${form}  preview="${preview}..."`);
  });

  // Detect boundaries
  const regions = detectFormBoundaries(text);
  console.log(`\nRegions: ${regions.length}`);
  regions.forEach((r, i) => {
    const regionText = text.slice(r.startIdx, r.endIdx);
    console.log(`  Region ${i + 1}: form=${r.form}  chars=${regionText.length}  start=${r.startIdx}  end=${r.endIdx}`);
  });

  // Show specific page if requested
  const showPage = process.argv[3] ? parseInt(process.argv[3]) : null;
  if (showPage !== null) {
    const p = pages[showPage - 1];
    if (p) {
      console.log(`\n=== FULL PAGE ${showPage} TEXT ===`);
      console.log(p.text);
      console.log(`=== END PAGE ${showPage} ===`);
    }
  }

  // Run extraction if --extract flag
  if (process.argv.includes("--extract")) {
    const { extractClauses } = await import("../src/lib/clause-extractor");
    const clauses = await extractClauses(text);
    console.log(`\n=== EXTRACTED CLAUSES: ${clauses.length} ===`);
    clauses.forEach((c, i) => {
      const preview = c.text.slice(0, 120).replace(/\n/g, "\\n");
      console.log(`  ${i + 1}. [${c.source}] ${preview}...`);
    });
  }
}

main().catch(console.error);
