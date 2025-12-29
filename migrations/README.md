# Genre Migration

This folder contains SQL scripts to add an optional `genre` column to the `reviews` table and to backfill values from the `archived_reviews.review_json` snapshots.

Steps (safe rollout):

1. Backup your production database before running anything.
2. Run the migration `migrations/0001_add_genre_to_reviews.sql` in staging first, then verify behavior.
3. If needed, run `scripts/backfill_genre_from_archived.sql` to copy genre values from archived JSON into `reviews.genre`.
4. Test application flows in staging (create review with `genre`, edit via archived modal, export) and run the QA checklist.
5. Once verified, run same steps in production during a maintenance window.

Notes:

- `genre` is intentionally nullable in this migration to allow phased rollout.
- After full backfill and verification you may add constraints or NOT NULL if desired.
- Always take a DB snapshot/backup before modifying production schema.
