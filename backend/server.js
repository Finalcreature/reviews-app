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

// GET /api/reviews - Fetch all reviews
app.get("/api/reviews", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM reviews ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
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
      raw_text, // <-- Accept raw_text from frontend
    } = req.body;

    // Basic validation
    if (!title || !game_name || !review_text || rating === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const reviewId = uuidv4();

    const newReview = {
      id: reviewId,
      title,
      game_name,
      review_text,
      rating,
      positive_points: positive_points || [],
      negative_points: negative_points || [],
      tags: tags || [],
    };

    // Insert into reviews table
    const reviewQuery = `
      INSERT INTO reviews (id, title, game_name, review_text, rating, positive_points, negative_points, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const reviewValues = [
      newReview.id,
      newReview.title,
      newReview.game_name,
      newReview.review_text,
      newReview.rating,
      newReview.positive_points,
      newReview.negative_points,
      newReview.tags,
    ];

    const reviewResult = await pool.query(reviewQuery, reviewValues);

    // Insert into raw_reviews table if raw_text is provided
    if (raw_text) {
      const rawQuery = `
        INSERT INTO raw_reviews (id, raw_text, parsed_json)
        VALUES ($1, $2, $3)
      `;
      await pool.query(rawQuery, [
        reviewId,
        raw_text,
        JSON.stringify(newReview),
      ]);
    }

    res.status(201).json(reviewResult.rows[0]);
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
    const result = await pool.query("SELECT * FROM raw_reviews");
    const fileName = "raw-reviews.json";
    const jsonString = JSON.stringify(result.rows, null, 2);

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
