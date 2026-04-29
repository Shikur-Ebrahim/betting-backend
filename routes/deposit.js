const express = require('express');
const router = express.Router();
const { db } = require('../firebase/admin');
const { verifyToken } = require('./auth');

/**
 * GET /api/deposit/methods
 */
router.get('/methods', async (req, res) => {
  try {
    const methodsSnap = await db.collection('config').doc('deposit_methods').get();
    if (!methodsSnap.exists) {
      // Return defaults if not configured in DB
      return res.json({
        success: true,
        methods: [
          { id: 'cbe', bankName: 'Commercial Bank of Ethiopia', type: 'bank', accountNumber: '1000...', accountName: 'Tipico Admin', minDeposit: 500, logoUrl: '/cbe_logo.png' },
          { id: 'telebirr', bankName: 'Telebirr', type: 'wallet', phoneNumber: '0911...', name: 'Tipico Admin', minDeposit: 100, logoUrl: '/telebirr_logo.png' }
        ]
      });
    }
    res.json({ success: true, methods: methodsSnap.data().methods });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/deposit/check-pending
 */
router.get('/check-pending', verifyToken, async (req, res) => {
  const { userId } = req.query;
  if (!userId || userId !== req.user.uid) return res.status(403).json({ success: false });

  try {
    const pending = await db.collection('deposits')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    
    res.json({ success: true, hasPending: !pending.empty });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

/**
 * POST /api/deposit/submit
 */
router.post('/submit', verifyToken, async (req, res) => {
  const { userId, amount, methodId, proofUrl, phoneNumber } = req.body;
  
  if (!userId || userId !== req.user.uid) return res.status(403).json({ success: false });
  if (!amount || !proofUrl) return res.status(400).json({ success: false, message: 'Missing data' });

  try {
    const depositRef = db.collection('deposits').doc();
    await depositRef.set({
      userId,
      amount: Number(amount),
      methodId,
      proofUrl,
      phoneNumber,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Deposit submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
