import { promises as fs } from "fs"
import path from "path"
import { execSync } from "child_process"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// Pilot benchmark runner: replays the production per-clause pipeline
// (categorize -> hybrid retrieve -> analyze) over the pilot dataset and
// scores retrieval, citations, and labels against human gold.
// Usage: npx tsx scripts/eval-pilot-run.ts [--limit N] [--run pilot_001]

const DATASET = "private_eval/datasets/lease_eval_pilot.jsonl"
const RUNS_DIR = "private_eval/runs"
const TOP_K = 5

// Pricing per 1M tokens (2026-07 OpenAI list prices), keyed by model id
const MODEL_PRICES_PER_M: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
}
const ROUTER_MODEL_ID = "gpt-4o-mini"
const EMBED_PER_M = 0.02

interface PilotRow {
  sample_id: string
  scenario_id: string
  gold_router_category: string
  normalized_clause_text: string
  gold_section_ids: string[]
  legal_gold_label: string
  product_expected_label: string
}

interface SampleRecord {
  sample_id: string
  scenario_id: string
  clause_text: string
  gold_router_category: string
  predicted_category: string | null
  router_correct: boolean | null
  gold_section_ids: string[]
  retrieved_section_keys: string[]
  retrieval_hit: boolean | null
  citations_raw: string[]
  cited_section_keys: string[]
  citation_hit: boolean | null
  gold_legal_label: string
  product_expected_label: string
  predicted_label: string | null
  label_match_product: boolean | null
  label_match_legal: boolean | null
  latency_ms: { router: number; retrieval: number; analysis: number; total: number }
  tokens: { router_prompt: number; router_completion: number; analysis_prompt: number; analysis_completion: number }
  error: string | null
}

function parseArgs() {
  const args = process.argv.slice(2)
  let limit = Infinity
  let runName: string | null = null
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--limit") limit = Number(args[i + 1])
    if (args[i] === "--run") runName = args[i + 1]
  }
  return { limit, runName }
}

async function nextRunName() {
  await fs.mkdir(RUNS_DIR, { recursive: true })
  const existing = await fs.readdir(RUNS_DIR)
  for (let i = 1; i < 1000; i += 1) {
    const name = `pilot_${String(i).padStart(3, "0")}`
    if (!existing.includes(name)) return name
  }
  throw new Error("no free run name")
}

function keyMatchesGold(goldKey: string, candidateKey: string) {
  const [goldSource, goldSection, goldSub] = goldKey.split("|")
  const [candSource, candSection, candSub = ""] = candidateKey.split("|")
  return goldSource === candSource && goldSection === candSection && (goldSub === "" || goldSub === candSub)
}

function anyGoldMatch(goldKeys: string[], candidateKeys: string[]) {
  return goldKeys.some((gold) => candidateKeys.some((candidate) => keyMatchesGold(gold, candidate)))
}

function parseCitationKeys(citation: string): string[] {
  if (!/rta|residential tenancies/i.test(citation)) return []
  const keys: string[] = []
  const re = /ss?\.?\s*(\d+(?:\.\d+)?)\s*(?:\((\d+(?:\.\d+)?[a-z]?)\))?/gi
  let match
  while ((match = re.exec(citation)) !== null) {
    keys.push(`RTA|${match[1]}|${match[2] ?? ""}`)
  }
  return keys
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

function rate(numerator: number, denominator: number) {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4))
}

