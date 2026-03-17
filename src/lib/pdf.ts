import { getS3Object } from "@/lib/s3"
import { PDFParse } from "pdf-parse"

/**
 * Fetch a PDF from S3 by key (using IAM credentials) and extract plain text.
 * pdf-parse v2 wraps pdf.js's getDocument(), which accepts { data: Uint8Array }.
 * Node.js Buffer extends Uint8Array, so it can be passed directly.
 */
export async function extractPdfText(s3Key: string): Promise<string> {
  const buffer = await getS3Object(s3Key)
  // Pass buffer as `data` — pdf.js's getDocument() recognizes this key
  const parser = new PDFParse({ data: buffer, verbosity: -1 })
  const result = await parser.getText() as { text: string }
  return result.text
}
