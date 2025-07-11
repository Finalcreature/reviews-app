require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;

// --- Database Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Check database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  console.log("Successfully connected to PostgreSQL database!");
  client.release();
});

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing for all routes
app.use(express.json()); // Middleware to parse JSON request bodies

// --- API Routes ---
app.get("/api/reviews", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT reviews.*, 
        games.game_name FROM reviews 
        JOIN games ON reviews.game_id = games.id ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

app.get("/api/games-summary", async (req, res) => {
  try {
    const result = await pool.query(`
    SELECT 
    archived_reviews.review_json->>'game_name' AS game_name,
    (archived_reviews.review_json->>'rating')::numeric AS rating
    FROM archived_reviews
    ORDER BY created_at DESC; 
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching game summaries:", err);
    res.status(500).json({ error: "Failed to fetch game summaries" });
  }
});

// POST /api/reviews - Create a new review
app.post("/api/reviews", async (req, res) => {
  try {
    const {
      title,
      game_name,
      review_text,
      rating,
      positive_points,
      negative_points,
      tags,
    } = req.body;

    // The full original review data (used for archiving)
    const originalReviewJson = {
      title,
      game_name,
      review_text,
      rating,
      positive_points: positive_points || [],
      negative_points: negative_points || [],
      tags: tags || [],
    };

    if (!title || !game_name || !review_text || rating === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Try to find existing game
      const gameResult = await client.query(
        `SELECT * FROM games WHERE game_name = $1`,
        [game_name]
      );

      let gameId;
      if (gameResult.rows.length > 0) {
        return res.status(409).json({
          error: `Game "${game_name}" already exists.`,
        });
      } else {
        gameId = uuidv4();
        await client.query(
          `INSERT INTO games (id, game_name) VALUES ($1, $2)`,
          [gameId, game_name]
        );
      }

      // 2. Insert review
      const reviewId = uuidv4();
      const reviewInsert = await client.query(
        `INSERT INTO reviews (id, game_id, title, review_text, rating, positive_points, negative_points, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          reviewId,
          gameId,
          title,
          review_text,
          rating,
          positive_points || [],
          negative_points || [],
          tags || [],
        ]
      );

      await client.query(
        `INSERT INTO archived_reviews (id, review_json, created_at)
         VALUES ($1, $2, NOW())`,
        [reviewId, originalReviewJson]
      );

      await client.query("COMMIT");

      // 3. Include game_name in response
      const review = reviewInsert.rows[0];
      res.status(201).json({
        ...review,
        game_name, // manually inject it for frontend use
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Transaction failed:", err);
      res.status(500).json({ error: "Failed to create review" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error creating review:", err);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// DELETE /api/reviews/:id - Delete a review
app.delete("/api/reviews/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM reviews WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error deleting review:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// PATCH /api/reviews/:id/tags - Update tags for a review
app.patch("/api/reviews/:id/tags", async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: "Tags must be an array" });
    }
    const result = await pool.query(
      "UPDATE reviews SET tags = $1 WHERE id = $2 RETURNING *;",
      [tags, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating tags:", err);
    res.status(500).json({ error: "Failed to update tags" });
  }
});

app.get("/api/raw-reviews/download", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM archived_reviews");
    const reviewsToDownload = result.rows.map((row) => row.review_json);
    const fileName = "archived-reviews.json";
    const jsonString = JSON.stringify(reviewsToDownload, null, 2);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(jsonString);
  } catch (err) {
    console.error("Error fetching raw reviews for download:", err);
    res.status(500).json({ error: "Failed to generate download file" });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
