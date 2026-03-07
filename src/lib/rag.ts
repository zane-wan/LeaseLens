// ---------------------------------------------------------------------------
// RAG retrieval — returns relevant statute text snippets for a given query.
// SDK-agnostic; reused by both the analysis pipeline and future chat.
// ---------------------------------------------------------------------------

export async function retrieveContext(query: string): Promise<string[]> {
  // TODO: implement vector search against statute embeddings
  void query;
  return [];
}
