"use client"

import { AgreementItem } from "../types"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { MoreHorizontal, Calendar, Trash2, Play, FileText, RefreshCw, Loader2, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AgreementListProps {
  agreements: AgreementItem[]
  onAnalyze: (id: string) => void
  onCancel: (id: string) => void
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

export function AgreementList({ agreements, onAnalyze, onCancel, onDelete }: AgreementListProps) {
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
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8 w-8 p-0" })}>
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-normal text-muted-foreground">Uploaded {new Date(a.uploadedAt).toLocaleDateString("zh-CN")}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                
                {a.status === "PENDING" && (
                  <DropdownMenuItem onClick={() => onAnalyze(a.id)} className="cursor-pointer">
                    <Play className="mr-2 h-4 w-4 text-primary" />
                    <span>Start Analysis</span>
                  </DropdownMenuItem>
                )}
                {a.status === "PROCESSING" && (
                  <>
                    <DropdownMenuItem disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                      <span>Analyzing...</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onCancel(a.id)}
                      className="cursor-pointer text-muted-foreground"
                    >
                      <X className="mr-2 h-4 w-4" />
                      <span>Cancel Analysis</span>
                    </DropdownMenuItem>
                  </>
                )}
                {a.status === "COMPLETED" && (
                  <a href={`/agreements/${a.id}`} className="w-full">
                    <DropdownMenuItem className="cursor-pointer w-full flex items-center">
                      <FileText className="mr-2 h-4 w-4 text-green-600" />
                      <span>View Results</span>
                    </DropdownMenuItem>
                  </a>
                )}
                {a.status === "FAILED" && (
                  <DropdownMenuItem onClick={() => onAnalyze(a.id)} className="cursor-pointer">
                    <RefreshCw className="mr-2 h-4 w-4 text-destructive" />
                    <span className="text-destructive">Retry Analysis</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(a.id)} className="cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
      ))}
    </ul>
  )
}
