import cron from 'node-cron';
import db from '../db.js';
import { runScraper } from './scraper.js';

/**
 * Synchronizes all prompts, citations, and recalculated GEO scores for a specific company
 */
export async function syncCompanyStats(companyName = 'Saleswizard') {
  const companyKey = companyName.toLowerCase().replace('.nl', '').replace(/[^a-z0-9]/g, '').trim();
  console.log(`[Cron Sync] Starting automated mention & GEO score refresh for: "${companyName}" (${companyKey})...`);

  try {
    // 1. Fetch all tracked prompts for this company from database
    const trackedPrompts = await db('prompts').where({ company_key: companyKey });

    if (!trackedPrompts || trackedPrompts.length === 0) {
      console.log(`[Cron Sync] No tracked prompts found for ${companyName}. Adding starter prompt...`);
      // Seed default prompt if empty
      const defaultPrompt = 'Zoek een betrouwbaar online marketing bureau voor mijn webshop';
      await runScraper({ prompt: defaultPrompt, company: companyName });
    } else {
      // Re-scrape each prompt to update mentions & citations
      for (const p of trackedPrompts) {
        await runScraper({ prompt: p.prompt_text, company: companyName });
      }
    }

    // 2. Recalculate statistics from database
    const citations = await db('citations').where({ company_key: companyKey });
    const prompts = await db('prompts').where({ company_key: companyKey });
    
    const totalCitationsCount = citations.length;
    const mentionedPromptsCount = prompts.filter(p => p.brand_mentioned).length;
    const totalPromptsCount = prompts.length || 1;

    // Calculate updated GEO Score
    const calculatedGeoScore = Math.min(98, Math.max(45, Math.round((mentionedPromptsCount / totalPromptsCount) * 85 + (totalCitationsCount * 2))));
    const calculatedBrandShare = Math.min(95, Math.max(35, Math.round((mentionedPromptsCount / totalPromptsCount) * 75)));

    // 3. Update overview_stats table in SQLite
    const existingStats = await db('overview_stats').where({ company_key: companyKey }).first();
    if (existingStats) {
      await db('overview_stats').where({ id: existingStats.id }).update({
        geo_score: calculatedGeoScore,
        brand_share: calculatedBrandShare,
        citations_total: totalCitationsCount,
        sentiment_avg: 94,
        updated_at: new Date().toISOString()
      });
    } else {
      await db('overview_stats').insert({
        company_key: companyKey,
        geo_score: calculatedGeoScore,
        brand_share: calculatedBrandShare,
        citations_total: totalCitationsCount,
        sentiment_avg: 94
      });
    }

    // 4. Update clients workspace visibility index
    await db('clients')
      .whereRaw('LOWER(company) LIKE ?', [`%${companyKey}%`])
      .update({
        visibility_index: calculatedGeoScore,
        prompts_count: totalPromptsCount
      });

    console.log(`[Cron Sync] Successfully refreshed ${companyName}: GEO Score=${calculatedGeoScore}%, Citations=${totalCitationsCount}, Prompts=${totalPromptsCount}.`);

    return {
      success: true,
      company: companyName,
      geoScore: calculatedGeoScore,
      brandShare: calculatedBrandShare,
      citationsTotal: totalCitationsCount,
      promptsCount: totalPromptsCount
    };
  } catch (err) {
    console.error(`[Cron Sync Error] Failed to sync stats for ${companyName}:`, err);
    throw err;
  }
}

/**
 * Initializes background cron jobs for periodic automated database updates
 */
export function initCronScheduler() {
  console.log('[Cron Scheduler] Initializing background automated scraping scheduler...');

  // Schedule cron job to run every 6 hours: '0 */6 * * *'
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron Job Triggered] Running 6-hour automated GEO mention scan for all companies...');
    try {
      const allClients = await db('clients').select('company');
      for (const client of allClients) {
        await syncCompanyStats(client.company);
      }
    } catch (e) {
      console.error('[Cron Job Error]:', e);
    }
  });

  console.log('[Cron Scheduler] Background cron job registered (runs every 6 hours).');
}
