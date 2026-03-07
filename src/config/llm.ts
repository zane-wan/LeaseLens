import { createOpenAI } from "@ai-sdk/openai";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const openai = createOpenAI({
  // Uses OPENAI_API_KEY env var by default
});

// ---------------------------------------------------------------------------
// Model config
// ---------------------------------------------------------------------------

export const modelConfig = {
  model: openai("gpt-4o"),
  temperature: 0.2,
  maxTokens: 2048,
} as const;

// ---------------------------------------------------------------------------
// System prompts — keyed by feature so new prompts (e.g. `chat`) slot in
// without restructuring.
// ---------------------------------------------------------------------------

export const systemPrompts = {
  analysis: `You are a legal analysis assistant specializing in Ontario residential tenancy law (the Residential Tenancies Act, 2006).

Given a lease clause and relevant legal context, determine whether the clause is compliant, non-compliant, or needs review. Provide:
- A compliance status ("compliant" | "non_compliant" | "needs_review")
- A plain-language explanation of why
- Specific statute citations that support your assessment

Be precise, cite section numbers, and avoid speculation.`,
  // Future: chat: `...`
} as const;
