import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let _s3: S3Client | null = null
function getS3Client() {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _s3
}

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  fileSize: number,
) {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSize,
  })

  return getSignedUrl(getS3Client(), command, { expiresIn: 600 })
}

export async function getS3Object(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
  })
  const response = await getS3Client().send(command)
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
