// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>

/**
 * Fetch a PDF from S3 by key and extract plain text.
 * Called by the analysis pipeline (T5), not at upload time.
 */
export async function extractPdfText(s3Key: string): Promise<string> {
  const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
  const res = await fetch(s3Url)
  if (!res.ok) throw new Error(`Failed to fetch PDF from S3: ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const data = await pdfParse(buffer)
  return data.text
}
