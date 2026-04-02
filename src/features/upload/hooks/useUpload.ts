"use client"

import { useState, useCallback } from "react"
import {
  MAX_AGREEMENTS_PER_SESSION,
  getSessionAgreementLimitErrorMessage,
} from "@/lib/agreements"
import { UploadState } from "../types"

interface UploadResult {
  id: string
  s3Key: string
}

interface UploadFailure {
  fileName: string
  error: string
}

interface UploadManyResult {
  successes: UploadResult[]
  failures: UploadFailure[]
}

interface UseUploadReturn {
  uploadState: UploadState
  upload: (file: File, sessionId?: string) => Promise<UploadResult>
  uploadMany: (files: File[], sessionId?: string) => Promise<UploadManyResult>
  reset: () => void
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024  // 20MB
const MAX_FILES_PER_BATCH = MAX_AGREEMENTS_PER_SESSION

export function useUpload(): UseUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    errorMessage: null,
  })

  const reset = useCallback(() => {
    setUploadState({ status: "idle", progress: 0, errorMessage: null })
  }, [])

  const upload = useCallback(async (file: File, sessionId?: string): Promise<UploadResult> => {
    if (file.type !== "application/pdf") {
      throw new Error("Only PDF files are supported")
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error("File size cannot be greater than 20MB")
    }

    try {
      // 1. Reserve an upload intent and get a presigned URL
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: "application/pdf",
          fileSize: file.size,
        }),
      })
      if (!presignedRes.ok) {
        const err = await presignedRes.json().catch(() => null)
        throw new Error(err?.error ?? "get presigned URL failed")
      }
      const { url, key, intentId } = await presignedRes.json()

      // 2. Upload to S3
      try {
        const uploadRes = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": "application/pdf" },
        })
        if (!uploadRes.ok) throw new Error("Upload file failed")
      } catch (s3Err) {
        if (url !== "https://mock-s3.example.com/upload") throw s3Err
      }

      // 3. Create agreement record
      const agreementRes = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIntentId: intentId, sessionId }),
      })
      if (!agreementRes.ok) {
        const err = await agreementRes.json().catch(() => null)
        throw new Error(err?.error ?? "create agreement record failed")
      }
      const agreement = await agreementRes.json()

      return { id: agreement.id, s3Key: key }
    } catch (err) {
      throw err
    }
  }, [])

  const uploadMany = useCallback(async (files: File[], sessionId?: string): Promise<UploadManyResult> => {
    if (files.length > MAX_FILES_PER_BATCH) {
      const message = getSessionAgreementLimitErrorMessage(MAX_FILES_PER_BATCH)
      setUploadState({ status: "error", progress: 0, errorMessage: message })
      return {
        successes: [],
        failures: files.map((file) => ({ fileName: file.name, error: message })),
      }
    }
    setUploadState({ status: "uploading", progress: 0, errorMessage: null })

    const successes: UploadResult[] = []
    const failures: UploadFailure[] = []

    for (let i = 0; i < files.length; i++) {
      const progress = Math.round((i / files.length) * 90)
      setUploadState({ status: "uploading", progress, errorMessage: null })

      try {
        const result = await upload(files[i], sessionId)
        successes.push(result)
      } catch (err) {
        failures.push({
          fileName: files[i].name,
          error: err instanceof Error ? err.message : "Upload failed, please try again",
        })
      }
    }

    if (failures.length > 0) {
      const summary =
        successes.length > 0
          ? `${successes.length} file(s) uploaded, ${failures.length} failed`
          : failures[0]?.error ?? "Upload failed, please try again"
      setUploadState({ status: "error", progress: 100, errorMessage: summary })
      return { successes, failures }
    }

    setUploadState({ status: "success", progress: 100, errorMessage: null })
    return { successes, failures: [] }
  }, [upload])

  return { uploadState, upload, uploadMany, reset }
}
