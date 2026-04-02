import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { FeatureSection } from "@/components/feature-section";
import { getAuthUserFromServer } from "@/lib/auth";

export default async function Home() {
  const user = await getAuthUserFromServer();

  return (
    <main className="flex min-h-screen flex-col items-center">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center p-24 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">LeaseLens</h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-[600px]">
          AI-powered lease agreement analysis for Ontario residential tenancy law
        </p>
        {user ? (
          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <LayoutDashboard className="size-5" />
            Go to Dashboard
            <ArrowRight className="size-5" />
          </Link>
        ) : (
          <Link
            href="/login"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Get Started
            <ArrowRight className="size-5" />
          </Link>
        )}
      </section>

      {/* Feature Sections */}
      <div className="flex flex-col gap-8 md:gap-16 pb-24">
        <FeatureSection
          title="Sophisticated Cash Flows Analysis, Simplified"
          description="Modeling the many permutations of a lease proposal using a spreadsheet can be a painfully manual task. LeaseLens analysis is a powerful tool that automatically calculates cash flow for new and existing leases."
          imageSrc="/dashboard-mockup.png"
          imageAlt="LeaseLens Dashboard Mockup"
        />

        <FeatureSection
          title="Automated Clause Extraction & Risk Alerts"
          description="Upload any PDF lease agreement and our AI engine instantly identifies rent escalations, termination rights, and unusual clauses. Avoid costly oversights by uncovering hidden risks hidden in dense legal jargon before you sign."
          imageSrc="/document-analysis-mockup.png"
          imageAlt="LeaseLens AI Document Analysis"
          reversed={true}
        />

        <FeatureSection
          title="Real-Time Portfolio Tracking & Management"
          description="Get a crystal-clear overview of your entire real estate portfolio. Monitor occupancy rates, upcoming expirations, and revenue metrics across all properties from a single intuitive command center."
          imageSrc="/portfolio-overview-mockup.png"
          imageAlt="LeaseLens Portfolio Overview"
        />
      </div>
    </main>
  );
}