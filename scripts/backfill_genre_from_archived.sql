-- Backfill script: copy genre values from archived_reviews.review_json into reviews.genre
-- DO NOT RUN AUTOMATICALLY. Run on staging first and verify.

BEGIN;

UPDATE reviews
SET genre = (ar.review_json->>'genre')
FROM archived_reviews ar
WHERE reviews.id = ar.id
  AND ar.review_json ? 'genre'
  AND (reviews.genre IS NULL OR reviews.genre = '');

-- Optionally verify a sample
-- SELECT r.id, r.genre, ar.review_json->>'genre' as archived_genre
-- FROM reviews r JOIN archived_reviews ar ON r.id = ar.id
-- WHERE ar.review_json ? 'genre' AND r.genre IS NOT NULL LIMIT 20;

COMMIT;
