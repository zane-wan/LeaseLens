import OpenAI from "openai"

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI()
  return _openai
}

export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  })
  return response.data[0].embedding
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  })
  return response.data.map((d) => d.embedding)
}
