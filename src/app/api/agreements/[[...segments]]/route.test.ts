import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const { mockRequireAuthFromRequest, mockHeadS3Object, mockDeleteS3Object, prismaMock } = vi.hoisted(() => ({
  mockRequireAuthFromRequest: vi.fn(),
  mockHeadS3Object: vi.fn(),
  mockDeleteS3Object: vi.fn(),
  prismaMock: {
    uploadIntent: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    agreement: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    chatSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => {
  class AuthError extends Error {
    status: number

    constructor(message: string, status = 401) {
      super(message)
      this.status = status
    }
  }

  return {
    AuthError,
    requireAuthFromRequest: mockRequireAuthFromRequest,
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/s3", () => ({
  MAX_UPLOAD_SIZE_BYTES: 20 * 1024 * 1024,
  getPresignedUploadUrl: vi.fn(),
  deleteS3Object: mockDeleteS3Object,
  headS3Object: mockHeadS3Object,
}))

import { POST } from "./route"

function makeJsonRequest(body: unknown): NextRequest {
  return {
    method: "POST",
    url: "http://localhost/api/agreements",
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

function makeIntent(overrides?: Partial<{
  id: string
  agreementId: string | null
  fileName: string
  contentType: string
  fileSize: number
  s3Key: string
  status: "RESERVED" | "CONSUMED" | "EXPIRED"
  expiresAt: Date
}>) {
  return {
    id: "intent-1",
    agreementId: null,
    fileName: "lease.pdf",
    contentType: "application/pdf",
    fileSize: 123,
    s3Key: "users/user-1/uploads/uuid-lease.pdf",
    status: "RESERVED" as const,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  }
}

describe("POST /api/agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockRequireAuthFromRequest.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "USER",
    })

    prismaMock.uploadIntent.findMany.mockResolvedValue([])
    prismaMock.uploadIntent.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.uploadIntent.update.mockResolvedValue({} as never)
    prismaMock.uploadIntent.findFirst.mockResolvedValue(makeIntent())

    prismaMock.agreement.findFirst.mockResolvedValue(null)
    prismaMock.agreement.findMany.mockResolvedValue([])
    prismaMock.agreement.findUnique.mockResolvedValue(null)
    prismaMock.agreement.create.mockResolvedValue({
      id: "agreement-1",
      userId: "user-1",
      fileName: "lease.pdf",
      s3Key: "users/user-1/uploads/uuid-lease.pdf",
      status: "PENDING",
    })
    prismaMock.agreement.delete.mockResolvedValue({} as never)

    prismaMock.chatSession.findFirst.mockResolvedValue({
      id: "session-1",
      title: "New Session",
      _count: { agreements: 0 },
    })
    prismaMock.chatSession.findUnique.mockResolvedValue({
      title: "New Session",
    })
    prismaMock.chatSession.update.mockResolvedValue({} as never)

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock))

    mockHeadS3Object.mockResolvedValue({
      contentLength: 123,
      contentType: "application/pdf",
    })
    mockDeleteS3Object.mockResolvedValue(undefined)
  })

  it("finalizes a reserved upload intent into an agreement and consumes the intent", async () => {
    prismaMock.uploadIntent.findFirst
      .mockResolvedValueOnce(makeIntent())
      .mockResolvedValueOnce(makeIntent())

    const response = await POST(
      makeJsonRequest({
        uploadIntentId: "intent-1",
        sessionId: "session-1",
      }),
      { params: Promise.resolve({ segments: [] }) },
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: "agreement-1",
        fileName: "lease.pdf",
        s3Key: "users/user-1/uploads/uuid-lease.pdf",
      }),
    )

    expect(mockHeadS3Object).toHaveBeenCalledWith("users/user-1/uploads/uuid-lease.pdf")
    expect(prismaMock.agreement.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        fileName: "lease.pdf",
        s3Key: "users/user-1/uploads/uuid-lease.pdf",
        chatSessions: {
          connect: [{ id: "session-1" }],
        },
      },
    })
    expect(prismaMock.uploadIntent.update).toHaveBeenCalledWith({
      where: { id: "intent-1" },
      data: {
        status: "CONSUMED",
        consumedAt: expect.any(Date),
        agreementId: "agreement-1",
      },
    })
  })

  it("returns the existing agreement when the upload intent was already consumed", async () => {
    const existingAgreement = {
      id: "agreement-1",
      userId: "user-1",
      fileName: "lease.pdf",
      s3Key: "users/user-1/uploads/uuid-lease.pdf",
      status: "PENDING",
    }

    prismaMock.uploadIntent.findFirst.mockResolvedValue(
      makeIntent({
        status: "CONSUMED",
        agreementId: "agreement-1",
      }),
    )
    prismaMock.agreement.findFirst.mockResolvedValue(existingAgreement)

    const response = await POST(
      makeJsonRequest({
        uploadIntentId: "intent-1",
      }),
      { params: Promise.resolve({ segments: [] }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(existingAgreement)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("rejects expired upload intents", async () => {
    prismaMock.uploadIntent.findFirst.mockResolvedValue(
      makeIntent({
        expiresAt: new Date(Date.now() - 1000),
      }),
    )

    const response = await POST(
      makeJsonRequest({
        uploadIntentId: "intent-1",
      }),
      { params: Promise.resolve({ segments: [] }) },
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Upload URL expired. Please try uploading again.",
    })
  })

  it("rejects finalize requests when the uploaded object cannot be verified", async () => {
    prismaMock.uploadIntent.findFirst.mockResolvedValue(makeIntent())
    mockHeadS3Object.mockRejectedValue({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    })

    const response = await POST(
      makeJsonRequest({
        uploadIntentId: "intent-1",
      }),
      { params: Promise.resolve({ segments: [] }) },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Uploaded file not found. Please upload again.",
    })
  })
})
