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
        games.game_name,
        g.id AS genre_id, g.name AS genre, g.category_id AS genre_category_id,
        c.name AS category_name
      FROM reviews
      LEFT JOIN games ON reviews.game_id = games.id
      LEFT JOIN genres g ON reviews.genre_id = g.id
      LEFT JOIN categories c ON g.category_id = c.id
      ORDER BY reviews.created_at DESC`
    );

    // Keep returning the same shape frontend expects; include genre/category fields
    const rows = result.rows.map((r) => ({
      ...r,
      genre: r.genre || r.genre, // prefer joined genre name when present
      genreId: r.genre_id || null,
      categoryName: r.category_name || null,
    }));
    res.json(rows);
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
  (review_json->>'rating')::numeric::int AS rating,
  COUNT(*) AS count,
  json_agg(json_build_object(
    'id', id,
    'title', review_json->>'title',
    'game_name', review_json->>'game_name',
    'rating', (review_json->>'rating')::numeric::int
  )) AS reviews
FROM archived_reviews
WHERE review_json ? 'rating'
  AND review_json->>'rating' IS NOT NULL
GROUP BY (review_json->>'rating')::numeric::int
ORDER BY rating DESC;`
    );

    // Ensure we always return an array of groups
    res.json(result.rows || []);
  } catch (err) {
    console.error("Error fetching reviews by rating:", err);
    res.status(500).json({ error: "Failed to fetch reviews by rating" });
  }
});

app.get("/api/games-summary", async (req, res) => {
  const { visibility } = req.query;

  let query;
  if (visibility === "visible") {
    query = `
      SELECT 
        games.game_name, 
        (archived_reviews.review_json->>'rating')::numeric AS rating,
        (archived_reviews.review_json->>'genre') AS genre,
        (archived_reviews.review_json->>'tags') AS tags,
        true AS visible
      FROM games
      JOIN reviews ON games.id = reviews.game_id
      JOIN archived_reviews ON reviews.id = archived_reviews.id;
    `;
  } else if (visibility === "hidden") {
    query = `
      SELECT 
        (review_json->>'game_name') AS game_name, 
        (review_json->>'rating')::numeric AS rating,
        (review_json->>'genre') AS genre,
        (review_json->>'tags') AS tags,
        false AS visible
      FROM archived_reviews
      WHERE id NOT IN (SELECT id FROM reviews);
    `;
  } else {
    query = `
      SELECT 
        (ar.review_json->>'game_name') AS game_name, 
        (ar.review_json->>'rating')::numeric AS rating,
        (ar.review_json->>'genre') AS genre,
        (ar.review_json->>'tags') AS tags,
        CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS visible
      FROM archived_reviews ar
      LEFT JOIN reviews r ON ar.id = r.id;
    `;
  }

  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching game summaries:", err);
    res.status(500).json({ error: "Failed to fetch game summaries" });
  }
});

