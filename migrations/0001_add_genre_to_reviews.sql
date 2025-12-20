-- Add an optional genre column to the normalized `reviews` table.
-- NOTE: DO NOT RUN ON PRODUCTION WITHOUT BACKUP AND STAGING TESTS.

BEGIN;

-- Add the column (nullable to be safe)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS genre TEXT;

-- Backfill reviews.genre from archived_reviews JSON (by matching id)
-- This will copy the textual genre value found in archived_reviews.review_json->>'genre'
-- into the normalized `reviews.genre` for rows that have a matching archived snapshot.
-- Only run after you've verified backups and tested in staging.

UPDATE reviews
SET genre = ar.review_json->>'genre'
FROM archived_reviews ar
WHERE reviews.id = ar.id
  AND ar.review_json ? 'genre'
  AND (reviews.genre IS NULL OR reviews.genre = '');

COMMIT;
