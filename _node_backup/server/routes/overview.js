import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/overview-stats - Fetch overview stats for a company
router.get('/', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const stats = await db('overview_stats').where({ company_key: companyKey }).first();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch overview stats' });
  }
});

export default router;
