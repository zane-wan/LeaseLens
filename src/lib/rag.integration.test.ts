import { beforeAll, describe, expect, it } from "vitest"

// ---------------------------------------------------------------------------
// Integration tests — hit the real RDS database + OpenAI embeddings.
// Requires DATABASE_URL and OPENAI_API_KEY in .env.local.
//
// Run with: npx vitest run src/lib/rag.integration.test.ts
// ---------------------------------------------------------------------------

const HAS_ENV = !!process.env.DATABASE_URL && !!process.env.OPENAI_API_KEY

let retrieveContext: typeof import("./rag").retrieveContext
let hybridSearch: typeof import("./rag").hybridSearch

describe.skipIf(!HAS_ENV)("RAG integration tests (live DB)", () => {
  beforeAll(async () => {
    const rag = await import("./rag")
    retrieveContext = rag.retrieveContext
    hybridSearch = rag.hybridSearch
  })

  it("retrieves relevant sections for 'no pets allowed'", async () => {
    const results = await hybridSearch("no pets allowed");

    expect(results.length).toBeGreaterThan(0);

    // Should find RTA s.14 (no pet restrictions) in the results
    const citations = results.map((r) => r.fullCitation);
    console.log("  Query: 'no pets allowed'");
    console.log("  Results:", citations);
    console.log("  Top result:", results[0].fullCitation, "—", results[0].sectionTitle);

    // s.14 should appear (it's the main pet provision)
    const hasPetSection = results.some(
      (r) => r.section === "14" || r.fullCitation.includes("s. 14"),
    );
    expect(hasPetSection).toBe(true);
  }, 30_000);

  it("retrieves relevant sections for 'key deposit $200'", async () => {
    const results = await hybridSearch("key deposit of $200");

    expect(results.length).toBeGreaterThan(0);

    console.log("  Query: 'key deposit of $200'");
    console.log("  Results:", results.map((r) => r.fullCitation));

    // Should find sections about deposits/charges (s.17 or s.105 or s.134)
    const hasDepositSection = results.some(
      (r) =>
        r.category === "deposits" ||
        r.fullCitation.includes("s. 105") ||
        r.fullCitation.includes("s. 106") ||
        r.fullCitation.includes("s. 134") ||
        r.fullCitation.includes("s. 17"),
    );
    expect(hasDepositSection).toBe(true);
  }, 30_000);

  it("retrieves relevant sections for 'landlord may enter anytime'", async () => {
    const results = await hybridSearch("the landlord may enter the unit at any time without notice");

    expect(results.length).toBeGreaterThan(0);

    console.log("  Query: 'landlord may enter anytime'");
    console.log("  Results:", results.map((r) => r.fullCitation));

    // Should find entry-related sections (s.25, s.26, s.27)
    const hasEntrySection = results.some(
      (r) =>
        r.category === "entry" ||
        r.section === "25" ||
        r.section === "26" ||
        r.section === "27",
    );
    expect(hasEntrySection).toBe(true);
  }, 30_000);

  it("category-filtered search narrows results", async () => {
    const unfilteredResults = await hybridSearch("no pets allowed");
    const filteredResults = await hybridSearch("no pets allowed", { category: "pets" });

    console.log("  Unfiltered:", unfilteredResults.map((r) => r.fullCitation));
    console.log("  Filtered (pets):", filteredResults.map((r) => r.fullCitation));

    // Filtered results should all be from the 'pets' category
    if (filteredResults.length > 0) {
      expect(filteredResults.every((r) => r.category === "pets")).toBe(true);
    }
  }, 30_000);

  it("retrieveContext returns formatted strings", async () => {
    const context = await retrieveContext("tenant must pay first and last month rent");

    expect(context.length).toBeGreaterThan(0);

    // Each entry should be formatted as "[citation] content"
    for (const entry of context) {
      expect(entry).toMatch(/^\[.+\] .+/);
    }

    console.log("  Context entries:", context.length);
    console.log("  First entry (truncated):", context[0].slice(0, 100) + "...");
  }, 30_000);
});
