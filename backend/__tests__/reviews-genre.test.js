const request = require("supertest");
const app = require("../server");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe("PATCH /api/reviews/:id/genre", () => {
  let gameId, reviewId;
  beforeAll(async () => {
    gameId = uuidv4();
    reviewId = uuidv4();
    await pool.query("INSERT INTO games (id, game_name) VALUES ($1, $2)", [
      gameId,
      "test-game",
    ]);
    await pool.query(
      `INSERT INTO reviews (id, game_id, title, review_text, rating, tags, positive_points, negative_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [reviewId, gameId, "t", "r", 5, [], [], []]
    );
  });

  afterAll(async () => {
    await pool.query("DELETE FROM reviews WHERE id = $1", [reviewId]);
    await pool.query("DELETE FROM games WHERE id = $1", [gameId]);
    // Clean any categories/genres created by test name pattern
    await pool.query("DELETE FROM genres WHERE name LIKE 'test-%'");
    await pool.query("DELETE FROM categories WHERE name LIKE 'test-%'");
    await pool.end();
  });

  test("creates category+genre and assigns to review", async () => {
    const genreName = `test-genre-${Date.now()}`;
    const categoryName = `test-cat-${Date.now()}`;

    const res = await request(app)
      .patch(`/api/reviews/${reviewId}/genre`)
      .send({ genreName, categoryName });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("review");
    expect(res.body).toHaveProperty("genre");
    expect(res.body.genre.name).toBe(genreName);

    // verify the reviews table has genre_id set
    const r = await pool.query("SELECT genre_id FROM reviews WHERE id = $1", [
      reviewId,
    ]);
    expect(r.rows[0].genre_id).toBeDefined();
  });
});
