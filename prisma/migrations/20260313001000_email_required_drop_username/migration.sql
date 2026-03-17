-- Backfill any legacy users that were created while email was optional.
UPDATE "User"
SET "email" = CONCAT(
  COALESCE(NULLIF("username", ''), CONCAT('user_', SUBSTRING("id", 1, 8))),
  '@pending.local'
)
WHERE "email" IS NULL;

-- Make email required again.
ALTER TABLE "User"
ALTER COLUMN "email" SET NOT NULL;

-- Remove username-first auth artifacts.
DROP INDEX IF EXISTS "User_username_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "username";
