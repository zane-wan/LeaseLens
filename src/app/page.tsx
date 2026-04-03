import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Search,
  ShieldCheck,
} from "lucide-react"
import { getAuthUserFromServer } from "@/lib/auth"

function FeaturePoint({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  )
}

function HeroBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
      {children}
    </span>
  )
}

export default async function Home() {
  const user = await getAuthUserFromServer()

  return (
    <main className="w-full">
      <section className="w-full border-b bg-[radial-gradient(circle_at_top_left,rgba(228,237,250,0.8),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(237,243,228,0.7),transparent_28%)]">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
          <div className="space-y-8">
            <div className="flex flex-wrap gap-3">
              <HeroBadge>Additional terms</HeroBadge>
              <HeroBadge>Grounded Ontario context</HeroBadge>
              <HeroBadge>Many files in one run</HeroBadge>
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
                Review the clauses that actually change the deal
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                LeaseLens focuses on additional terms, schedules, and custom
                clauses. It uses retrieval from Ontario tenancy sources to keep
                analysis grounded and make multi file review faster and more
                dependable.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  <LayoutDashboard className="size-5" />
                  Go to Dashboard
                  <ArrowRight className="size-5" />
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  Create account
                  <ArrowRight className="size-5" />
                </Link>
              )}

              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-xl border bg-background/80 px-6 text-base font-medium text-foreground transition-colors hover:bg-background"
              >
                Sign in
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FeaturePoint
                title="Custom clause focus"
                body="Pull out schedules and added clauses instead of treating the whole lease like a generic blob of text."
              />
              <FeaturePoint
                title="Grounded explanations"
                body="Connect results to retrieved Ontario sources so the answer is not just free form model output."
              />
              <FeaturePoint
                title="Batch review flow"
                body="Keep many documents in one workspace and run review without repeating the same steps file by file."
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-slate-200/50 via-transparent to-emerald-200/40 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border bg-card/90 shadow-2xl">
              <div className="border-b bg-muted/60 px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Review queue</p>
                    <p className="text-sm text-muted-foreground">
                      Additional terms across active lease files
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    8 files ready
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FolderOpen className="size-4 text-primary" />
                      Uploaded set
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Lease A", "Additional terms detected", "Ready"],
                        ["Lease B", "Schedule A and Schedule B", "Ready"],
                        ["Lease C", "Appendix language found", "Queued"],
                      ].map(([name, detail, state]) => (
                        <div key={name} className="flex items-center justify-between rounded-xl border px-3 py-3">
                          <div>
                            <p className="text-sm font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">{detail}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {state}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-background p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Search className="size-4 text-primary" />
                        Retrieved context
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl bg-muted/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Source
                          </p>
                          <p className="mt-2 text-sm">Residential Tenancies Act</p>
                        </div>
                        <div className="rounded-xl bg-muted/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Match
                          </p>
                          <p className="mt-2 text-sm">
                            Deposit and termination language retrieved for review
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ShieldCheck className="size-4 text-primary" />
                        Review signal
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Grounded results help reduce hallucination by tying the
                        explanation to retrieved Ontario material before the
                        final assessment is shown.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
          <div className="relative mx-auto w-full max-w-[680px]">
            <div className="relative rounded-[1.75rem] border-[8px] border-slate-900 bg-slate-900 shadow-2xl shadow-black/20">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1.1rem] bg-muted">
                <Image
                  src="/document-analysis-mockup.png"
                  alt="LeaseLens document analysis view"
                  fill
                  className="object-cover object-left-top"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Clause level review
            </p>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              See additional terms in context, not as isolated snippets
            </h2>
            <p className="text-lg leading-8 text-muted-foreground">
              LeaseLens highlights the exact language inside the uploaded file
              and pairs it with a structured review pane. That makes it easier
              to inspect custom clauses, compare the text with retrieved
              context, and understand why a term needs attention.
            </p>

            <div className="grid gap-4">
              <FeaturePoint
                title="Text anchored review"
                body="Keep the clause text, source page, and review signal visible in one place while you read."
              />
              <FeaturePoint
                title="Additional terms first"
                body="Give priority to schedules, appendices, and added obligations where unusual risk often appears."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full border-y bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Grounded analysis
            </p>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Use retrieval to keep the explanation tied to Ontario sources
            </h2>
            <p className="text-lg leading-8 text-muted-foreground">
              The product is not meant to stop at a generic model answer.
              LeaseLens retrieves Ontario tenancy material first, then uses that
              context to support the final review. This lowers the chance of
              unsupported claims and keeps the output closer to the governing
              rules.
            </p>
          </div>

          <div className="rounded-[2rem] border bg-card p-6 shadow-xl sm:p-8">
            <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border bg-background p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-primary" />
                  Clause text
                </div>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  The tenant must provide post dated payments for the full lease
                  term and must give ninety days notice before termination.
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="size-4 text-primary" />
                  Retrieved support
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Ontario source
                    </p>
                    <p className="mt-2 text-sm">
                      Residential tenancy rules on payment methods and notice language
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Why it matters
                    </p>
                    <p className="mt-2 text-sm">
                      The explanation is built after retrieval, which helps reduce hallucination.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
          <div className="rounded-[2rem] border bg-card p-6 shadow-xl sm:p-8">
            <div className="flex items-center justify-between gap-4 border-b pb-4">
              <div>
                <p className="text-sm font-semibold">Batch workspace</p>
                <p className="text-sm text-muted-foreground">
                  One click review across many lease files
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                12 documents
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              {[
                ["Ontario standard lease", "4 additional terms found", "Review ready"],
                ["Lease addendum", "2 clauses need review", "Review ready"],
                ["Schedule A", "3 grounded matches", "Review ready"],
                ["Schedule B", "Queued for extraction", "In progress"],
              ].map(([name, detail, state]) => (
                <div key={name} className="grid gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                  </div>
                  <span className="justify-self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 sm:justify-self-end">
                    {state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Many file workflow
            </p>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Move from one lease to many without losing the thread
            </h2>
            <p className="text-lg leading-8 text-muted-foreground">
              Instead of repeating the same upload and review process for every
              document, LeaseLens keeps many files inside one workspace so you
              can run analysis, inspect results, and decide what deserves
              follow up.
            </p>

            <div className="grid gap-4">
              <FeaturePoint
                title="Faster review pass"
                body="Run a consistent review flow across the full set of lease files you need to inspect."
              />
              <FeaturePoint
                title="Shared context"
                body="Keep summaries and grounded findings together so the next file does not start from zero."
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
