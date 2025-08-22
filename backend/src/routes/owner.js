// routes/owner.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth"); // JWT middleware

// Owner’s stores + ratings
router.get("/stores", auth("OWNER"), async (req, res) => {
  try {
    const ownerId = req.user.id;

    const result = await pool.query(
      `SELECT 
          s.id AS store_id,
          s.name AS store_name,
          ROUND(AVG(r.rating), 2) AS avg_rating,
          COALESCE(
            json_agg(
              json_build_object(
                'user_name', u.name,
                'user_email', u.email,
                'rating', r.rating
              )
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'
          ) AS user_ratings
        FROM app.stores s
        LEFT JOIN app.ratings r ON s.id = r.store_id
        LEFT JOIN app.users u ON r.user_id = u.id
        WHERE s.owner_id = $1
        GROUP BY s.id, s.name`,
      [ownerId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch owner stores" });
  }
});

module.exports = router;
    