const express = require('express');
const router = express.Router();
const { db } = require('../firebase/admin');
const { verifyToken } = require('./auth');

/**
 * GET /api/user/profile
 * Returns user balance and settings
 */
router.get('/profile', verifyToken, async (req, res) => {
  const { userId } = req.query;
  
  if (!userId || userId !== req.user.uid) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      // Initialize user if missing
      const newUser = {
        uid: userId,
        balance: 0,
        currency: 'Birr',
        createdAt: new Date().toISOString()
      };
      await db.collection('users').doc(userId).set(newUser);
      return res.json({ success: true, ...newUser });
    }
    
    res.json({ success: true, ...userDoc.data() });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
