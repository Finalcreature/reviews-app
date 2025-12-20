const request = require("supertest");
const app = require("../server");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe("POST /api/archived-reviews/:id/materialize", () => {
  let archivedId, gameId, reviewId;
  beforeAll(async () => {
    archivedId = uuidv4();
    // Insert archived review row
    const archivedJson = {
      title: "Archived Title",
      game_name: "archived-game",
      review_text: "x",
      rating: 8,
      tags: [],
      positive_points: [],
      negative_points: [],
    };
    await pool.query(
      "INSERT INTO archived_reviews (id, review_json, created_at) VALUES ($1, $2, NOW())",
      [archivedId, archivedJson]
    );

    // Also insert an existing game and review to test update path
    gameId = uuidv4();
    reviewId = uuidv4();
    await pool.query("INSERT INTO games (id, game_name) VALUES ($1, $2)", [
      gameId,
      "existing-game",
    ]);
    await pool.query(
      "INSERT INTO reviews (id, game_id, title, review_text, rating, tags, positive_points, negative_points) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [reviewId, gameId, "t", "r", 5, [], [], []]
    );
  });

  afterAll(async () => {
    await pool.query("DELETE FROM archived_reviews WHERE id = $1", [
      archivedId,
    ]);
    await pool.query("DELETE FROM reviews WHERE id IN ($1, $2)", [
      reviewId,
      archivedId,
    ]);
    await pool.query("DELETE FROM games WHERE id = $1", [gameId]);
    await pool.query("DELETE FROM genres WHERE name LIKE 'test-%'");
    await pool.query("DELETE FROM categories WHERE name LIKE 'test-%'");
    await pool.end();
  });

  test("updates existing review for the game when present", async () => {
    // Insert an archived review that refers to existing-game to trigger update
    const arch2 = uuidv4();
    const archivedJson = {
      title: "T2",
      game_name: "existing-game",
      review_text: "y",
      rating: 9,
    };
    await pool.query(
      "INSERT INTO archived_reviews (id, review_json, created_at) VALUES ($1, $2, NOW())",
      [arch2, archivedJson]
    );

    const res = await request(app)
      .post(`/api/archived-reviews/${arch2}/materialize`)
      .send({ genreName: "test-genre", categoryName: "test-cat" });
    expect(res.statusCode).toBe(200);
    expect(res.body.materialized).toBe("updated");
    expect(res.body.review).toHaveProperty("id", reviewId);
    // archived review should retain game_name and have genre/category set
    const arRow = await pool.query(
      "SELECT review_json->>'game_name' AS game_name, review_json->>'genre' AS genre, review_json->>'categoryName' AS categoryName FROM archived_reviews WHERE id = $1",
      [arch2]
    );
    expect(arRow.rows[0].game_name).toBe("existing-game");
    expect(arRow.rows[0].genre).toBe("test-genre");
    expect(arRow.rows[0].categoryname).toBe("test-cat");
    // ensure no duplicate reviews for the game
    const count = await pool.query("SELECT COUNT(*) FROM reviews WHERE game_id = $1", [gameId]);
    expect(parseInt(count.rows[0].count, 10)).toBe(1);
    // Clean up
    await pool.query("DELETE FROM archived_reviews WHERE id = $1", [arch2]);
  });

  test("creates new review with archived id when no existing review", async () => {
    const arch3 = uuidv4();
    const archivedJson = {
      title: "T3",
      game_name: "new-game-" + Date.now(),
      review_text: "z",
      rating: 7,
    };
    await pool.query(
      "INSERT INTO archived_reviews (id, review_json, created_at) VALUES ($1, $2, NOW())",
      [arch3, archivedJson]
    );

    const res = await request(app)
      .post(`/api/archived-reviews/${arch3}/materialize`)
      .send({ genreName: "test-genre2" });
    expect(res.statusCode).toBe(200);
    expect(res.body.materialized).toBe("created");
    expect(res.body.review).toHaveProperty("id", arch3);

    const arRow = await pool.query(
      "SELECT review_json->>'game_name' AS game_name, review_json->>'genre' AS genre FROM archived_reviews WHERE id = $1",
      [arch3]
    );
    expect(arRow.rows[0].game_name).toBe(archivedJson.game_name);
    expect(arRow.rows[0].genre).toBe("test-genre2");

    // cleanup created review and associated game
    await pool.query("DELETE FROM reviews WHERE id = $1", [arch3]);
    await pool.query("DELETE FROM games WHERE game_name = $1", [
      archivedJson.game_name,
    ]);
  });
});
