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
  // Sanity check: does `reviews.genre` column exist? (non-invasive)
  pool
    .query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='reviews' AND column_name='genre'"
    )
    .then((r) => {
      if (r.rows.length > 0) {
        console.log("DB Check: 'reviews.genre' column detected.");
      } else {
        console.log(
          "DB Check: 'reviews.genre' column not found (expected on older schemas)."
        );
      }
    })
    .catch((e) => {
      console.warn(
        "DB Check: could not determine if 'genre' column exists:",
        e.message
      );
    });
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

// Aggregated reviews by rating
app.get("/api/reviews/by-rating", async (req, res) => {
  try {
    // Use archived_reviews as the primary source for dashboard aggregation.
    // archived_reviews stores a complete JSONB snapshot of every submitted review
    // and is guaranteed to contain game_name and rating. This ensures the
    // dashboard shows results even when the normalized `reviews` table is
    // empty (e.g., imported/archived-only data).
    const result = await pool.query(
      `SELECT
         (review_json->>'rating')::int AS rating,
         COUNT(*) AS count,
         json_agg(json_build_object(
           'id', id,
           'title', review_json->>'title',
           'game_name', review_json->>'game_name',
           'rating', (review_json->>'rating')::int,
           'genre', review_json->>'genre'
         )) AS reviews
       FROM archived_reviews
       WHERE review_json ? 'rating' AND review_json->>'rating' IS NOT NULL
       GROUP BY (review_json->>'rating')::int
       ORDER BY rating DESC`
    );

    // Ensure we always return an array of groups
    res.json(result.rows || []);
  } catch (err) {
    console.error("Error fetching reviews by rating:", err);
    res.status(500).json({ error: "Failed to fetch reviews by rating" });
  }
});