// GET /api/genres - return a deduped list of genres (from reviews.genre and archived_reviews JSON)
app.get("/api/genres", async (req, res) => {
  try {
    // Return normalized genre rows, including category metadata
    const query = `
      SELECT g.id, g.name, g.category_id AS "categoryId", c.name AS "categoryName"
      FROM genres g
      LEFT JOIN categories c ON c.id = g.category_id
      ORDER BY lower(g.name)
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching genres:", err);
    res.status(500).json({ error: "Failed to fetch genres" });
  }
});

// GET /api/categories
app.get("/api/categories", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM categories ORDER BY lower(name)`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/categories
app.post("/api/categories", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || String(name).trim() === "") {
      return res.status(400).json({ error: "Category name required" });
    }

    const result = await pool.query(
      `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id, name`,
      [name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// POST /api/genres
app.post("/api/genres", async (req, res) => {
  try {
    const { name, categoryId, categoryName } = req.body;
    if (!name || String(name).trim() === "") {
      return res.status(400).json({ error: "Genre name required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let finalCategoryId = categoryId || null;
      if (!finalCategoryId && categoryName) {
        const r = await client.query(
          `INSERT INTO categories (name) VALUES($1) ON CONFLICT (lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id, name`,
          [categoryName]
        );
        finalCategoryId = r.rows[0].id;
      }

      const r2 = await client.query(
        `INSERT INTO genres (name, category_id) VALUES ($1, $2) ON CONFLICT (lower(name)) DO UPDATE SET category_id = COALESCE(EXCLUDED.category_id, genres.category_id) RETURNING id, name, category_id`,
        [name, finalCategoryId]
      );

      await client.query("COMMIT");
      const created = r2.rows[0];
      // attach categoryName
      if (created.category_id) {
        const c = await pool.query(
          `SELECT id, name FROM categories WHERE id = $1`,
          [created.category_id]
        );
        created.categoryName = c.rows[0].name;
      }
      res.status(201).json(created);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error creating genre:", err);
    res.status(500).json({ error: "Failed to create genre" });
  }
});

// PATCH /api/reviews/:id/genre - transactional update allowing names or ids
app.patch("/api/reviews/:id/genre", async (req, res) => {
  const { id } = req.params;
  const { genreId, genreName, categoryId, categoryName } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure category exists if name provided
    let finalCategoryId = categoryId || null;
    if (!finalCategoryId && categoryName) {
      const r = await client.query(
        `INSERT INTO categories (name) VALUES($1) ON CONFLICT (lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id, name`,
        [categoryName]
      );
      finalCategoryId = r.rows[0].id;
    }

    // Ensure genre exists (create if needed)
    let finalGenreId = genreId || null;
    if (!finalGenreId && genreName) {
      const r2 = await client.query(
        `INSERT INTO genres (name, category_id) VALUES ($1, $2) ON CONFLICT (lower(name)) DO UPDATE SET category_id = COALESCE(EXCLUDED.category_id, genres.category_id) RETURNING id`,
        [genreName, finalCategoryId]
      );
      finalGenreId = r2.rows[0].id;
    }

    if (!finalGenreId) {
      return res.status(400).json({ error: "genreId or genreName required" });
    }

    const upd = await client.query(
      `UPDATE reviews SET genre_id = $1 WHERE id = $2 RETURNING *`,
      [finalGenreId, id]
    );

    if (upd.rows.length === 0) {
      // Check if it exists in archived_reviews (archived-only)
      const archRes = await client.query(
        "SELECT id FROM archived_reviews WHERE id = $1",
        [id]
      );

      if (archRes.rowCount > 0) {
        // Update archived_reviews JSON directly without materializing
        const gRes = await client.query(
          `SELECT g.name, g.category_id, c.name as category_name FROM genres g LEFT JOIN categories c ON g.category_id = c.id WHERE g.id = $1`,
          [finalGenreId]
        );
        const {
          name: gName,
          category_id: cId,
          category_name: cName,
        } = gRes.rows[0];

        const patch = { genre: gName };
        if (cName) patch.categoryName = cName;

        await client.query(
          "UPDATE archived_reviews SET review_json = COALESCE(review_json, '{}'::jsonb) || $1::jsonb WHERE id = $2",
          [patch, id]
        );

        await client.query("COMMIT");
        return res.json({
          review: { id, genre: gName },
          genre: {
            id: finalGenreId,
            name: gName,
            categoryId: cId,
            categoryName: cName,
          },
        });
      }

      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Review not found" });
    }

    await client.query("COMMIT");

    // Return the updated review plus resolved genre/category
    const g = await pool.query(
      `SELECT g.id, g.name, g.category_id, c.name AS category_name FROM genres g LEFT JOIN categories c ON c.id = g.category_id WHERE g.id = $1`,
      [finalGenreId]
    );

    res.json({ review: upd.rows[0], genre: g.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating review genre (transaction):", err);
    res.status(500).json({ error: "Failed to update review genre" });
  } finally {
    client.release();
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
        // Reuse existing game when present (don't treat as an error when creating a review)
        gameId = gameResult.rows[0].id;
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

// Note: simple genre PATCH handler removed to ensure transactional handler is used.

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

// GET /api/reviews/by-category - aggregate archived reviews by category and genres
app.get("/api/reviews/by-category", async (req, res) => {
  try {
    // Prepare a common table of archived reviews with parsed rating and game_name
    const baseAr = `
  SELECT
    id,
    review_json,
    (review_json->>'rating')::numeric AS rating,
    (review_json->>'game_name') AS game_name,
    (review_json->>'genre') AS genre_name
  FROM archived_reviews
  WHERE review_json ? 'rating'
    AND review_json->>'rating' IS NOT NULL
`;

    // Category-level aggregation
    const catQuery = `
      WITH ar AS (${baseAr})
      SELECT c.id AS category_id, c.name AS category_name,
        COUNT(*)::int AS review_count,
        AVG(ar.rating)::numeric(10,2) AS avg_rating,
        (array_agg(DISTINCT ar.game_name))[1] AS sample_game_name
      FROM ar
      LEFT JOIN genres g ON g.name = ar.genre_name
      LEFT JOIN categories c ON c.id = g.category_id
      WHERE c.id IS NOT NULL
      GROUP BY c.id, c.name
      ORDER BY review_count DESC
    `;

    // Genre-level aggregation (will be nested into categories)
    const genreQuery = `
      WITH ar AS (${baseAr})
      SELECT g.id AS genre_id, g.name AS genre_name, g.category_id,
        COUNT(*)::int AS review_count,
        AVG(ar.rating)::numeric(10,2) AS avg_rating,
        (array_agg(DISTINCT ar.game_name))[1] AS sample_game_name
      FROM ar
      LEFT JOIN genres g ON g.name = ar.genre_name
      GROUP BY g.id, g.name, g.category_id
      ORDER BY review_count DESC
    `;

    const catRes = await pool.query(catQuery);
    const genreRes = await pool.query(genreQuery);

    // Map genres into their parent categories
    const categories = catRes.rows.map((r) => ({
      category_id: r.category_id,
      category_name: r.category_name,
      review_count: parseInt(r.review_count, 10) || 0,
      avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : null,
      sample_game_name: r.sample_game_name || null,
      genres: [],
    }));

    const genresByCategory = {};
    for (const g of genreRes.rows) {
      const genre = {
        genre_id: g.genre_id,
        genre_name: g.genre_name,
        review_count: parseInt(g.review_count, 10) || 0,
        avg_rating: g.avg_rating !== null ? Number(g.avg_rating) : null,
        sample_game_name: g.sample_game_name || null,
      };
      const catId = g.category_id;
      if (catId) {
        genresByCategory[catId] = genresByCategory[catId] || [];
        genresByCategory[catId].push(genre);
      }
    }

    // Attach genres arrays
    for (const c of categories) {
      c.genres = genresByCategory[c.category_id] || [];
    }

    res.json(categories);
  } catch (err) {
    console.error("Error fetching reviews by category:", err);
    res.status(500).json({ error: "Failed to fetch reviews by category" });
  }
});

// server.js (or your Express routes)
app.put("/api/archived-reviews/:id", async (req, res) => {
  const { id } = req.params;
  const updatedReview = req.body; // expecting an object matching stored review_json

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Merge incoming JSON into existing archived JSON (preserve fields not provided by client)
    await client.query(
      "UPDATE archived_reviews SET review_json = COALESCE(review_json, '{}'::jsonb) || $1::jsonb WHERE id = $2",
      [updatedReview, id]
    );

    // Read back the merged archived JSON so we operate on the persisted state
    const mergedRes = await client.query(
      "SELECT review_json FROM archived_reviews WHERE id = $1",
      [id]
    );
    if (mergedRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Archived review not found" });
    }
    const mergedJson = mergedRes.rows[0].review_json;

    // If a corresponding row exists in `reviews`, update the normalized fields.
    const reviewRes = await client.query(
      "SELECT * FROM reviews WHERE id = $1",
      [id]
    );
    if (reviewRes.rowCount > 0) {
      // Use fields from the merged archived JSON so changes persisted to archived_reviews
      // are reflected when normalizing the reviews table.
      const {
        title,
        review_text,
        rating,
        genre,
        positive_points,
        negative_points,
        tags,
        game_name,
      } = mergedJson;

      // Determine the correct game_id for the updated game_name.
      // Behavior:
      // - If a game with the target name exists, use that game's id.
      // - Else if the review currently references a game that has no other
      //   reviews, update that existing game's name (avoid creating a new row).
      // - Otherwise create a new game row and assign it.
      let gameId = null;
      if (game_name) {
        // Check for an existing game with this exact name first
        const existingGame = await client.query(
          "SELECT id FROM games WHERE game_name = $1 LIMIT 1",
          [game_name]
        );
        if (existingGame.rowCount > 0) {
          gameId = existingGame.rows[0].id;
        } else {
          // No game with that name exists. See whether the current review's
          // game can be renamed safely (no other reviews reference it).
          const oldGameId = reviewRes.rows[0].game_id;
          if (oldGameId) {
            const refs = await client.query(
              "SELECT COUNT(*)::int AS cnt FROM reviews WHERE game_id = $1",
              [oldGameId]
            );
            const refCount = parseInt(refs.rows[0].cnt, 10) || 0;
            if (refCount === 1) {
              // Safe to rename the existing game row in-place
              await client.query(
                "UPDATE games SET game_name = $1 WHERE id = $2",
                [game_name, oldGameId]
              );
              gameId = oldGameId;
            } else {
              // Multiple reviews reference the old game, so create a new game
              gameId = uuidv4();
              await client.query(
                "INSERT INTO games (id, game_name) VALUES ($1, $2)",
                [gameId, game_name]
              );
            }
          } else {
            // review had no game_id, create a new game
            gameId = uuidv4();
            await client.query(
              "INSERT INTO games (id, game_name) VALUES ($1, $2)",
              [gameId, game_name]
            );
          }
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
      `Updated archived review ${id} (genre: ${mergedJson.genre || "n/a"})`
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

// POST /api/archived-reviews/:id/materialize
app.post("/api/archived-reviews/:id/materialize", async (req, res) => {
  const archivedId = req.params.id;
  const { genreId, genreName, categoryId, categoryName } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ar = await client.query(
      "SELECT review_json FROM archived_reviews WHERE id = $1",
      [archivedId]
    );
    if (ar.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Archived review not found" });
    }
    const reviewJson = ar.rows[0].review_json;

    // ensure game exists (reuse if present)
    const gameName = (reviewJson.game_name || "").trim();
    let gameId = null;
    if (gameName) {
      const g = await client.query(
        "SELECT id FROM games WHERE game_name = $1 LIMIT 1",
        [gameName]
      );
      if (g.rowCount > 0) gameId = g.rows[0].id;
      else {
        const created = await client.query(
          "INSERT INTO games (id, game_name) VALUES ($1, $2) RETURNING id",
          [uuidv4(), gameName]
        );
        gameId = created.rows[0].id;
      }
    }

    // ensure category
    let finalCategoryId = categoryId || null;
    if (!finalCategoryId && categoryName) {
      const c = await client.query(
        `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [categoryName]
      );
      finalCategoryId = c.rows[0].id;
    }

    // ensure genre
    let finalGenreId = genreId || null;
    if (!finalGenreId && genreName) {
      const g = await client.query(
        `INSERT INTO genres (name, category_id) VALUES ($1, $2) ON CONFLICT (lower(name)) DO UPDATE SET category_id = COALESCE(EXCLUDED.category_id, genres.category_id) RETURNING id`,
        [genreName, finalCategoryId]
      );
      finalGenreId = g.rows[0].id;
    }

    const title = reviewJson.title || null;
    const review_text = reviewJson.review_text || null;
    const rating = reviewJson.rating !== undefined ? reviewJson.rating : null;
    const positive_points = reviewJson.positive_points || [];
    const negative_points = reviewJson.negative_points || [];
    const tags = reviewJson.tags || [];

    // find existing review for this game
    let existing = null;
    if (gameId) {
      const r = await client.query(
        "SELECT id FROM reviews WHERE game_id = $1 LIMIT 1",
        [gameId]
      );
      if (r.rowCount > 0) existing = r.rows[0];
    }

    if (existing && existing.id) {
      await client.query(
        `UPDATE reviews SET title = $1, review_text = $2, rating = $3, positive_points = $4, negative_points = $5, tags = $6, genre_id = $7, game_id = $8 WHERE id = $9`,
        [
          title,
          review_text,
          rating,
          positive_points,
          negative_points,
          tags,
          finalGenreId,
          gameId,
          existing.id,
        ]
      );
      const updated = await client.query(
        "SELECT * FROM reviews WHERE id = $1",
        [existing.id]
      );
      // Persist key metadata back into the archived review JSON to avoid losing game_name/genre/category
      try {
        if (gameName) {
          await client.query(
            "UPDATE archived_reviews SET review_json = jsonb_set(review_json, '{game_name}', to_jsonb($1::text), true) WHERE id = $2",
            [gameName, archivedId]
          );
        }
        if (finalGenreId) {
          const gm = await client.query(
            "SELECT g.name AS genre_name, c.name AS category_name FROM genres g LEFT JOIN categories c ON c.id = g.category_id WHERE g.id = $1",
            [finalGenreId]
          );
          const genreNameToSet = gm.rows[0]?.genre_name || null;
          const categoryNameToSet = gm.rows[0]?.category_name || null;
          if (genreNameToSet) {
            await client.query(
              "UPDATE archived_reviews SET review_json = jsonb_set(review_json, '{genre}', to_jsonb($1::text), true) WHERE id = $2",
              [genreNameToSet, archivedId]
            );
          }
          if (categoryNameToSet) {
            await client.query(
              "UPDATE archived_reviews SET review_json = jsonb_set(review_json, '{categoryName}', to_jsonb($1::text), true) WHERE id = $2",
              [categoryNameToSet, archivedId]
            );
          }
        }
      } catch (e) {
        console.error("Failed to persist metadata to archived_reviews", e);
      }
      // attach resolved genre metadata if available
      let genreMeta = null;
      if (finalGenreId) {
        const g = await client.query(
          "SELECT g.id, g.name, g.category_id, c.name AS category_name FROM genres g LEFT JOIN categories c ON c.id = g.category_id WHERE g.id = $1",
          [finalGenreId]
        );
        genreMeta = g.rows[0];
      }
      await client.query("COMMIT");
      return res.json({
        review: updated.rows[0],
        genre: genreMeta,
        materialized: "updated",
      });
    }

    // Create new review using archived id to preserve mapping
    const newId = archivedId;
    const insert = await client.query(
      `INSERT INTO reviews (id, game_id, title, review_text, rating, positive_points, negative_points, tags, genre_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        newId,
        gameId,
        title,
        review_text,
        rating,
        positive_points,
        negative_points,
        tags,
        finalGenreId,
      ]
    );
    // Persist metadata back into archived review JSON
    try {
      if (gameName) {
        await client.query(
          "UPDATE archived_reviews SET review_json = jsonb_set(review_json, '{game_name}', to_jsonb($1::text), true) WHERE id = $2",
          [gameName, archivedId]
        );
      }
      if (finalGenreId) {
        const gm = await client.query(
          "SELECT g.name AS genre_name, c.name AS category_name FROM genres g LEFT JOIN categories c ON c.id = g.category_id WHERE g.id = $1",
          [finalGenreId]
        );
        const genreNameToSet = gm.rows[0]?.genre_name || null;
        const categoryNameToSet = gm.rows[0]?.category_name || null;
        if (genreNameToSet) {
          await client.query(
            "UPDATE archived_reviews SET review_json = jsonb_set(review_json, '{genre}', to_jsonb($1::text), true) WHERE id = $2",
            [genreNameToSet, archivedId]
          );
        }
        if (categoryNameToSet) {
          await client.query(
            "UPDATE archived_reviews SET review_json = jsonb_set(review_json, '{categoryName}', to_jsonb($1::text), true) WHERE id = $2",
            [categoryNameToSet, archivedId]
          );
        }
      }
    } catch (e) {
      console.error("Failed to persist metadata to archived_reviews", e);
    }
    // attach resolved genre metadata if available
    let genreMeta = null;
    if (finalGenreId) {
      const g = await client.query(
        "SELECT g.id, g.name, g.category_id, c.name AS category_name FROM genres g LEFT JOIN categories c ON c.id = g.category_id WHERE g.id = $1",
        [finalGenreId]
      );
      genreMeta = g.rows[0];
    }
    await client.query("COMMIT");
    return res.json({
      review: insert.rows[0],
      genre: genreMeta,
      materialized: "created",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Materialize failed:", err);
    res.status(500).json({ error: "Failed to materialize archived review" });
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
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
