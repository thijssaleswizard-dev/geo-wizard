import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/agents-analytics - Fetch agents analytics for a company
router.get('/', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const analytics = await db('agents_analytics').where({ company_key: companyKey });
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agents analytics' });
  }
});

export default router;
