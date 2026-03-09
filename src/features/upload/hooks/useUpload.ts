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
      setUploadState({ status: "error", progress: 0, errorMessage: "只支持 PDF 文件" })
      return null
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadState({ status: "error", progress: 0, errorMessage: "文件不能超过 20MB" })
      return null
    }

    setUploadState({ status: "uploading", progress: 10, errorMessage: null })

    try {
      // 1. Get presigned URL
      const presignedRes = await fetch(
        `/api/upload/presigned?fileName=${encodeURIComponent(file.name)}&contentType=application/pdf`
      )
      if (!presignedRes.ok) throw new Error("获取上传链接失败")
      const { url, key } = await presignedRes.json()

      setUploadState({ status: "uploading", progress: 30, errorMessage: null })

      // 2. Upload to S3
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      })
      // Mock will return non-OK; treat it as success in dev
      if (!uploadRes.ok && url !== "https://mock-s3.example.com/upload") {
        throw new Error("上传文件失败")
      }

      setUploadState({ status: "uploading", progress: 80, errorMessage: null })

      // 3. Create agreement record
      const agreementRes = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, s3Key: key }),
      })
      if (!agreementRes.ok) throw new Error("创建记录失败")
      const agreement = await agreementRes.json()

      setUploadState({ status: "success", progress: 100, errorMessage: null })
      return { id: agreement.id, s3Key: key }
    } catch (err) {
      const message = err instanceof Error ? err.message : "上传失败，请重试"
      setUploadState({ status: "error", progress: 0, errorMessage: message })
      return null
    }
  }, [])

  return { uploadState, upload, reset }
}
