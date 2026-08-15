-- Add the column as nullable first
ALTER TABLE "Staff" ADD COLUMN "username" TEXT;

-- Generate unique usernames for existing staff
-- Uses email prefix, or falls back to 'user_' + id if email is missing
UPDATE "Staff" 
SET "username" = LOWER(
    COALESCE(
        SPLIT_PART(email, '@', 1),
        CONCAT('user_', SUBSTRING(id::text, 1, 8))
    )
)
WHERE "username" IS NULL;

-- Ensure no duplicates (add a number suffix if needed)
UPDATE "Staff" s1
SET "username" = CONCAT(s1.username, '_', s1.id::text)
WHERE EXISTS (
    SELECT 1 FROM "Staff" s2 
    WHERE s2.username = s1.username 
    AND s2.id != s1.id
);

-- Make it required and unique
ALTER TABLE "Staff" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "Staff_username_key" ON "Staff" ("username");