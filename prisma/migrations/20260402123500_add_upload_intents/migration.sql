DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UploadIntentStatus') THEN
        CREATE TYPE "UploadIntentStatus" AS ENUM ('RESERVED', 'CONSUMED', 'EXPIRED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UploadIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreementId" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" "UploadIntentStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "cleanedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadIntent_agreementId_key" ON "UploadIntent"("agreementId");
CREATE UNIQUE INDEX IF NOT EXISTS "UploadIntent_s3Key_key" ON "UploadIntent"("s3Key");
CREATE INDEX IF NOT EXISTS "UploadIntent_userId_createdAt_idx" ON "UploadIntent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UploadIntent_userId_status_createdAt_idx" ON "UploadIntent"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "UploadIntent_status_expiresAt_idx" ON "UploadIntent"("status", "expiresAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'UploadIntent_userId_fkey'
          AND table_name = 'UploadIntent'
    ) THEN
        ALTER TABLE "UploadIntent"
        ADD CONSTRAINT "UploadIntent_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'UploadIntent_agreementId_fkey'
          AND table_name = 'UploadIntent'
    ) THEN
        ALTER TABLE "UploadIntent"
        ADD CONSTRAINT "UploadIntent_agreementId_fkey"
        FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
