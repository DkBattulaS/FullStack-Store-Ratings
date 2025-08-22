require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./config/db');
const authenticate = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Test DB connection
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ server_time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).send('DB connection error');
  }
});

// Mount auth routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// --- User & Store routes ---
// Normal User: view all stores with user rating
app.get('/stores', authenticate('USER'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.address,
              ROUND(AVG(r.rating),2) AS avg_rating,
              COUNT(r.id) AS total_ratings,
              (SELECT rating FROM app.ratings 
               WHERE user_id = $1 AND store_id = s.id) AS user_rating
       FROM app.stores s
       LEFT JOIN app.ratings r ON r.store_id = s.id
       GROUP BY s.id
       ORDER BY s.name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Normal User: search stores
app.get('/stores/search', authenticate('USER'), async (req, res) => {
  const { q } = req.query;
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.address,
              ROUND(AVG(r.rating),2) AS avg_rating,
              COUNT(r.id) AS total_ratings,
              (SELECT rating FROM app.ratings 
               WHERE user_id = $1 AND store_id = s.id) AS user_rating
       FROM app.stores s
       LEFT JOIN app.ratings r ON r.store_id = s.id
       WHERE s.name ILIKE '%' || $2 || '%' OR s.address ILIKE '%' || $2 || '%'
       GROUP BY s.id
       ORDER BY s.name`,
      [req.user.id, q]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Normal User: submit/update rating
app.post('/stores/:id/rate', authenticate('USER'), async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

  try {
    const result = await pool.query(
      `INSERT INTO app.ratings (user_id, store_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, store_id)
       DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
       RETURNING *`,
      [req.user.id, id, rating]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Normal User: update password
app.put('/user/password', authenticate('USER'), async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const userResult = await pool.query(`SELECT * FROM app.users WHERE id = $1`, [req.user.id]);
    const user = userResult.rows[0];
    const validPass = await bcrypt.compare(oldPassword, user.password);
    if (!validPass) return res.status(400).json({ error: 'Old password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE app.users SET password = $1, updated_at = NOW() WHERE id = $2`, [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password update failed' });
  }
});

// Store Owner: see their store ratings
app.get('/owner/stores', authenticate('OWNER'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id AS store_id, s.name AS store_name,
              u.id AS user_id, u.name AS user_name, u.email AS user_email,
              r.rating, r.created_at,
              ROUND(AVG(r.rating) OVER (PARTITION BY s.id), 2) AS avg_rating
       FROM app.stores s
       LEFT JOIN app.ratings r ON r.store_id = s.id
       LEFT JOIN app.users u ON u.id = r.user_id
       WHERE s.owner_id = $1
       ORDER BY s.id, r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch owner store ratings' });
  }
});

// --- Admin routes ---
// Admin: dashboard stats
app.get('/admin/dashboard', authenticate('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM app.users) AS total_users,
        (SELECT COUNT(*) FROM app.stores) AS total_stores,
        (SELECT COUNT(*) FROM app.ratings) AS total_ratings
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Admin: list users with optional filter (also used for owners)
app.get('/admin/users', authenticate('ADMIN'), async (req, res) => {
  const { name = '', email = '', address = '', role = '' } = req.query;
  try {
    let query = `
      SELECT id, name, email, address, role, created_at
      FROM app.users
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (name) { query += ` AND name ILIKE '%' || $${idx} || '%'`; params.push(name); idx++; }
    if (email) { query += ` AND email ILIKE '%' || $${idx} || '%'`; params.push(email); idx++; }
    if (address) { query += ` AND address ILIKE '%' || $${idx} || '%'`; params.push(address); idx++; }
    if (role) { query += ` AND role = $${idx}::app.user_role`; params.push(role); idx++; }

    query += ` ORDER BY name ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch users DB error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: add new user
app.post('/admin/users', authenticate('ADMIN'), async (req, res) => {
  console.log("Add user payload:", req.body);
  const { name, email, address, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: "Missing required fields" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO app.users (name, email, address, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role`,
      [name, email, address, hashedPassword, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add user DB error:", err);
    res.status(500).json({ error: "Failed to add user" });
  }
});

// Admin: add new store
// Admin: add new store
app.post('/admin/stores', authenticate('ADMIN'), async (req, res) => {
  const { name, email, address, owner_id } = req.body;
  if (!name || !email || !address || !owner_id) 
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const result = await pool.query(
      `INSERT INTO app.stores (name, email, address, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, address, owner_id`,
      [name, email, address, owner_id] // <-- include email
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add store DB error:", err);
    res.status(500).json({ error: "Failed to add store" });
  }
});


// Admin: list stores with ratings
app.get('/admin/stores', authenticate('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.address,
              u.name AS owner_name, u.email AS owner_email,
              ROUND(AVG(r.rating),2) AS avg_rating,
              COUNT(r.id) AS total_ratings
       FROM app.stores s
       JOIN app.users u ON s.owner_id = u.id
       LEFT JOIN app.ratings r ON r.store_id = s.id
       GROUP BY s.id, u.name, u.email
       ORDER BY s.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
