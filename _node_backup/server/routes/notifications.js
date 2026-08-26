import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/notifications - Fetch notifications
router.get('/', async (req, res) => {
  try {
    const notifications = await db('notifications').select('*');
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

export default router;
