const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { verifyToken } = require('./auth');

/**
 * GET /api/user/profile
 */
router.get('/profile', verifyToken, async (req, res) => {
  const { userId } = req.query;

  if (!userId || userId !== req.user.uid) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, email, phone, balance, currency, role, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      uid: user.id,
      email: user.email,
      balance: Number(user.balance),
      currency: user.currency,
      role: user.role,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
