import express from 'express';
import db from '../db.js';
import { getOrScrapeCompetitors } from '../services/competitorScraper.js';

const router = express.Router();

// GET /api/keywords - Fetch keywords for a company
router.get('/', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const rawKeywords = await db('keywords').where({ company_key: companyKey }).orderBy('id', 'desc');

    const keywords = await Promise.all(rawKeywords.map(async (k) => {
      let competitors = [];
      if (k.competitors_json) {
        try {
          competitors = JSON.parse(k.competitors_json);
        } catch (e) {
          competitors = [];
        }
      }

      if (!competitors || competitors.length === 0) {
        competitors = await getOrScrapeCompetitors(k.id, k.keyword, companyKey);
      }

      const kwText = k.keyword || k.keyword_text || '';
      return {
        ...k,
        keyword_text: kwText,
        competitors: competitors,
        brands_mentioned: competitors.map(c => c.domain.split('.')[0]).join(',')
      };
    }));

    res.json({ success: true, keywords });
  } catch (err) {
    console.error('Failed to fetch keywords:', err);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// POST /api/keywords - Add a new keyword
router.post('/', async (req, res) => {
  const { company, keyword, volume } = req.body;
  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is verplicht.' });
  }

  const companyKey = (company || 'saleswizard').toLowerCase().replace('.nl', '').trim();
  const kwText = keyword.trim().toLowerCase();

  try {
    const [newId] = await db('keywords').insert({
      company_key: companyKey,
      keyword: kwText,
      rank: null,
      search_engine: 'ChatGPT',
      sentiment: 'N/A',
      citations_count: 0,
      monthly_searches: volume ? parseInt(volume) : 100
    });

    const competitors = await getOrScrapeCompetitors(newId, kwText, companyKey);
    const insertedKeyword = await db('keywords').where('id', newId).first();

    res.status(201).json({
      success: true,
      keyword: {
        ...insertedKeyword,
        keyword_text: kwText,
        competitors: competitors,
        brands_mentioned: competitors.map(c => c.domain.split('.')[0]).join(',')
      }
    });
  } catch (err) {
    console.error('Error inserting keyword:', err);
    res.status(500).json({ error: 'Failed to create keyword' });
  }
});

// DELETE /api/keywords/:id - Delete a keyword
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCount = await db('keywords').where({ id }).del();
    if (!deletedCount) {
      return res.status(404).json({ error: 'Keyword niet gevonden.' });
    }
    res.json({ success: true, message: 'Keyword succesvol verwijderd.' });
  } catch (err) {
    console.error('Error deleting keyword:', err);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

export default router;
