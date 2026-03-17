"use client"

import { useState, useEffect, useCallback } from "react"
import { DropZone } from "@/features/upload/components/DropZone"
import { AgreementList } from "@/features/upload/components/AgreementList"
import { useUpload } from "@/features/upload/hooks/useUpload"
import { AgreementItem } from "@/features/upload/types"

export default function DashboardPage() {
  const { uploadState, upload, reset } = useUpload()
  const [agreements, setAgreements] = useState<AgreementItem[]>([])
  const [pageError, setPageError] = useState<string | null>(null)

  const fetchAgreements = useCallback(async () => {
    const res = await fetch("/api/agreements")
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to fetch agreements")
      return
    }
    setPageError(null)
    setAgreements(await res.json())
  }, [])

  useEffect(() => {
    fetchAgreements()
  }, [fetchAgreements])

  const handleFileDrop = async (file: File) => {
    const result = await upload(file)
    if (result) fetchAgreements()
  }

  const handleAnalyze = async (id: string) => {
    const res = await fetch(`/api/agreements/${id}/analyze`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to start analysis")
      return
    }
    setPageError(null)
    fetchAgreements()
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/agreements/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      setPageError(err?.error ?? "Failed to delete agreement")
      return
    }
    setPageError(null)
    fetchAgreements()
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">My Agreements</h1>
      <DropZone
        uploadState={uploadState}
        onFileDrop={handleFileDrop}
        onReset={reset}
      />
      {pageError ? <p className="mt-3 text-sm text-destructive">{pageError}</p> : null}
      <AgreementList agreements={agreements} onAnalyze={handleAnalyze} onDelete={handleDelete} />
    </main>
  )
}
