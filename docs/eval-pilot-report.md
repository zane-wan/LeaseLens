# LeaseLens Pilot Benchmark Report (Scope A)

**Date:** 2026-07-02 · **Runs:** `pilot_001` (baseline), `pilot_002` (retrieval experiment, reverted), `pilot_003` (final production configuration), `pilot_004` (model tier study), `pilot_005` (calibration experiment, reverted) · **Pipeline:** router (gpt-4o-mini) → hybrid RAG retrieval (pgvector plus full text search, RRF, top 5) → structured judgment (gpt-4o-mini) with `compliance_normalization_v1` post processing.

This report contains aggregate metrics only. No lease text, document identifiers, or personal information appear here; per sample records live in `private_eval/` and are never published.

## Dataset

39 clauses extracted from real Ontario lease PDFs (private source), spanning 11 legal scenarios (repair duty waivers, prohibited charges, rent deposits, postdated cheques, entry rights, pet bans, termination documents required at signing, assignment and sublet consent, lock changes, guest damage). Every row was reviewed by a human: the gold compliance label, the expected product label, and the gold statute citations were adjudicated against the text of the Residential Tenancies Act, 2006. Spans with parser segmentation defects (truncated or merged clauses, struck through text, page footer contamination) were excluded during review rather than patched.

## The three questions

| Question | Metric | Baseline (pilot_001) | Final (pilot_003) |
|---|---|---|---|
| Does LeaseLens find the right RTA authority? | Retrieval section hit rate (gold section in top 5) | 69.2% | 69.2% |
| Does it cite the correct legal section? | Citation hit rate (gold section among cited references) | 59.0% | **66.7%** |
| Does it give a reasonable legal verdict? | Verdict accuracy against human gold | 46.2% | **59.0%** |

Supporting numbers (pilot_003): router category accuracy 66.7%, mean latency 4.1 s (p95 6.8 s), cost per full run about $0.018, zero failed samples in every run.

Because the product decision is binary in practice (flag the clause or let it pass), we also track flag metrics. Final configuration: problem clause recall 76.0% (up from 36.0% at baseline), flag precision 76.0% (from 69.2%), and zero cases of an illegal clause judged compliant (down from 5 at baseline).

## What changed between baseline and final

**Judgment rubric (kept).** The baseline confusion matrix showed a strong leniency bias: 11 of 16 needs_review golds and 5 of 9 non_compliant golds were predicted compliant. We codified a statutory decision rubric into the analysis system prompt: clauses that impose, waive, or transfer duties the Act reserves are non_compliant (RTA ss. 3 and 4 make contracted out provisions void regardless of consent); clauses whose legality turns on facts outside the clause are needs_review; clauses that restate the Act (tenant duties under ss. 33 and 34) are compliant. The advance rent guidance was also corrected to match s. 106(2). Effect: non_compliant recall rose from 3 of 9 to 8 of 9, overall verdict accuracy 46.2% → 59.0%, citation accuracy 59.0% → 66.7%. The rubric was derived from the structure of the statute, not from inspecting failed samples.

**Soft category retrieval (tested, reverted).** Hypothesis: the hard `WHERE category =` filter blinds retrieval when the router misclassifies (router accuracy is 66.7%). We tested fusing corpus wide and category scoped searches, turning the category into a soft boost. Result: net zero. Two samples gained, two lost; rows with a misclassified router were rescued, but rows with a correct router lost the noise suppression benefit of the hard filter. The change was reverted. Deeper analysis showed the remaining retrieval misses are a semantic gap problem: for example, utility transfer clauses embed far from the fee enumeration language of s. 134, so the top ranks fill with semantically closer utility apportionment sections (ss. 137 and 138).

## Model tier tradeoff (measured, production unchanged)

`pilot_004` re-ran the final configuration with gpt-4o as the analysis model (router and retrieval unchanged):

| Metric | gpt-4o-mini (pilot_003) | gpt-4o (pilot_004) |
|---|---|---|
| Verdict accuracy | 59.0% | **69.2%** |
| Flag precision | 76.0% | **82.6%** |
| Problem clause recall | 76.0% | 76.0% |
| Illegal clauses judged compliant | 0 | 0 |
| Citation hit rate | 66.7% | 61.5% (within noise) |
| Mean latency | 4.1 s | 3.9 s |
| Cost per full run | $0.018 | $0.275 |

The larger model buys about 10 points of verdict accuracy and 7 points of precision at roughly 15 times the inference cost, with no recall gain. Production stays on gpt-4o-mini for cost reasons; the tradeoff is documented here for a future capacity decision.

## Verdict calibration experiment (tested, reverted)

`pilot_005` added a symmetric instruction to the rubric ("do not invent violations") aimed at the 5 false non_compliant verdicts. On gpt-4o-mini it backfired: precision fell to 73.9%, recall fell to 68.0%, and one illegal clause slipped through as compliant again. The softening language re-opened the leniency the rubric had closed, so the change was reverted. Calibrating the aggressive edge appears to require the stronger model (gpt-4o reached 82.6% precision with no prompt change) rather than prompt softening.

## Remaining known gaps

- Verdict calibration now leans slightly aggressive, the mirror image of the leniency fix: 5 of 14 compliant golds are predicted non_compliant. Prompt softening made this worse (see the calibration experiment); the measured paths forward are the model tier upgrade or richer few shot guidance.
- Retrieval for fee and charge clauses (the s. 134 family) needs a semantic bridge (section content enrichment or query expansion), not filter tuning.
- Entry notice scenarios score 0 of 3 on verdict: gold treats informal notice showing clauses as needs_review, while the model splits between compliant and non_compliant.

## Limitations

- Scope A only (legal correctness benchmark); no security or adversarial evaluation yet.
- Pilot scale: n = 39; per scenario counts are small (1 to 14), so scenario level rates are indicative only.
- A single human reviewer produced the gold labels (adjudicated against statute text; no agreement between annotators measured).
- Single run per configuration; no variance across repeated runs measured. Analysis temperature is 0.2, so figures may move by roughly one sample between runs.
- Private real PDF source; the dataset cannot be published, only aggregate results.
