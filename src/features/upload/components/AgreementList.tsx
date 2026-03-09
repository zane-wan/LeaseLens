"use client"

import { AgreementItem } from "../types"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"

interface AgreementListProps {
  agreements: AgreementItem[]
  onAnalyze: (id: string) => void
  onDelete: (id: string) => void
}

const statusLabel: Record<AgreementItem["status"], string> = {
  PENDING: "To analyze",
  PROCESSING: "Analyzing",
  COMPLETED: "Completed",
  FAILED: "Failed",
}

const statusVariant: Record<AgreementItem["status"], "secondary" | "default" | "outline" | "destructive"> = {
  PENDING: "secondary",
  PROCESSING: "default",
  COMPLETED: "outline",
  FAILED: "destructive",
}

export function AgreementList({ agreements, onAnalyze, onDelete }: AgreementListProps) {
  if (agreements.length === 0) {
    return <p className="text-muted-foreground text-sm mt-6">No agreements uploaded yet</p>
  }

  return (
    <ul className="mt-6 space-y-3">
      {agreements.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between rounded-lg border px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium truncate max-w-xs">{a.fileName}</span>
            <Badge variant={statusVariant[a.status]}>{statusLabel[a.status]}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{new Date(a.uploadedAt).toLocaleDateString("zh-CN")}</span>
            {a.status === "PENDING" && (
              <Button size="sm" onClick={() => onAnalyze(a.id)}>
                Start analysis
              </Button>
            )}
            {a.status === "PROCESSING" && (
              <Button size="sm" disabled>
                Analyzing...
              </Button>
            )}
            {a.status === "COMPLETED" && (
              <a
                href={`/agreements/${a.id}`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                View results
              </a>
            )}
            {a.status === "FAILED" && (
              <Button size="sm" variant="destructive" onClick={() => onAnalyze(a.id)}>
                Retry
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(a.id)}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
