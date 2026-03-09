"use client"

import { useState, useEffect, useCallback } from "react"
import { DropZone } from "@/features/upload/components/DropZone"
import { AgreementList } from "@/features/upload/components/AgreementList"
import { useUpload } from "@/features/upload/hooks/useUpload"
import { AgreementItem } from "@/features/upload/types"

export default function DashboardPage() {
  const { uploadState, upload, reset } = useUpload()
  const [agreements, setAgreements] = useState<AgreementItem[]>([])

  const fetchAgreements = useCallback(async () => {
    const res = await fetch("/api/agreements")
    if (res.ok) setAgreements(await res.json())
  }, [])

  useEffect(() => {
    fetchAgreements()
  }, [fetchAgreements])

  const handleFileDrop = async (file: File) => {
    const result = await upload(file)
    if (result) fetchAgreements()
  }

  const handleAnalyze = async (id: string) => {
    // Triggers analysis — T5 will implement /api/agreements/[id]/analyze
    await fetch(`/api/agreements/${id}/analyze`, { method: "POST" })
    fetchAgreements()
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">我的协议</h1>
      <DropZone
        uploadState={uploadState}
        onFileDrop={handleFileDrop}
        onReset={reset}
      />
      <AgreementList agreements={agreements} onAnalyze={handleAnalyze} />
    </main>
  )
}
