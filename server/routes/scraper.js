import express from 'express';
import { runScraper } from '../services/scraper.js';
import { syncCompanyStats } from '../services/cron.js';
import db from '../db.js';

const router = express.Router();

// POST /api/scraper/run - Run web & AI scraper for a single prompt
router.post('/run', async (req, res) => {
  const { prompt, company, promptId } = req.body;

  try {
    const result = await runScraper({ prompt, company });

    if (promptId) {
      const totalMentionedCount = Object.values(result.modelMentions).filter(m => m.mentioned).length;
      const totalModelsCount = Object.keys(result.modelMentions).length;

      const chatgptMention = result.modelMentions.chatgpt;
      const geminiMention = result.modelMentions.gemini;

      await db('prompts').where({ id: promptId }).update({
        status: 'completed',
        brand_mentioned: totalMentionedCount > 0,
        position: chatgptMention?.position || geminiMention?.position || 1,
        response_summary: `${company.toLowerCase().replace('.nl', '').trim()} wordt door ${totalMentionedCount} van de ${totalModelsCount} AI-modellen aanbevolen.`,
        sentiment: chatgptMention?.sentiment || '+90',
        logs: JSON.stringify(result.logs),
        results: JSON.stringify(result),
        updated_at: new Date().toISOString()
      });
    }

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
