"use client"

import { useState, useCallback } from "react"
import { UploadState } from "../types"

interface UseUploadReturn {
  uploadState: UploadState
  upload: (file: File) => Promise<{ id: string; s3Key: string } | null>
  reset: () => void
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024  // 20MB

export function useUpload(): UseUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    errorMessage: null,
  })

  const reset = useCallback(() => {
    setUploadState({ status: "idle", progress: 0, errorMessage: null })
  }, [])

  const upload = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setUploadState({ status: "error", progress: 0, errorMessage: "Only PDF files are supported" })
      return null
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadState({ status: "error", progress: 0, errorMessage: "File size cannot be greater than 20MB" })
      return null
    }

    setUploadState({ status: "uploading", progress: 10, errorMessage: null })

    try {
      // 1. Get presigned URL
      const presignedRes = await fetch(
        `/api/upload/presigned?fileName=${encodeURIComponent(file.name)}&contentType=application/pdf`
      )
      if (!presignedRes.ok) {
        const err = await presignedRes.json().catch(() => null)
        throw new Error(err?.error ?? "get presigned URL failed")
      }
      const { url, key } = await presignedRes.json()

      setUploadState({ status: "uploading", progress: 30, errorMessage: null })

      // 2. Upload to S3 (mock URL will throw a network error — swallow it in dev)
      try {
        const uploadRes = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": "application/pdf" },
        })
        if (!uploadRes.ok) throw new Error("Upload file failed")
      } catch (s3Err) {
        if (url !== "https://mock-s3.example.com/upload") throw s3Err
        // Expected: mock URL is unreachable, skip
      }

      setUploadState({ status: "uploading", progress: 80, errorMessage: null })

      // 3. Create agreement record
      const agreementRes = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, s3Key: key }),
      })
      if (!agreementRes.ok) {
        const err = await agreementRes.json().catch(() => null)
        throw new Error(err?.error ?? "create agreement record failed")
      }
      const agreement = await agreementRes.json()

      setUploadState({ status: "success", progress: 100, errorMessage: null })
      return { id: agreement.id, s3Key: key }
    } catch (err) {
      const message = err instanceof Error ? err.message : "create agreement record failed, please try again"
      setUploadState({ status: "error", progress: 0, errorMessage: message })
      return null
    }
  }, [])

  return { uploadState, upload, reset }
}
