const request = require("supertest");
const app = require("../server");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe("Categories API", () => {
  test("POST /api/categories creates or returns a category", async () => {
    const name = `test-cat-${Date.now()}`;
    const res = await request(app).post("/api/categories").send({ name });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe(name);

    const get = await request(app).get("/api/categories");
    expect(get.statusCode).toBe(200);
    expect(get.body.some((c) => c.name === name)).toBe(true);

    // cleanup
    await pool.query("DELETE FROM categories WHERE name = $1", [name]);
  });
});
