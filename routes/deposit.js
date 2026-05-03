const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { getDocument } = require('../db/documents');
const { verifyToken } = require('./auth');

/**
 * GET /api/deposit/methods
 */
router.get('/methods', async (_req, res) => {
  try {
    const doc = await getDocument('config', 'deposit_methods');
    if (!doc?.data?.methods) {
      return res.json({
        success: true,
        methods: [
          {
            id: 'cbe',
            bankName: 'Commercial Bank of Ethiopia',
            type: 'bank',
            accountNumber: '1000...',
            accountName: 'Tipico Admin',
            minDeposit: 500,
            logoUrl: '/cbe_logo.png',
          },
          {
            id: 'telebirr',
            bankName: 'Telebirr',
            type: 'wallet',
            phoneNumber: '0911...',
            name: 'Tipico Admin',
            minDeposit: 100,
            logoUrl: '/telebirr_logo.png',
          },
        ],
      });
    }
    res.json({ success: true, methods: doc.data.methods });
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
    const { rows } = await pool.query(
      `SELECT 1 FROM deposits WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
      [userId]
    );
    res.json({ success: true, hasPending: rows.length > 0 });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

/**
 * POST /api/deposit/submit
 */
router.post('/submit', verifyToken, async (req, res) => {
  const { userId, amount, methodId, proofUrl, phoneNumber } = req.body || {};

  if (!userId || userId !== req.user.uid) return res.status(403).json({ success: false });
  if (!amount || !proofUrl) return res.status(400).json({ success: false, message: 'Missing data' });

  try {
    await pool.query(
      `INSERT INTO deposits (user_id, amount, method_id, proof_url, phone_number, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
      [userId, Number(amount), methodId || null, proofUrl, phoneNumber || null]
    );

    res.json({ success: true, message: 'Deposit submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
