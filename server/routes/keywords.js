import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/keywords - Fetch keywords for a company
router.get('/', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const keywords = await db('keywords').where({ company_key: companyKey });
    res.json({ success: true, keywords });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

export default router;
