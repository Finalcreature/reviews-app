# Manage temporary reviews for IGDB

## Migrations: categories & genres (normalized model)

This repo includes migrations to introduce normalized `categories` and `genres` tables and to add a `genre_id` FK to `reviews`.

Files:

- `migrations/0002_create_categories_and_genres.sql` — creates `categories` and `genres` tables.
- `migrations/0003_add_genre_id_to_reviews.sql` — adds nullable `reviews.genre_id` foreign key.
- `migrations/0004_backfill_genres_from_existing_values.sql` — inserts genres from `reviews.genre` and `archived_reviews` JSON and maps `reviews` rows.

Run verification steps before making `genre_id` non-null or dropping the legacy `reviews.genre` column:

1. Back up your DB.
2. Run `0002` and `0003` in staging.
3. Run `0004` and spot-check several rows to ensure `genre_id` has been populated correctly.
4. Deploy backend and frontend that read `genre_id` joins (this branch) and verify UI.
5. When confident, add a migration to make `genre_id` NOT NULL and drop `reviews.genre`.

If you need help generating a rollback or running these safely in CI, open an issue.

## Running tests

- Backend tests (Jest + Supertest):

  - From repo root: npm -C backend test
  - These tests exercise the DB-backed endpoints and require a DATABASE_URL pointing to a test DB.

- Frontend tests (Vitest + Testing Library):
  - From repo root: npm test
  - Ensure you've installed dev dependencies (`npm install`) and vitest is available. The vitest config runs only component tests in `components/__tests__`.

Note: If you see tests from `backend/__tests__` run under vitest or vice-versa, run the specific test runner per folder as above.