async function main() {
  const { limit, runName } = parseArgs()
  const { categorizeClauseWithUsage } = await import("@/lib/clause-extractor")
  const { hybridSearch } = await import("@/lib/rag")
  const { analyzeClauseWithUsage } = await import("@/lib/llm")
  const { prisma } = await import("@/lib/prisma")
  const { analysisModelConfig } = await import("@/config/llm")

  const analysisModelId = analysisModelConfig.model.modelId
  const analysisPrices = MODEL_PRICES_PER_M[analysisModelId]
  const routerPrices = MODEL_PRICES_PER_M[ROUTER_MODEL_ID]
  if (!analysisPrices) {
    throw new Error(`no pricing configured for analysis model ${analysisModelId}`)
  }

  const rows = (await fs.readFile(DATASET, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PilotRow)
    .slice(0, limit)

  const run = runName ?? (await nextRunName())
  const runDir = path.join(RUNS_DIR, run)
  await fs.mkdir(runDir, { recursive: true })

  console.log(`run ${run}: ${rows.length} samples from ${DATASET}`)

  const records: SampleRecord[] = []
  const errors: Array<{ sample_id: string; stage: string; error: string }> = []

  for (const [index, row] of rows.entries()) {
    const clause = row.normalized_clause_text
    const record: SampleRecord = {
      sample_id: row.sample_id,
      scenario_id: row.scenario_id,
      clause_text: clause,
      gold_router_category: row.gold_router_category,
      predicted_category: null,
      router_correct: null,
      gold_section_ids: row.gold_section_ids,
      retrieved_section_keys: [],
      retrieval_hit: null,
      citations_raw: [],
      cited_section_keys: [],
      citation_hit: null,
      gold_legal_label: row.legal_gold_label,
      product_expected_label: row.product_expected_label,
      predicted_label: null,
      label_match_product: null,
      label_match_legal: null,
      latency_ms: { router: 0, retrieval: 0, analysis: 0, total: 0 },
      tokens: { router_prompt: 0, router_completion: 0, analysis_prompt: 0, analysis_completion: 0 },
      error: null,
    }

    const t0 = Date.now()
    let stage = "router"
    try {
      const routerOut = await categorizeClauseWithUsage(clause)
      record.latency_ms.router = Date.now() - t0
      record.predicted_category = routerOut.category
      record.router_correct = routerOut.category === row.gold_router_category
      record.tokens.router_prompt = routerOut.usage.promptTokens ?? 0
      record.tokens.router_completion = routerOut.usage.completionTokens ?? 0

      stage = "retrieval"
      const t1 = Date.now()
      const hits = await hybridSearch(clause, { topK: TOP_K, category: routerOut.category })
      record.latency_ms.retrieval = Date.now() - t1
      const chunkRows = await prisma.rtaChunk.findMany({
        where: { id: { in: hits.map((hit) => hit.id) } },
        select: { id: true, source: true, section: true, subsection: true },
      })
      const keyById = new Map(chunkRows.map((chunk) => [chunk.id, `${chunk.source}|${chunk.section}|${chunk.subsection ?? ""}`]))
      record.retrieved_section_keys = hits.map((hit) => keyById.get(hit.id) ?? `unknown|${hit.section}|`)
      record.retrieval_hit = anyGoldMatch(row.gold_section_ids, record.retrieved_section_keys)

      stage = "analysis"
      const t2 = Date.now()
      const context = hits.map((hit) => `[${hit.fullCitation}] ${hit.content}`)
      const analysisOut = await analyzeClauseWithUsage(clause, context)
      record.latency_ms.analysis = Date.now() - t2
      record.predicted_label = analysisOut.result.status
      record.label_match_product = analysisOut.result.status === row.product_expected_label
      record.label_match_legal = analysisOut.result.status === row.legal_gold_label
      record.citations_raw = analysisOut.result.citations
      record.cited_section_keys = Array.from(new Set(analysisOut.result.citations.flatMap(parseCitationKeys)))
      record.citation_hit = anyGoldMatch(row.gold_section_ids, record.cited_section_keys)
      record.tokens.analysis_prompt = analysisOut.usage.promptTokens ?? 0
      record.tokens.analysis_completion = analysisOut.usage.completionTokens ?? 0
    } catch (error) {
      record.error = `${stage}: ${error instanceof Error ? error.message : String(error)}`
      errors.push({ sample_id: row.sample_id, stage, error: record.error })
    }
    record.latency_ms.total = Date.now() - t0
    records.push(record)

    console.log(
      `${String(index + 1).padStart(2)}/${rows.length} ${row.sample_id} ` +
        (record.error
          ? `ERROR ${record.error.slice(0, 60)}`
          : `label=${record.predicted_label}(gold ${row.product_expected_label}) retr=${record.retrieval_hit ? "hit" : "miss"} cite=${record.citation_hit ? "hit" : "miss"} ${record.latency_ms.total}ms`),
    )
  }

  const scored = records.filter((record) => record.error === null)
  const latencies = scored.map((record) => record.latency_ms.total).sort((a, b) => a - b)
  const analysisPrompt = scored.reduce((sum, record) => sum + record.tokens.analysis_prompt, 0)
  const analysisCompletion = scored.reduce((sum, record) => sum + record.tokens.analysis_completion, 0)
  const routerPrompt = scored.reduce((sum, record) => sum + record.tokens.router_prompt, 0)
  const routerCompletion = scored.reduce((sum, record) => sum + record.tokens.router_completion, 0)
  const embedTokensEstimate = Math.ceil(scored.reduce((sum, record) => sum + record.clause_text.length, 0) / 4)
  const costUsd =
    (analysisPrompt / 1e6) * analysisPrices.input +
    (analysisCompletion / 1e6) * analysisPrices.output +
    (routerPrompt / 1e6) * routerPrices.input +
    (routerCompletion / 1e6) * routerPrices.output +
    (embedTokensEstimate / 1e6) * EMBED_PER_M

  const isFlagged = (label: string | null) => label === "needs_review" || label === "non_compliant"
  const flagTruePositive = scored.filter((r) => isFlagged(r.product_expected_label) && isFlagged(r.predicted_label)).length
  const flagFalsePositive = scored.filter((r) => !isFlagged(r.product_expected_label) && isFlagged(r.predicted_label)).length
  const flagFalseNegative = scored.filter((r) => isFlagged(r.product_expected_label) && !isFlagged(r.predicted_label)).length
  const flagTrueNegative = scored.filter((r) => !isFlagged(r.product_expected_label) && !isFlagged(r.predicted_label)).length
  const dangerousMissCount = scored.filter((r) => r.product_expected_label === "non_compliant" && r.predicted_label === "compliant").length

  const confusion: Record<string, Record<string, number>> = {}
  for (const record of scored) {
    const gold = record.product_expected_label
    const pred = record.predicted_label ?? "none"
    confusion[gold] = confusion[gold] ?? {}
    confusion[gold][pred] = (confusion[gold][pred] ?? 0) + 1
  }

  const scenarioIds = Array.from(new Set(scored.map((record) => record.scenario_id))).sort()
  const perScenario = Object.fromEntries(
    scenarioIds.map((scenarioId) => {
      const subset = scored.filter((record) => record.scenario_id === scenarioId)
      return [scenarioId, {
        n: subset.length,
        label_accuracy_product: rate(subset.filter((r) => r.label_match_product).length, subset.length),
        retrieval_hit_rate: rate(subset.filter((r) => r.retrieval_hit).length, subset.length),
        citation_hit_rate: rate(subset.filter((r) => r.citation_hit).length, subset.length),
      }]
    }),
  )

  const summary = {
    run_id: run,
    generated_at_utc: new Date().toISOString(),
    dataset: { path: DATASET, rows: rows.length },
    samples_total: records.length,
    samples_scored: scored.length,
    samples_failed: errors.length,
    metrics: {
      retrieval_section_hit_rate: rate(scored.filter((r) => r.retrieval_hit).length, scored.length),
      citation_hit_rate: rate(scored.filter((r) => r.citation_hit).length, scored.length),
      label_accuracy_vs_product_expected: rate(scored.filter((r) => r.label_match_product).length, scored.length),
      label_accuracy_vs_legal_gold: rate(scored.filter((r) => r.label_match_legal).length, scored.length),
      router_category_accuracy: rate(scored.filter((r) => r.router_correct).length, scored.length),
      flag_precision: rate(flagTruePositive, flagTruePositive + flagFalsePositive),
      flag_recall: rate(flagTruePositive, flagTruePositive + flagFalseNegative),
      binary_flag_accuracy: rate(flagTruePositive + flagTrueNegative, scored.length),
      dangerous_miss_count: dangerousMissCount,
    },
    label_confusion_product_gold_vs_predicted: confusion,
    per_scenario: perScenario,
    latency_ms: {
      avg: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
    },
    tokens: {
      analysis_prompt: analysisPrompt,
      analysis_completion: analysisCompletion,
      router_prompt: routerPrompt,
      router_completion: routerCompletion,
      embedding_estimated: embedTokensEstimate,
    },
    estimated_cost_usd: Number(costUsd.toFixed(4)),
    privacy_note: "This summary contains no lease text and is safe to publish. sample_records.jsonl is private.",
  }

  let gitCommit = "unknown"
  try {
    gitCommit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
  } catch { /* not fatal */ }

  const manifest = {
    run_id: run,
    generated_at_utc: summary.generated_at_utc,
    dataset_path: DATASET,
    dataset_rows: rows.length,
    limit_applied: Number.isFinite(limit) ? limit : null,
    pipeline: {
      router_model: ROUTER_MODEL_ID,
      analysis_model: analysisModelId,
      embedding_model: "text-embedding-3-small",
      retrieval: `hybrid vector + keyword with RRF, category filtered, topK ${TOP_K}`,
      normalization: "compliance_normalization_v1 (production post processing kept)",
    },
    scoring: {
      retrieval_hit: "any gold section key matched by a retrieved chunk key (section level match when gold has no subsection)",
      citation_hit: "any gold section key matched by a key parsed from model citation strings",
      label_reference: "product_expected_label primary, legal_gold_label also reported",
    },
    pricing_per_million_tokens_usd: {
      analysis_model: analysisModelId,
      analysis_input: analysisPrices.input,
      analysis_output: analysisPrices.output,
      router_input: routerPrices.input,
      router_output: routerPrices.output,
      embedding: EMBED_PER_M,
    },
    git_commit: gitCommit,
    repeats: 1,
  }

  await fs.writeFile(path.join(runDir, "run_manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.writeFile(path.join(runDir, "sample_records.jsonl"), records.map((record) => JSON.stringify(record)).join("\n") + "\n")
  await fs.writeFile(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
  await fs.writeFile(path.join(runDir, "errors.jsonl"), errors.length ? errors.map((error) => JSON.stringify(error)).join("\n") + "\n" : "")

  console.log(`\nwrote ${runDir}/{run_manifest.json, sample_records.jsonl, summary.json, errors.jsonl}`)
  console.log(JSON.stringify(summary.metrics, null, 2))
  console.log(`latency avg ${summary.latency_ms.avg}ms p95 ${summary.latency_ms.p95}ms, est cost $${summary.estimated_cost_usd}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
