"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"

type Compliance = "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW"
type Severity = "LOW" | "MEDIUM" | "HIGH" | null

export interface ClauseResultData {
  id: string
  clauseIndex: number
  clauseTitle: string
  clauseText: string
  compliance: Compliance
  explanation: string
  rtaCitations: string[]
  severity: Severity
  issue: string | null
  legalBasis: string | null
  suggestion: string | null
}

const COMPLIANCE_LABEL: Record<Compliance, string> = {
  COMPLIANT: "Compliant",
  NON_COMPLIANT: "Non-compliant",
  NEEDS_REVIEW: "Needs Review",
}

const COMPLIANCE_BADGE: Record<Compliance, "default" | "destructive" | "secondary"> = {
  COMPLIANT: "default",
  NON_COMPLIANT: "destructive",
  NEEDS_REVIEW: "secondary",
}

const SEVERITY_BADGE: Record<NonNullable<Severity>, "outline" | "secondary" | "destructive"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "destructive",
}

const LEFT_BORDER: Record<Compliance, string> = {
  COMPLIANT: "border-l-4 border-l-green-500",
  NON_COMPLIANT: "border-l-4 border-l-red-500",
  NEEDS_REVIEW: "border-l-4 border-l-amber-400",
}

interface ClauseCardProps {
  result: ClauseResultData
}

export function ClauseCard({ result }: ClauseCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={`overflow-hidden ${LEFT_BORDER[result.compliance]}`}>
        {/* Header row — always visible */}
        <CollapsibleTrigger className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-sm font-medium truncate">
              Clause {result.clauseIndex + 1}: {result.clauseTitle}
            </span>
            <Badge variant={COMPLIANCE_BADGE[result.compliance]}>
              {COMPLIANCE_LABEL[result.compliance]}
            </Badge>
            {result.severity && (
              <Badge variant={SEVERITY_BADGE[result.severity]}>
                {result.severity}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        {/* Expandable detail */}
        <CollapsibleContent>
          <div className="px-5 pb-5 pt-1 border-t">
            <Tabs defaultValue="overview">
              <TabsList className="mb-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="suggestion">Suggestion</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Clause Text</p>
                  <p className="text-sm bg-muted/50 rounded p-3">{result.clauseText}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Analysis</p>
                  <p className="text-sm">{result.explanation}</p>
                </div>
                {result.rtaCitations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">RTA Citations</p>
                    <div className="flex flex-wrap gap-2">
                      {result.rtaCitations.map((c) => (
                        <Badge key={c} variant="outline">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-3">
                {result.issue ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Issue</p>
                    <p className="text-sm">{result.issue}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No specific issue identified.</p>
                )}
                {result.legalBasis && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Legal Basis</p>
                    <p className="text-sm">{result.legalBasis}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="suggestion">
                {result.suggestion ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Suggested Change</p>
                    <p className="text-sm">{result.suggestion}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No suggestion — this clause looks fine.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