app.get("/api/games-summary", async (req, res) => {
  const onlyVisible = req.query.visible === "true";

  const query = onlyVisible
    ? `
      SELECT 
        games.game_name, 
        (archived_reviews.review_json->>'rating')::numeric AS rating,
        (archived_reviews.review_json->>'genre') AS genre
      FROM games
      JOIN reviews ON games.id = reviews.game_id
      JOIN archived_reviews ON reviews.id = archived_reviews.id;
    `
    : `
      SELECT 
        (review_json->>'game_name') AS game_name, 
        (review_json->>'rating')::numeric AS rating,
        (review_json->>'genre') AS genre
      FROM archived_reviews;
    `;

  try {
    const result = await pool.query(query);
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
      genre,
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
      genre: genre || null,
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
        `INSERT INTO reviews (id, game_id, title, review_text, rating, positive_points, negative_points, tags, genre)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
          genre || null,
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
      console.log(
        `Created review ${reviewId} (game: ${game_name}, genre: ${
          genre || "n/a"
        })`
      );
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

// PATCH /api/reviews/:id/genre - Update the genre for a review
app.patch("/api/reviews/:id/genre", async (req, res) => {
  try {
    const { id } = req.params;
    const { genre } = req.body;

    // Accept null/undefined to clear genre
    const result = await pool.query(
      "UPDATE reviews SET genre = $1 WHERE id = $2 RETURNING *",
      [genre || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating review genre:", err);
    res.status(500).json({ error: "Failed to update genre" });
  }
});

app.patch("/api/archived-reviews/:id/tags", async (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;

  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: "Tags must be an array." });
  }

  try {
    const result = await pool.query(
      `UPDATE archived_reviews
       SET review_json = jsonb_set(review_json, '{tags}', to_jsonb($1::text[]))
       WHERE id = $2`,
      [tags, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Archived review not found." });
    }

    res.status(200).json({ message: "Tags updated successfully." });
  } catch (err) {
    console.error("Error updating archived tags:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/api/archived-reviews", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM archived_reviews");
    const reviews = result.rows.map((row) => row.review_json);

    res.status(200).json(reviews);
  } catch (err) {
    console.error("Error fetching archived reviews:", err);
    res.status(500).json({ error: "Failed to fetch archived reviews" });
  }
});

app.get("/api/archived-reviews/download", async (req, res) => {
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

// GET /api/archived-reviews/game/:gameName
app.get("/api/archived-reviews/game/:gameName", async (req, res) => {
  const { gameName } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, review_json
       FROM archived_reviews
       WHERE review_json->>'game_name' = $1
       LIMIT 1`, // Adjust as needed
      [gameName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Archived review not found" });
    }

    const row = result.rows[0];
    const review = {
      id: row.id,
      ...row.review_json,
    };

    res.json(review);
  } catch (err) {
    console.error("Error fetching archived review by game name:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// server.js (or your Express routes)
app.put("/api/archived-reviews/:id", async (req, res) => {
  const { id } = req.params;
  const updatedReview = req.body; // expecting an object matching stored review_json

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update archived JSON
    await client.query(
      "UPDATE archived_reviews SET review_json = $1 WHERE id = $2",
      [updatedReview, id]
    );

    // If a corresponding row exists in `reviews`, update the normalized fields.
    const reviewRes = await client.query(
      "SELECT * FROM reviews WHERE id = $1",
      [id]
    );
    if (reviewRes.rowCount > 0) {
      // Ensure required fields exist on the incoming JSON
      const {
        title,
        review_text,
        rating,
        genre,
        positive_points,
        negative_points,
        tags,
        game_name,
      } = updatedReview;

      // Find or create game for the new game_name
      let gameId = null;
      if (game_name) {
        const gameRow = await client.query(
          "SELECT id FROM games WHERE game_name = $1",
          [game_name]
        );
        if (gameRow.rowCount > 0) {
          gameId = gameRow.rows[0].id;
        } else {
          gameId = uuidv4();
          await client.query(
            "INSERT INTO games (id, game_name) VALUES ($1, $2)",
            [gameId, game_name]
          );
        }
      }

      // Update reviews table fields
      // Include genre as the final field in the UPDATE param list to minimize index changes
      if (gameId) {
        await client.query(
          `UPDATE reviews SET
             title = $1,
             review_text = $2,
             rating = $3,
             positive_points = $4,
             negative_points = $5,
             tags = $6,
             game_id = $7,
             genre = $8
           WHERE id = $9`,
          [
            title || null,
            review_text || null,
            rating !== undefined ? rating : null,
            positive_points || [],
            negative_points || [],
            tags || [],
            gameId,
            genre || null,
            id,
          ]
        );
      } else {
        await client.query(
          `UPDATE reviews SET
             title = $1,
             review_text = $2,
             rating = $3,
             positive_points = $4,
             negative_points = $5,
             tags = $6,
             genre = $7
           WHERE id = $8`,
          [
            title || null,
            review_text || null,
            rating !== undefined ? rating : null,
            positive_points || [],
            negative_points || [],
            tags || [],
            genre || null,
            id,
          ]
        );
      }
    }

    await client.query("COMMIT");
    console.log(
      `Updated archived review ${id} (genre: ${updatedReview.genre || "n/a"})`
    );
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating archived review", err);
    res.status(500).send("Failed to update review");
  } finally {
    client.release();
  }
});

// --- WIP Reviews CRUD ---
// Recommended SQL to create table:
// CREATE TABLE wip_reviews (
//   id UUID PRIMARY KEY,
//   game_name TEXT NOT NULL,
//   remarks TEXT,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );

app.get("/api/wip-reviews", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, game_name, remarks, created_at, updated_at FROM wip_reviews ORDER BY created_at DESC"
    );
    const rows = result.rows.map((r) => ({
      id: r.id,
      gameName: r.game_name,
      remarks: r.remarks,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json(rows);
  } catch (err) {
    console.error("Error fetching WIP reviews:", err);
    res.status(500).json({ error: "Failed to fetch WIP reviews" });
  }
});

app.post("/api/wip-reviews", async (req, res) => {
  try {
    const { gameName, remarks } = req.body;
    if (!gameName) return res.status(400).json({ error: "gameName required" });
    const id = uuidv4();
    const now = new Date();
    await pool.query(
      "INSERT INTO wip_reviews (id, game_name, remarks, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
      [id, gameName, remarks || "", now, now]
    );
    res.status(201).json({
      id,
      gameName,
      remarks: remarks || "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Error creating WIP review:", err);
    res.status(500).json({ error: "Failed to create WIP review" });
  }
});

app.put("/api/wip-reviews/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { gameName, remarks } = req.body;
    const now = new Date();
    const result = await pool.query(
      "UPDATE wip_reviews SET game_name = $1, remarks = $2, updated_at = $3 WHERE id = $4 RETURNING id, game_name, remarks, created_at, updated_at",
      [gameName, remarks || "", now, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "WIP review not found" });
    const r = result.rows[0];
    res.json({
      id: r.id,
      gameName: r.game_name,
      remarks: r.remarks,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (err) {
    console.error("Error updating WIP review:", err);
    res.status(500).json({ error: "Failed to update WIP review" });
  }
});

app.delete("/api/wip-reviews/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM wip_reviews WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "WIP review not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting WIP review:", err);
    res.status(500).json({ error: "Failed to delete WIP review" });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
