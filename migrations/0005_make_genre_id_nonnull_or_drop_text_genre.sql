-- Optional migration: make genre_id NOT NULL and remove legacy text column
-- Run only after thorough verification and backups

BEGIN;

-- Example checks/operations before applying strict changes
-- 1) Ensure there are no reviews with NULL genre_id if you intend to make it non-null
-- SELECT COUNT(*) FROM reviews WHERE genre_id IS NULL;

-- 2) If you are comfortable, make the column NOT NULL
-- ALTER TABLE reviews ALTER COLUMN genre_id SET NOT NULL;

-- 3) Optionally remove legacy text column
-- ALTER TABLE reviews DROP COLUMN IF EXISTS genre;

COMMIT;
