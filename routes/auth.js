const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth, db } = require('../firebase/admin');

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;

/**
 * Middleware to verify Firebase Auth Token
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
  }
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // 1. Create user via REST API (to handle password)
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
    const response = await axios.post(url, {
      email,
      password,
      returnSecureToken: true
    });

    const { localId, idToken } = response.data;

    // 2. Initialize user profile in Firestore
    await db.collection('users').doc(localId).set({
      uid: localId,
      email: email,
      balance: 0,
      role: 'user',
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      idToken,
      localId,
      role: 'user'
    });
  } catch (error) {
    console.error('Registration Error:', error.response?.data?.error || error.message);
    const errMsg = error.response?.data?.error?.message || 'Registration failed';
    res.status(400).json({ success: false, error: errMsg });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Sign in via REST API
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const response = await axios.post(url, {
      email,
      password,
      returnSecureToken: true
    });

    const { localId, idToken } = response.data;

    // 2. Get user role from Firestore
    const userDoc = await db.collection('users').doc(localId).get();
    const userData = userDoc.data() || {};

    res.json({
      success: true,
      idToken,
      localId,
      role: userData.role || 'user'
    });
  } catch (error) {
    console.error('Login Error:', error.response?.data?.error || error.message);
    const errMsg = error.response?.data?.error?.message || 'Login failed';
    res.status(400).json({ success: false, error: errMsg });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', verifyToken, async (req, res) => {
  res.json({
    success: true,
    uid: req.user.uid,
    email: req.user.email
  });
});

module.exports = { router, verifyToken };
