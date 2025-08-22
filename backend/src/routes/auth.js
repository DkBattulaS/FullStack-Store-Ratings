const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const router = express.Router();
const { transporter } = require('../../utils2/mailer');

// -------------------- SIGNUP --------------------
router.post('/signup', async (req, res) => {
  const { name, email, password, address } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO app.users (name, email, password, address, role)
       VALUES ($1, $2, $3, $4, 'USER') RETURNING id, name, email, role`,
      [name, email, hashedPassword, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// -------------------- FORGOT PASSWORD --------------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    // Check if user exists
    const result = await pool.query("SELECT * FROM app.users WHERE email=$1", [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Create a reset token (valid for 15 mins)
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "15m" });

    // Reset link (frontend should handle this route)
    const resetLink = `http://localhost:3000/reset-password/${token}`;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Password Reset",
      html: `<p>You requested a password reset.</p>
             <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
             <p>This link expires in 15 minutes.</p>`,
    });

    res.json({ msg: "Password reset link sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// -------------------- RESET PASSWORD --------------------
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update DB
    await pool.query("UPDATE app.users SET password=$1 WHERE email=$2", [
      hashedPassword,
      decoded.email,
    ]);

    res.json({ msg: "Password updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: "Invalid or expired token" });
  }
});

// -------------------- LOGIN --------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM app.users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ✅ Export router
module.exports = router;
