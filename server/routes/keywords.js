import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import db from '../db.js';
import { getOrScrapeCompetitors } from '../services/competitorScraper.js';
import { queryGemini } from '../services/aiEngine.js';

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

      // Fetch prompts linked to this keyword
      let prompts = await db('prompts')
        .where({ company_key: companyKey, keyword_id: k.id })
        .orderBy('id', 'asc');

      if (!prompts || prompts.length === 0) {
        prompts = await db('prompts')
          .where({ company_key: companyKey })
          .andWhere('prompt_text', 'like', `%${kwText}%`)
          .orderBy('id', 'asc');
      }

      return {
        ...k,
        keyword_text: kwText,
        competitors: competitors,
        brands_mentioned: competitors.map(c => c.domain.split('.')[0]).join(','),
        prompts: prompts.map(p => ({
          id: p.id,
          text: p.prompt_text,
          status: p.brand_mentioned ? 'Cited' : 'Not Cited',
          engines: ['chatgpt', 'gemini', 'perplexity'],
          brandsCount: p.brand_mentioned ? 1 : 0,
          sourcesCount: p.citations_count || 0
        }))
      };
    }));

    res.json({ success: true, keywords });
  } catch (err) {
    console.error('Failed to fetch keywords:', err);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// POST /api/keywords/recommend - Scrapes target website HTML & generates location-accurate keywords
router.post('/recommend', async (req, res) => {
  const { company } = req.body;
  const companyName = (company || 'Saleswizard').trim();
  const companyKey = companyName.toLowerCase().replace('.nl', '').replace(/[^a-z0-9]/g, '');

  console.log(`[Keyword Recommender] Scraping website for company: "${companyName}"...`);

  let scrapedContent = '';
  let targetUrl = companyName.startsWith('http') ? companyName : `https://www.${companyName.toLowerCase().includes('.') ? companyName : companyName + '.nl'}`;

  // 1. Scrape actual website HTML content
  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 6000
    });

    if (response.status === 200 && response.data) {
      const $ = cheerio.load(response.data);
      const title = $('title').text().trim();
      const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
      const h1s = $('h1').map((_, el) => $(el).text().trim()).get().join(' ');
      const h2s = $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 5).join(' ');
      const bodyText = $('p').map((_, el) => $(el).text().trim()).get().slice(0, 5).join(' ');

      scrapedContent = `Titel: ${title}\nMeta Description: ${metaDesc}\nHeadings: ${h1s} ${h2s}\nTekst: ${bodyText}`.trim();
      console.log(`[Keyword Recommender] Successfully scraped ${scrapedContent.length} chars from ${targetUrl}`);
    }
  } catch (scrapeErr) {
    console.warn(`[Keyword Recommender Warning] Direct website fetch failed for ${targetUrl} (${scrapeErr.message}). Fallback to DuckDuckGo search index...`);
    
    // Fallback: Scrape DuckDuckGo search snippet for the company domain/brand
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(companyName + ' website nederland')}`;
      const ddgRes = await axios.get(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 5000
      });
      if (ddgRes.status === 200 && ddgRes.data) {
        const $ = cheerio.load(ddgRes.data);
        const snippet = $('.result__snippet').first().text().trim();
        const title = $('.result__title').first().text().trim();
        scrapedContent = `Titel: ${title}\nSnippet: ${snippet}`;
      }
    } catch (e) {
      console.warn(`[Keyword Recommender Warning] DDG fallback failed: ${e.message}`);
    }
  }

  // 2. Use Gemini AI to extract exact, location-accurate keywords based on scraped content
  let recommended = [];

  try {
    const aiPrompt = `Analyseer de volgende gescrapte gegevens van de website van "${companyName}":

--- GESCRAPTE WEBSITE INHOUD ---
${scrapedContent || `Bedrijfsnaam: ${companyName}`}
--------------------------------

Genereer exact 5 uiterst relevante, hoog-converterende zoekwoorden (keywords) in het Nederlands.
BELANGRIJK: Let heel goed op de specifieke vestigingsplaats/regio (bijv. Velp, Arnhem, Nijmegen) en specifieke diensten die in de gescrapte tekst worden vermeld.
Geef ALLEEN een komma-gescheiden lijst met 5 zoekwoorden in kleine letters zonder nummering of extra tekst.`;

    const aiRes = await queryGemini({ prompt: aiPrompt, companyName });

    if (aiRes && aiRes.text && aiRes.text.includes(',')) {
      const parsed = aiRes.text.split(',').map(k => k.trim().toLowerCase().replace(/[^a-z0-9\s-]/gi, '')).filter(Boolean);
      if (parsed.length >= 3) {
        recommended = parsed.slice(0, 5);
      }
    }
  } catch (aiErr) {
    console.error(`[Keyword Recommender AI Error] ${aiErr.message}`);
  }

  if (recommended.length === 0) {
    return res.status(422).json({
      success: false,
      error: 'Er konden geen keywords worden gegenereerd voor deze website. Dit kan komen door een tijdelijke API-beperking of onbereikbaarheid van de website.'
    });
  }

  console.log(`[Keyword Recommender Result] Generated keywords for ${companyName}:`, recommended);

  res.json({
    success: true,
    company: companyName,
    keywords: recommended,
    formatted: recommended.join(', ')
  });
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

// POST /api/keywords/bulk-delete - Delete multiple keywords
router.post('/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Geen geldige IDs opgegeven.' });
  }

  try {
    await db('keywords').whereIn('id', ids).del();
    res.json({ success: true, message: 'Keywords succesvol verwijderd.' });
  } catch (err) {
    console.error('Error bulk deleting keywords:', err);
    res.status(500).json({ error: 'Failed to delete keywords' });
  }
});

export default router;
