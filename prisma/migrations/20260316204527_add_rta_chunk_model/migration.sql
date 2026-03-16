-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "isGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prevDoc" TEXT;

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "overallSummary" TEXT,
ADD COLUMN     "riskScore" INTEGER;

-- AlterTable
ALTER TABLE "ClauseResult" ADD COLUMN     "issue" TEXT,
ADD COLUMN     "legalBasis" TEXT,
ADD COLUMN     "suggestion" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "RtaChunk" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "part" TEXT,
    "partTitle" TEXT,
    "section" TEXT NOT NULL,
    "subsection" TEXT,
    "sectionTitle" TEXT NOT NULL,
    "fullCitation" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentWithContext" TEXT NOT NULL,
    "searchText" tsvector,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RtaChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RtaChunk_category_idx" ON "RtaChunk"("category");

-- CreateIndex
CREATE INDEX "Preset_userId_idx" ON "Preset"("userId");

-- AddForeignKey
ALTER TABLE "Preset" ADD CONSTRAINT "Preset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
