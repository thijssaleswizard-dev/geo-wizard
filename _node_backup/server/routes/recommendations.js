import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/recommendations - Fetch recommendations for a company
router.get('/', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const recommendations = await db('recommendations').where({ company_key: companyKey });
    res.json({ success: true, recommendations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

export default router;
