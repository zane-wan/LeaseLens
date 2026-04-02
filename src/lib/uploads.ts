import { Prisma, type UploadIntent, type UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isAdminLike } from "@/lib/rbac"
import { deleteS3Object, headS3Object } from "@/lib/s3"

export const ALLOWED_UPLOAD_CONTENT_TYPES = ["application/pdf"] as const
export const MAX_UPLOADS_PER_24H = 20
export const UPLOAD_INTENT_TTL_SECONDS = 10 * 60
const CLEANUP_BATCH_SIZE = 25

export class UploadQuotaError extends Error {}
export class UploadVerificationError extends Error {}

export function isUploadQuotaExempt(role: UserRole) {
  return isAdminLike(role)
}

export function getUploadQuotaErrorMessage(limit = MAX_UPLOADS_PER_24H) {
  return `Upload limit reached (${limit} files per 24 hours). Please try again later.`
}

export function getExpiredUploadIntentErrorMessage() {
  return "Upload URL expired. Please try uploading again."
}

export async function cleanupExpiredUploadIntents(limit = CLEANUP_BATCH_SIZE) {
  const now = new Date()
  const intents = await prisma.uploadIntent.findMany({
    where: {
      status: { in: ["RESERVED", "EXPIRED"] },
      expiresAt: { lt: now },
      cleanedUpAt: null,
    },
    orderBy: { expiresAt: "asc" },
    take: limit,
    select: {
      id: true,
      s3Key: true,
      agreementId: true,
    },
  })

  if (intents.length === 0) return

  await prisma.uploadIntent.updateMany({
    where: {
      id: { in: intents.map((intent) => intent.id) },
      status: "RESERVED",
    },
    data: { status: "EXPIRED" },
  })

  for (const intent of intents) {
    const agreement = intent.agreementId
      ? { id: intent.agreementId }
      : await prisma.agreement.findFirst({
          where: { s3Key: intent.s3Key },
          select: { id: true },
        })

    if (!agreement) {
      try {
        await deleteS3Object(intent.s3Key)
      } catch (error) {
        console.error("Failed to delete orphan upload object", error)
        continue
      }
    }

    await prisma.uploadIntent.update({
      where: { id: intent.id },
      data: { cleanedUpAt: now },
    })
  }
}

export async function createUploadIntent(
  userId: string,
  role: UserRole,
  input: {
    fileName: string
    contentType: string
    fileSize: number
    s3Key: string
  },
) {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return prisma.$transaction(async (tx) => {
    if (!isUploadQuotaExempt(role)) {
      const recentCount = await tx.uploadIntent.count({
        where: {
          userId,
          createdAt: { gte: oneDayAgo },
        },
      })

      if (recentCount >= MAX_UPLOADS_PER_24H) {
        throw new UploadQuotaError(getUploadQuotaErrorMessage())
      }
    }

    return tx.uploadIntent.create({
      data: {
        userId,
        fileName: input.fileName,
        contentType: input.contentType,
        fileSize: input.fileSize,
        s3Key: input.s3Key,
        expiresAt: new Date(now.getTime() + UPLOAD_INTENT_TTL_SECONDS * 1000),
      },
    })
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

export async function verifyUploadedObject(intent: Pick<UploadIntent, "s3Key" | "contentType" | "fileSize">) {
  let object: Awaited<ReturnType<typeof headS3Object>>

  try {
    object = await headS3Object(intent.s3Key)
  } catch (error) {
    const maybeStatusCode = typeof error === "object" && error !== null && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined

    if (
      (error instanceof Error && error.name === "NotFound") ||
      maybeStatusCode === 404
    ) {
      throw new UploadVerificationError("Uploaded file not found. Please upload again.")
    }

    throw error
  }

  if (object.contentLength !== intent.fileSize) {
    throw new UploadVerificationError("Uploaded file size does not match the reserved upload.")
  }

  if ((object.contentType ?? "").toLowerCase() !== intent.contentType.toLowerCase()) {
    throw new UploadVerificationError("Uploaded file type does not match the reserved upload.")
  }
}
