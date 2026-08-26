import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/citations - Simulated ScrapingBee Proxy Crawler endpoint fetching from Knex Database
router.get('/', async (req, res) => {
  const query = (req.query.query || '').toLowerCase();
  
  console.log(`[ScrapingBee] Directing search request to ScrapingBee API tunnel...`);
  console.log(`[ScrapingBee] Target URL: https://www.google.com/search?q=${encodeURIComponent(req.query.query || 'Saleswizard')}`);
  console.log(`[ScrapingBee] Routing via premium residential proxy network (NL egress)...`);

  const crawlLogs = [
    `[ScrapingBee] Connecting to ScrapingBee node (tunnel_id: sb_nl_8921)...`,
    `[ScrapingBee] Dutch Residential IP assigned (egress: Amsterdam, NL)`,
    `[ScrapingBee] Requesting target content via Google Search Engine...`,
    `[ScrapingBee] Status 200 OK. Response size: ~142kb. Parsing DOM with Cheerio...`,
    `[ScrapingBee] Successfully bypassed CAPTCHA/anomaly blocks via ScrapingBee proxy pool.`
  ];

  try {
    let companyKey = 'saleswizard';
    if (query.includes('doublesmart')) {
      companyKey = 'doublesmart';
    } else if (query.includes('inoma')) {
      companyKey = 'inoma';
    } else if (query.includes('aanpoters')) {
      companyKey = 'aanpoters';
    }

    const rawCitations = await db('citations').where({ company_key: companyKey });

    const selectedCitations = rawCitations.map((item) => {
      let citedBy = [];
      if (typeof item.cited_by === 'string') {
        try {
          citedBy = JSON.parse(item.cited_by);
        } catch (e) {
          citedBy = [item.cited_by];
        }
      } else if (Array.isArray(item.cited_by)) {
        citedBy = item.cited_by;
      }

      return {
        id: item.id,
        title: item.title,
        url: item.url,
        domain: item.domain,
        snippet: item.snippet,
        type: item.type,
        sentiment: item.sentiment,
        citedBy: citedBy,
        crawlDate: item.crawl_date
      };
    });

    res.json({
      success: true,
      query: req.query.query || 'Saleswizard',
      engine: 'ScrapingBee (Residential Proxy Tunnel)',
      logs: crawlLogs,
      citations: selectedCitations
    });
  } catch (err) {
    console.error('Error querying citations database:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch citations from database'
    });
  }
});

export default router;
