-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT,
ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AgreementToChatSession" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_AgreementToChatSession_AB_unique" ON "_AgreementToChatSession"("A", "B");
CREATE INDEX IF NOT EXISTS "_AgreementToChatSession_B_index" ON "_AgreementToChatSession"("B");

-- Backfill existing one-to-many chat/agreement links into the join table.
INSERT INTO "_AgreementToChatSession" ("A", "B")
SELECT "agreementId", "id"
FROM "ChatSession"
WHERE "agreementId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Foreign keys for the new many-to-many join table.
ALTER TABLE "_AgreementToChatSession"
ADD CONSTRAINT "_AgreementToChatSession_A_fkey"
FOREIGN KEY ("A") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_AgreementToChatSession"
ADD CONSTRAINT "_AgreementToChatSession_B_fkey"
FOREIGN KEY ("B") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace the old single agreementId relation with the new join table relation.
ALTER TABLE "ChatSession" DROP CONSTRAINT IF EXISTS "ChatSession_agreementId_fkey";
DROP INDEX IF EXISTS "ChatSession_agreementId_idx";
ALTER TABLE "ChatSession" DROP COLUMN IF EXISTS "agreementId";

-- Add the composite index used by the restored main-branch chat/session queries.
CREATE INDEX IF NOT EXISTS "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");
