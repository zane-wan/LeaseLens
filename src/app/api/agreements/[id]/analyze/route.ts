import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAnalysisPipeline } from "@/features/analysis/pipeline/orchestrator";

/**
 * POST /api/agreements/:id/analyze
 *
 * Triggers the full analysis pipeline for an uploaded lease agreement.
 * Returns immediately with the analysis record; processing continues async.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // TODO: replace with real auth session after T1 wiring
  const userId = "dev-user";

  const agreement = await prisma.agreement.findUnique({ where: { id } });

  if (!agreement) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
  }
  if (agreement.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (agreement.status === "PROCESSING") {
    return NextResponse.json(
      { error: "Analysis already in progress" },
      { status: 409 },
    );
  }

  // Fire-and-forget: run pipeline in the background.
  // The client polls /api/agreements/:id/status for progress.
  runAnalysisPipeline(id).catch((err) => {
    console.error(`[analyze] Pipeline failed for agreement ${id}:`, err);
  });

  return NextResponse.json(
    { message: "Analysis started", agreementId: id },
    { status: 202 },
  );
}
