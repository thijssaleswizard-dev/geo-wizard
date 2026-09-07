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
    const dbCitations = await db('citations').where({ company_key: companyKey });

    const keywords = await Promise.all(rawKeywords.map(async (k) => {
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

      // 1. Compile competitor stats dynamically from prompt scraper results
      let competitors = [];
      const brandStats = {};
      const allCitations = [];
      const selfKey = companyKey.toLowerCase();
      const selfDomain = companyKey.includes('.') ? companyKey : `${companyKey}.nl`;
      const selfBrandName = companyKey.charAt(0).toUpperCase() + companyKey.slice(1);
      
      let totalScans = 0;

      // Collect citations and scans first
      for (const p of prompts) {
        if (!p.results) continue;
        let resObj = null;
        try {
          resObj = typeof p.results === 'string' ? JSON.parse(p.results) : p.results;
        } catch (e) {
          continue;
        }
        if (!resObj || !resObj.modelMentions) continue;

        const promptCitations = resObj.citations || resObj.sources || [];
        allCitations.push(...promptCitations);

        const modelKeys = Object.keys(resObj.modelMentions);
        totalScans += modelKeys.length;
      }

      if (totalScans > 0) {
        // Build candidate list from unique domains in all citations + self
        const candidateDomains = new Map();
        
        // Add self
        candidateDomains.set(selfDomain, {
          brand: selfBrandName,
          domain: selfDomain,
          isSelf: true
        });

        // Comprehensive portal, directory & non-competitor domain blacklist
        const isPortalOrDirectory = (domain) => {
          const dom = (domain || '').toLowerCase().replace('www.', '');
          const portalList = [
            'duckduckgo.', 'google.', 'wikipedia.', 'facebook.', 'instagram.', 'linkedin.', 'youtube.', 'twitter.', 'x.com',
            'trustoo.', 'sortlist.', 'werkspot.', 'dofollow.', 'marketingkiezer.', 'semrush.', 'hostingradar.',
            'telefoongids.', 'telefoonboek.', 'openingstijden.', 'bedrijvenpagina.', 'kvk.nl', 'yelp.', 'trustpilot.',
            'cylex.', 'marktplaats.', 'indebuurt.', 'capterra.', 'goudengids.', 'offertevergelijker.', 'slimster.', 'zoofy.',
            'emerce.', 'frankwatching.', 'top40.', 'radionl.', 'indeed.', 'nationaleberoepengids.'
          ];
          return portalList.some(p => dom.includes(p));
        };

        // Add others from citations
        for (const cit of allCitations) {
          const dom = (cit.domain || '').toLowerCase().trim();
          if (!dom || dom.length <= 3) continue;
          
          if (isPortalOrDirectory(dom)) continue;

          if (!candidateDomains.has(dom)) {
            let rawTitle = (cit.title || '').trim();
            // Remove "Bron:" or "Source:" prefix
            rawTitle = rawTitle.replace(/^(bron|source)\s*:\s*/i, '').trim();

            let brandName = rawTitle.split('-')[0].split('|')[0].split('–')[0].split('—')[0].split(':')[0].trim();
            
            const badNames = ['bron', 'source', 'website', 'home', 'contact', 'over ons', 'diensten', 'reviews', 'officiële website'];
            if (!brandName || brandName.length > 25 || badNames.includes(brandName.toLowerCase()) || brandName.includes('.')) {
              // Convert domain base (e.g. inoma, pittigbakkie, onwise) to Title Case
              const domBase = dom.split('.')[0].replace(/[-_]/g, ' ');
              brandName = domBase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }

            candidateDomains.set(dom, {
              brand: brandName,
              domain: dom,
              isSelf: dom.includes(selfKey) || selfKey.includes(dom.split('.')[0])
            });
          }
        }

        for (const p of prompts) {
          if (!p.results) continue;
          let resObj = null;
          try {
            resObj = typeof p.results === 'string' ? JSON.parse(p.results) : p.results;
          } catch (e) {
            continue;
          }
          if (!resObj || !resObj.brands) continue;

          resObj.brands.forEach(b => {
            const brandName = b.name || b;
            if (typeof brandName !== 'string') return;

            const normKey = brandName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            if (normKey.length <= 2) return;

            const isSelf = normKey.includes(selfKey.replace(/[^a-z0-9]/g, '')) || selfKey.replace(/[^a-z0-9]/g, '').includes(normKey);
            const finalKey = isSelf ? selfKey.replace(/[^a-z0-9]/g, '') : normKey;
            const dom = isSelf ? selfDomain : (b.domain || `${finalKey}.nl`);

            if (!candidateDomains.has(dom)) {
              candidateDomains.set(dom, {
                brand: isSelf ? selfBrandName : brandName,
                domain: dom,
                isSelf: isSelf
              });
            }
          });
        }

        // Loop over candidate domains to calculate stats
        candidateDomains.forEach((cand, domKey) => {
          const stats = {
            brand: cand.brand,
            domain: cand.domain,
            isSelf: cand.isSelf,
            mentionsCount: 0,
            totalPositionSum: 0,
            positionMentionsCount: 0,
            citationsCount: 0
          };

          const cleanBrandName = (cand.brand || '').toLowerCase().trim();
          const cleanDomWithoutSuffix = (cand.domain || '').split('.')[0].toLowerCase().trim();
          const isGenericBrand = ['bron', 'source', 'website', 'home', 'diensten', 'over ons'].includes(cleanBrandName) || cleanBrandName.length <= 2;

          for (const p of prompts) {
            if (!p.results) continue;
            let resObj = null;
            try {
              resObj = typeof p.results === 'string' ? JSON.parse(p.results) : p.results;
            } catch (e) {
              continue;
            }
            if (!resObj || !resObj.modelMentions) continue;

            const modelKeys = Object.keys(resObj.modelMentions);
            modelKeys.forEach(mKey => {
              const mMention = resObj.modelMentions[mKey];
              if (!mMention) return;

              const summary = (mMention.summary || '').toLowerCase();
              
              const isMentioned = !isGenericBrand && (
                summary.includes(cleanBrandName) || 
                (cleanDomWithoutSuffix.length >= 4 && summary.includes(cleanDomWithoutSuffix)) ||
                summary.replace(/[^a-z0-9]/g, '').includes(cleanBrandName.replace(/[^a-z0-9]/g, ''))
              );

              if (isMentioned) {
                stats.mentionsCount += 1;
                
                // Determine position
                let pos = mMention.position || 3;
                if (!stats.isSelf) {
                  const idxOfBrand = summary.indexOf(cleanBrandName);
                  const matchesBefore = (summary.substring(0, idxOfBrand).match(/\d+\.\s/g) || []);
                  pos = matchesBefore.length > 0 ? matchesBefore.length : 3;
                }
                stats.totalPositionSum += pos;
                stats.positionMentionsCount += 1;
              }
            });
          }

          // Count unique citations from dbCitations
          const matchedCitations = dbCitations.filter(c => {
            const dom = (c.domain || '').toLowerCase();
            return dom === domKey || dom.includes(domKey) || domKey.includes(dom);
          });
          const uniqueUrls = Array.from(new Set(matchedCitations.map(c => c.url)));
          stats.citationsCount = uniqueUrls.length;
          stats.citationUrls = uniqueUrls;

          stats.sov = Math.round((stats.mentionsCount / totalScans) * 100);
          stats.position = stats.positionMentionsCount > 0 
            ? parseFloat((stats.totalPositionSum / stats.positionMentionsCount).toFixed(1)) 
            : 3.0;

          brandStats[domKey] = stats;
        });

        competitors = Object.values(brandStats)
          .filter(c => c.isSelf || c.sov > 0 || c.citationsCount > 0)
          .map(c => ({
            brand: c.brand,
            domain: c.domain,
            isSelf: c.isSelf,
            sov: c.sov,
            position: c.position.toString(),
            citations: c.citationsCount,
            citationUrls: c.citationUrls || []
          }));

        // Sort: SOV descending, then citations descending, then position ascending
        competitors.sort((a, b) => {
          if (b.sov !== a.sov) return b.sov - a.sov;
          if (b.citations !== a.citations) return b.citations - a.citations;
          return parseFloat(a.position) - parseFloat(b.position);
        });

        // Persist the computed rankings and target SOV directly to the keywords table
        try {
          const selfComp = competitors.find(c => c.isSelf);
          const visibilityIndex = selfComp ? selfComp.sov : 0;
          await db('keywords').where({ id: k.id }).update({
            competitors_json: JSON.stringify(competitors),
            visibility_index: visibilityIndex,
            updated_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error(`Failed to persist computed competitors for keyword #${k.id}:`, dbErr.message);
        }
      } else {
        // Fallback to static competitors_json or background scraper
        if (k.competitors_json) {
          try {
            competitors = JSON.parse(k.competitors_json);
          } catch (e) {
            competitors = [];
          }
        }

        if (competitors.length === 0) {
          getOrScrapeCompetitors(k.id, kwText, companyKey).catch(e => console.error(e));

          // Use clean domain and company name to return fallback list instantly
          const cleanDomain = companyKey.includes('.') ? companyKey : `${companyKey}.nl`;
          const selfName = companyKey.charAt(0).toUpperCase() + companyKey.slice(1);
          
          let nicheFallbacks = [
            { brand: 'DoubleSmart', domain: 'doublesmart.nl', isSelf: false, sov: 0, position: '-', citations: 0 },
            { brand: 'Traffic Builders', domain: 'trafficbuilders.nl', isSelf: false, sov: 0, position: '-', citations: 0 },
            { brand: 'Inoma ICT', domain: 'inoma.nl', isSelf: false, sov: 0, position: '-', citations: 0 }
          ];

          const kwLower = kwText.toLowerCase();
          if (kwLower.includes('uitvaart') || kwLower.includes('condoleance') || kwLower.includes('graf') || kwLower.includes('crematie') || companyKey.includes('ugna')) {
            nicheFallbacks = [
              { brand: 'Dela', domain: 'dela.nl', isSelf: false, sov: 0, position: '-', citations: 0 },
              { brand: 'Monuta', domain: 'monuta.nl', isSelf: false, sov: 0, position: '-', citations: 0 },
              { brand: 'Yarden', domain: 'yarden.nl', isSelf: false, sov: 0, position: '-', citations: 0 }
            ];
          } else if (kwLower.includes('drank') || kwLower.includes('slijter')) {
            nicheFallbacks = [
              { brand: 'Gall & Gall', domain: 'gall.nl', isSelf: false, sov: 0, position: '-', citations: 0 },
              { brand: 'Drankgigant', domain: 'drankgigant.nl', isSelf: false, sov: 0, position: '-', citations: 0 }
            ];
          } else if (kwLower.includes('groen') || kwLower.includes('hovenier') || kwLower.includes('tuin')) {
            nicheFallbacks = [
              { brand: 'GroenRijk', domain: 'groenrijk.nl', isSelf: false, sov: 0, position: '-', citations: 0 },
              { brand: 'Hovenier Nederland', domain: 'hoveniernederland.nl', isSelf: false, sov: 0, position: '-', citations: 0 }
            ];
          }

          competitors = [
            { brand: selfName, domain: cleanDomain, isSelf: true, sov: 0, position: '-', citations: 0 },
            ...nicheFallbacks
          ];
        }
      }

      const updatedCompetitors = competitors;

      return {
        ...k,
        keyword_text: kwText,
        competitors: updatedCompetitors,
        brands_mentioned: updatedCompetitors.map(c => c.domain.split('.')[0]).join(','),
        prompts: prompts.map(p => {
          let modelMentions = null;
          let citations = null;
          let totalBrandsCount = p.brand_mentioned ? 1 : 0;
          let totalSourcesCount = p.citations_count || 0;
          let engines = ['chatgpt', 'gemini', 'perplexity'];

          if (p.results) {
            try {
              const resObj = typeof p.results === 'string' ? JSON.parse(p.results) : p.results;
              if (resObj) {
                modelMentions = resObj.modelMentions || null;
                citations = resObj.citations || resObj.sources || null;
                totalBrandsCount = resObj.totalBrandsCount || totalBrandsCount;
                totalSourcesCount = resObj.totalSourcesCount || (citations ? citations.length : totalSourcesCount);
                if (modelMentions) {
                  engines = Object.keys(modelMentions).filter(m => modelMentions[m].mentioned);
                }
              }
            } catch (e) {
              console.error('Error parsing prompt results from DB:', e);
            }
          }

          return {
            id: p.id,
            text: p.prompt_text,
            status: p.brand_mentioned ? 'Cited' : 'Not Cited',
            engines,
            brandsCount: totalBrandsCount,
            sourcesCount: totalSourcesCount,
            modelMentions,
            citations,
            responseSummary: p.response_summary || ''
          };
        })
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

    // Run scraper in background
    getOrScrapeCompetitors(newId, kwText, companyKey).catch(e => console.error(e));

    const cleanDomain = companyKey.includes('.') ? companyKey : `${companyKey}.nl`;
    const selfName = companyKey.charAt(0).toUpperCase() + companyKey.slice(1);
    const competitors = [
      { brand: selfName, domain: cleanDomain, isSelf: true, sov: 0, position: '-', citations: 0 }
    ];

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
