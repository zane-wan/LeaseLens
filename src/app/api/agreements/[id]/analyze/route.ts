import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuthFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAnalysisPipeline } from "@/features/analysis/pipeline/orchestrator";

/**
 * POST /api/agreements/:id/analyze
 *
 * Queues the analysis record in the DB, then fires the full pipeline
 * in the background. Returns 202 immediately; client polls status.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthFromRequest(req);
    const { id } = await params;

    const agreement = await prisma.agreement.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    // Create / reset the Analysis record so the UI immediately sees QUEUED.
    const analysis = await prisma.analysis.upsert({
      where: { agreementId: agreement.id },
      create: {
        agreementId: agreement.id,
        status: "QUEUED",
      },
      update: {
        status: "QUEUED",
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      },
      select: {
        id: true,
        agreementId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.agreement.update({
      where: { id: agreement.id },
      data: { status: "PROCESSING" },
    });

    // Fire-and-forget: run the full pipeline in the background.
    // runAnalysisPipeline internally transitions status → PROCESSING → COMPLETED/FAILED.
    runAnalysisPipeline(agreement.id).catch((err) => {
      console.error(`[analyze] Pipeline failed for agreement ${agreement.id}:`, err);
    });

    return NextResponse.json(
      { analysis, message: "Analysis queued." },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to queue analysis" }, { status: 500 });
  }
}
