import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const { mockRequireAuthFromRequest, mockGetPresignedUploadUrl, prismaMock } = vi.hoisted(() => ({
  mockRequireAuthFromRequest: vi.fn(),
  mockGetPresignedUploadUrl: vi.fn(),
  prismaMock: {
    uploadIntent: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    agreement: {
      findFirst: vi.fn(),
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
  getPresignedUploadUrl: mockGetPresignedUploadUrl,
  deleteS3Object: vi.fn(),
  headS3Object: vi.fn(),
}))

import { POST } from "./route"

function makeJsonRequest(body: unknown): NextRequest {
  return {
    method: "POST",
    url: "http://localhost/api/upload/presigned",
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe("POST /api/upload/presigned", () => {
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
    prismaMock.uploadIntent.count.mockResolvedValue(0)
    prismaMock.uploadIntent.create.mockResolvedValue({
      id: "intent-1",
      userId: "user-1",
      fileName: "lease.pdf",
      contentType: "application/pdf",
      fileSize: 123,
      s3Key: "users/user-1/uploads/uuid-lease.pdf",
      status: "RESERVED",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      cleanedUpAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    prismaMock.uploadIntent.delete.mockResolvedValue({} as never)
    prismaMock.agreement.findFirst.mockResolvedValue(null)
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock))

    mockGetPresignedUploadUrl.mockResolvedValue("https://s3.example.com/upload")
  })

  it("reserves an upload intent and returns the presigned upload details", async () => {
    const response = await POST(
      makeJsonRequest({
        fileName: "lease.pdf",
        contentType: "application/pdf",
        fileSize: 123,
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      url: "https://s3.example.com/upload",
      key: expect.stringMatching(/^users\/user-1\/uploads\/.+-lease\.pdf$/),
      intentId: "intent-1",
    })

    expect(prismaMock.uploadIntent.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        createdAt: { gte: expect.any(Date) },
      },
    })
    expect(prismaMock.uploadIntent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        fileName: "lease.pdf",
        contentType: "application/pdf",
        fileSize: 123,
        s3Key: json.key,
        expiresAt: expect.any(Date),
      }),
    })
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      json.key,
      "application/pdf",
      123,
    )
  })

  it("returns 429 when a normal user exceeds the 24-hour upload quota", async () => {
    prismaMock.uploadIntent.count.mockResolvedValue(20)

    const response = await POST(
      makeJsonRequest({
        fileName: "lease.pdf",
        contentType: "application/pdf",
        fileSize: 123,
      }),
    )

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: "Upload limit reached (20 files per 24 hours). Please try again later.",
    })
    expect(prismaMock.uploadIntent.create).not.toHaveBeenCalled()
  })

  it("bypasses the 24-hour quota for admin-like users", async () => {
    mockRequireAuthFromRequest.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
    })

    const response = await POST(
      makeJsonRequest({
        fileName: "lease.pdf",
        contentType: "application/pdf",
        fileSize: 123,
      }),
    )

    expect(response.status).toBe(200)
    expect(prismaMock.uploadIntent.count).not.toHaveBeenCalled()
    expect(prismaMock.uploadIntent.create).toHaveBeenCalled()
  })
})
