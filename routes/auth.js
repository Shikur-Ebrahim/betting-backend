const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { pool } = require('../db/pool');

const BCRYPT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET is not set. Set it in the environment for production.');
}

function signUserToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      phone: user.phone || null,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function phoneFromEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const m = email.match(/^(\d{10,15})@/i);
  return m ? m[1] : null;
}

/**
 * Middleware to verify JWT
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'Server auth not configured' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      uid: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      phoneNumber: decoded.phone,
    };
    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);
    res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
  }
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  try {
    const phone = phoneFromEmail(email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const insert = await pool.query(
      `INSERT INTO users (email, phone, password_hash, role, balance, currency, created_at, updated_at)
       VALUES ($1, $2, $3, 'user', 0, 'Birr', NOW(), NOW())
       RETURNING id, email, role, phone`,
      [email.toLowerCase().trim(), phone, passwordHash]
    );

    const user = insert.rows[0];
    const idToken = signUserToken({
      id: user.id,
      email: user.email,
      role: user.role,
      phone: user.phone,
    });

    res.json({
      success: true,
      idToken,
      localId: user.id,
      role: user.role,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, error: 'EMAIL_EXISTS' });
    }
    console.error('Registration Error:', error);
    res.status(400).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, email, phone, password_hash, role FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) {
      return res.status(400).json({ success: false, error: 'INVALID_LOGIN' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(400).json({ success: false, error: 'INVALID_LOGIN' });
    }

    const idToken = signUserToken({
      id: user.id,
      email: user.email,
      role: user.role,
      phone: user.phone,
    });

    res.json({
      success: true,
      idToken,
      localId: user.id,
      role: user.role,
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(400).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', verifyToken, async (req, res) => {
  res.json({
    success: true,
    uid: req.user.uid,
    email: req.user.email,
    phoneNumber: req.user.phoneNumber || null,
  });
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  try {
    const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.uid]);
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const match = await bcrypt.compare(oldPassword, row.password_hash);
    if (!match) {
      return res.status(400).json({ success: false, error: 'INVALID_OLD_PASSWORD' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const { rows: updated } = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, role, phone`,
      [passwordHash, req.user.uid]
    );
    const user = updated[0];
    const idToken = signUserToken({
      id: user.id,
      email: user.email,
      role: user.role,
      phone: user.phone,
    });

    res.json({ success: true, idToken });
  } catch (error) {
    console.error('change-password:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

module.exports = { router, verifyToken };
