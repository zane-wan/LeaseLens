import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { getAuthUserFromServer } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ClauseCard } from "@/features/analysis/components/ClauseCard"
import { RiskScoreRing } from "@/features/analysis/components/RiskScoreRing"

export default async function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUserFromServer()
  if (!user) redirect("/login")

  const { id } = await params
  const agreement = await prisma.agreement.findFirst({
    where: { id, userId: user.id },
    include: {
      analysis: {
        include: {
          clauseResults: { orderBy: { clauseIndex: "asc" } },
        },
      },
    },
  })

  if (!agreement) notFound()

  const analysis = agreement.analysis
  const results = analysis?.clauseResults ?? []
  const compliant = results.filter((r) => r.compliance === "COMPLIANT").length
  const nonCompliant = results.filter((r) => r.compliance === "NON_COMPLIANT").length
  const needsReview = results.filter((r) => r.compliance === "NEEDS_REVIEW").length

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      {/* Back + title */}
      <div className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 -ml-2 px-2 py-1 text-sm text-muted-foreground rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{agreement.fileName}</h1>
            <p className="text-sm text-muted-foreground">
              Uploaded {new Date(agreement.uploadedAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="outline">{agreement.status}</Badge>
        </div>
      </div>

      {/* Not started */}
      {!analysis && (
        <Card className="p-6 space-y-1">
          <p className="text-sm font-medium">No analysis started yet.</p>
          <p className="text-sm text-muted-foreground">
            Trigger analysis from the dashboard to generate clause-by-clause results.
          </p>
        </Card>
      )}

      {/* In progress */}
      {(analysis?.status === "QUEUED" || analysis?.status === "PROCESSING") && (
        <Card className="p-6 space-y-1">
          <p className="text-sm font-medium">Analysis is running…</p>
          <p className="text-sm text-muted-foreground">Come back in a moment or refresh the page.</p>
        </Card>
      )}

      {/* Failed */}
      {analysis?.status === "FAILED" && (
        <Card className="p-6 space-y-1">
          <p className="text-sm font-medium text-destructive">Analysis failed</p>
          <p className="text-sm text-muted-foreground">
            {analysis.errorMessage ?? "No error message recorded."}
          </p>
        </Card>
      )}

      {/* Completed */}
      {analysis?.status === "COMPLETED" && (
        <div className="space-y-6">
          {/* Summary bar */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Risk ring */}
              <RiskScoreRing score={analysis.riskScore ?? 0} />

              {/* Divider */}
              <div className="hidden sm:block w-px self-stretch bg-border" />

              {/* Stats */}
              <div className="flex-1 space-y-3 w-full">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-500">{compliant}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Compliant</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{needsReview}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Needs Review</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{nonCompliant}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Non-compliant</p>
                  </div>
                </div>

                {analysis.overallSummary && (
                  <p className="text-sm text-muted-foreground border-t pt-3">
                    {analysis.overallSummary}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Clause cards */}
          {results.length === 0 ? (
            <Card className="p-6 space-y-1">
              <p className="text-sm font-medium">No clause results recorded.</p>
              <p className="text-sm text-muted-foreground">
                The analysis completed but found no custom clauses to evaluate.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <ClauseCard
                  key={r.id}
                  result={{
                    id: r.id,
                    clauseIndex: r.clauseIndex,
                    clauseTitle: r.clauseTitle,
                    clauseText: r.clauseText,
                    compliance: r.compliance,
                    explanation: r.explanation,
                    rtaCitations: r.rtaCitations,
                    severity: r.severity,
                    issue: r.issue,
                    legalBasis: r.legalBasis,
                    suggestion: r.suggestion,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
