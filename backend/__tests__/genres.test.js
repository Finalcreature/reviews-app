const request = require("supertest");
const app = require("../server");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe("Genres API", () => {
  test("POST /api/genres creates genre with category when provided", async () => {
    const name = `test-genre-${Date.now()}`;
    const cat = `test-cat-${Date.now()}`;

    const res = await request(app)
      .post("/api/genres")
      .send({ name, categoryName: cat });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe(name);
    expect(res.body).toHaveProperty("category_id");

    // verify that category exists and categoryName returned
    expect(res.body.categoryName).toBeDefined();

    // cleanup
    await pool.query("DELETE FROM genres WHERE name = $1", [name]);
    await pool.query("DELETE FROM categories WHERE name = $1", [cat]);
  });
});
