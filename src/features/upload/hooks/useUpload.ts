"use client"

import { useState, useCallback } from "react"
import { UploadState } from "../types"

interface UploadResult {
  id: string
  s3Key: string
}

interface UseUploadReturn {
  uploadState: UploadState
  upload: (file: File) => Promise<UploadResult | null>
  uploadMany: (files: File[]) => Promise<UploadResult[]>
  reset: () => void
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024  // 20MB
const MAX_FILES_PER_BATCH = 10

export function useUpload(): UseUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    errorMessage: null,
  })

  const reset = useCallback(() => {
    setUploadState({ status: "idle", progress: 0, errorMessage: null })
  }, [])

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    if (file.type !== "application/pdf") {
      setUploadState({ status: "error", progress: 0, errorMessage: "Only PDF files are supported" })
      return null
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadState({ status: "error", progress: 0, errorMessage: "File size cannot be greater than 20MB" })
      return null
    }

    try {
      // 1. Get presigned URL (include fileSize for server-side enforcement)
      const presignedRes = await fetch(
        `/api/upload/presigned?fileName=${encodeURIComponent(file.name)}&contentType=application/pdf&fileSize=${file.size}`
      )
      if (!presignedRes.ok) {
        const err = await presignedRes.json().catch(() => null)
        throw new Error(err?.error ?? "get presigned URL failed")
      }
      const { url, key } = await presignedRes.json()

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
        body: JSON.stringify({ fileName: file.name, s3Key: key }),
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

  const uploadMany = useCallback(async (files: File[]): Promise<UploadResult[]> => {
    if (files.length > MAX_FILES_PER_BATCH) {
      setUploadState({ status: "error", progress: 0, errorMessage: `You can upload at most ${MAX_FILES_PER_BATCH} files at once` })
      return []
    }
    setUploadState({ status: "uploading", progress: 0, errorMessage: null })

    const results: UploadResult[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const progress = Math.round(((i) / files.length) * 90)
        setUploadState({ status: "uploading", progress, errorMessage: null })

        const result = await upload(files[i])
        if (result) results.push(result)
      }

      setUploadState({ status: "success", progress: 100, errorMessage: null })
      return results
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed, please try again"
      setUploadState({ status: "error", progress: 0, errorMessage: message })
      return results
    }
  }, [upload])

  return { uploadState, upload, uploadMany, reset }
}
