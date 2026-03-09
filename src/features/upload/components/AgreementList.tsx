"use client"

import { AgreementItem } from "../types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface AgreementListProps {
  agreements: AgreementItem[]
  onAnalyze: (id: string) => void
}

const statusLabel: Record<AgreementItem["status"], string> = {
  PENDING: "待分析",
  PROCESSING: "分析中",
  COMPLETED: "已完成",
  FAILED: "失败",
}

const statusVariant: Record<AgreementItem["status"], "secondary" | "default" | "outline" | "destructive"> = {
  PENDING: "secondary",
  PROCESSING: "default",
  COMPLETED: "outline",
  FAILED: "destructive",
}

export function AgreementList({ agreements, onAnalyze }: AgreementListProps) {
  if (agreements.length === 0) {
    return <p className="text-muted-foreground text-sm mt-6">还没有上传的协议</p>
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
                开始分析
              </Button>
            )}
            {a.status === "PROCESSING" && (
              <Button size="sm" disabled>
                分析中…
              </Button>
            )}
            {a.status === "COMPLETED" && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/agreements/${a.id}`}>查看结果</a>
              </Button>
            )}
            {a.status === "FAILED" && (
              <Button size="sm" variant="destructive" onClick={() => onAnalyze(a.id)}>
                重试
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
