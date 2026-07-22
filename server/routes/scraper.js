import express from 'express';
import { runScraper } from '../services/scraper.js';
import { syncCompanyStats } from '../services/cron.js';

const router = express.Router();

// POST /api/scraper/run - Run web & AI scraper for a single prompt
router.post('/run', async (req, res) => {
  const { prompt, company } = req.body;

  try {
    const result = await runScraper({ prompt, company });
    res.json(result);
  } catch (error) {
    console.error('Error running scraper:', error);
    res.status(500).json({
      success: false,
      error: 'Interne serverfout bij het uitvoeren van de scraper.'
    });
  }
});

// POST /api/scraper/sync-all - Force full database mention & GEO score refresh for a company
router.post('/sync-all', async (req, res) => {
  const { company } = req.body;

  try {
    const syncResult = await syncCompanyStats(company || 'Saleswizard');
    res.json(syncResult);
  } catch (error) {
    console.error('Error syncing company stats:', error);
    res.status(500).json({
      success: false,
      error: 'Interne serverfout bij het synchroniseren van merkstatistieken.'
    });
  }
});

export default router;
