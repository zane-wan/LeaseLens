import { notFound, redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getAuthUserFromServer } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function complianceTone(label: "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW") {
  if (label === "COMPLIANT") return "default"
  if (label === "NON_COMPLIANT") return "destructive"
  return "secondary"
}

function severityTone(level: "LOW" | "MEDIUM" | "HIGH" | null) {
  if (!level) return "outline"
  if (level === "HIGH") return "destructive"
  if (level === "MEDIUM") return "secondary"
  return "outline"
}

export default async function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUserFromServer()
  if (!user) {
    redirect("/login")
  }

  const { id } = await params
  const agreement = await prisma.agreement.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      analysis: {
        include: {
          clauseResults: {
            orderBy: { clauseIndex: "asc" },
          },
        },
      },
    },
  })

  if (!agreement) {
    notFound()
  }

  const analysis = agreement.analysis
  const results = analysis?.clauseResults ?? []
  const compliant = results.filter((r) => r.compliance === "COMPLIANT").length
  const nonCompliant = results.filter((r) => r.compliance === "NON_COMPLIANT").length
  const review = results.filter((r) => r.compliance === "NEEDS_REVIEW").length

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{agreement.fileName}</h1>
          <p className="text-sm text-muted-foreground">
            Uploaded on {new Date(agreement.uploadedAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline">Agreement {agreement.status}</Badge>
      </div>

      {!analysis ? (
        <Card className="p-6">
          <p className="text-sm font-medium">No analysis started yet.</p>
          <p className="text-sm text-muted-foreground">
            Trigger analysis from the dashboard to generate clause-by-clause results.
          </p>
        </Card>
      ) : null}

      {analysis?.status === "QUEUED" || analysis?.status === "PROCESSING" ? (
        <Card className="p-6">
          <p className="text-sm font-medium">Analysis is running.</p>
          <p className="text-sm text-muted-foreground">Status: {analysis.status}</p>
        </Card>
      ) : null}

      {analysis?.status === "FAILED" ? (
        <Card className="p-6">
          <p className="text-sm font-medium text-destructive">Analysis failed</p>
          <p className="text-sm text-muted-foreground">
            {analysis.errorMessage ?? "No error message recorded."}
          </p>
        </Card>
      ) : null}

      {analysis?.status === "COMPLETED" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Compliant</p>
              <p className="text-2xl font-semibold">{compliant}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Non-compliant</p>
              <p className="text-2xl font-semibold">{nonCompliant}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Needs review</p>
              <p className="text-2xl font-semibold">{review}</p>
            </Card>
          </div>

          {results.length === 0 ? (
            <Card className="p-6">
              <p className="text-sm font-medium">No clause results were stored.</p>
              <p className="text-sm text-muted-foreground">
                The analysis is complete, but no clause rows exist yet.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <Card key={r.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      Clause {r.clauseIndex + 1}: {r.clauseTitle}
                    </span>
                    <Badge variant={complianceTone(r.compliance)}>{r.compliance}</Badge>
                    <Badge variant={severityTone(r.severity)}>{r.severity ?? "N/A"}</Badge>
                  </div>

                  <p className="text-sm">{r.clauseText}</p>
                  <p className="text-sm text-muted-foreground">{r.explanation}</p>

                  <div className="flex flex-wrap gap-2">
                    {r.rtaCitations.map((citation) => (
                      <Badge key={`${r.id}-${citation}`} variant="outline">
                        {citation}
                      </Badge>
                    ))}
                    {r.rtaCitations.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No citations</span>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  )
}
