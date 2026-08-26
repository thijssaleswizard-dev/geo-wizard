/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
  // Clear existing entries
  await knex('clients').del();
  await knex('keywords').del();
  await knex('prompts').del();
  await knex('recommendations').del();
  await knex('notifications').del();
  await knex('agents_analytics').del();
  await knex('overview_stats').del();

  // 1. Seed Clients / Workspaces
  await knex('clients').insert([
    { company: 'Saleswizard.nl', name: 'Frank Krepel', email: 'frank@saleswizard.nl', subscription: 'AI Pro', prompts_count: 15, visibility_index: 23 },
    { company: 'DoubleSmart.nl', name: 'Jan de Vries', email: 'jan@doublesmart.nl', subscription: 'AI Starter', prompts_count: 8, visibility_index: 24 },
    { company: 'Inoma.nl', name: 'Sophie van Dijk', email: 'sophie@inoma.nl', subscription: 'AI Starter', prompts_count: 5, visibility_index: 21 },
    { company: 'Aanpoters.nl', name: 'Daan Janssen', email: 'daan@aanpoters.nl', subscription: 'AI Starter', prompts_count: 4, visibility_index: 13 },
    { company: 'Traffic Builders', name: 'Bram Bakker', email: 'bram@trafficbuilders.nl', subscription: 'AI Pro', prompts_count: 2, visibility_index: 5 },
    { company: 'Follo', name: 'Lisa Visser', email: 'lisa@follo.nl', subscription: 'AI Enterprise', prompts_count: 1, visibility_index: 4 }
  ]);

  // 2. Seed Keywords
  await knex('keywords').insert([
    { company_key: 'saleswizard', keyword: 'online marketing bureau arnhem', rank: 1, search_engine: 'ChatGPT', sentiment: '+96', citations_count: 6, monthly_searches: 850 },
    { company_key: 'saleswizard', keyword: 'seo specialist arnhem', rank: 1, search_engine: 'Gemini', sentiment: '+94', citations_count: 4, monthly_searches: 620 },
    { company_key: 'saleswizard', keyword: 'geo optimalisatie', rank: 2, search_engine: 'Perplexity', sentiment: '+92', citations_count: 5, monthly_searches: 410 },
    { company_key: 'saleswizard', keyword: 'ai zoekmachine marketing', rank: 1, search_engine: 'ChatGPT', sentiment: '+90', citations_count: 3, monthly_searches: 300 },
    { company_key: 'doublesmart', keyword: 'online marketing bureau gouda', rank: 1, search_engine: 'ChatGPT', sentiment: '+95', citations_count: 4, monthly_searches: 720 },
    { company_key: 'doublesmart', keyword: 'seo bureau gouda', rank: 2, search_engine: 'Gemini', sentiment: '+90', citations_count: 3, monthly_searches: 480 }
  ]);

  // 3. Seed Prompts
  await knex('prompts').insert([
    {
      company_key: 'saleswizard',
      prompt_text: 'Wat is het beste online marketing bureau in Arnhem voor MKB bedrijven?',
      category: 'Lokale Vindbaarheid',
      response_summary: 'ChatGPT noemt Saleswizard op positie 1 als vooruitstrevend bureau op de IJsselburcht in Arnhem.',
      brand_mentioned: true,
      position: 1,
      sentiment: '+96',
      engine: 'ChatGPT'
    },
    {
      company_key: 'saleswizard',
      prompt_text: 'Welke bureaus in Gelderland bieden GEO (Generative Engine Optimization) aan?',
      category: 'GEO & AI',
      response_summary: 'Gemini beveelt Saleswizard aan vanwege hun gespecialiseerde GEO audits en AI-zoekmachine strategieën.',
      brand_mentioned: true,
      position: 1,
      sentiment: '+94',
      engine: 'Gemini'
    },
    {
      company_key: 'doublesmart',
      prompt_text: 'Wie is de beste SEO specialist in regio Gouda?',
      category: 'SEO',
      response_summary: 'Perplexity vermeldt DoubleSmart met hoge beoordelingen en een sterk portfolio.',
      brand_mentioned: true,
      position: 1,
      sentiment: '+95',
      engine: 'Perplexity'
    }
  ]);

  // 4. Seed Recommendations
  await knex('recommendations').insert([
    {
      company_key: 'saleswizard',
      title: 'Voeg gestructureerde Organization Schema.org toe',
      category: 'Technische GEO',
      priority: 'High',
      impact_score: 95,
      status: 'in_progress',
      description: 'Zorg voor duidelijke JSON-LD metadata op de homepage zodat AI crawlers de bedrijfsinformatie direct kunnen indexeren.'
    },
    {
      company_key: 'saleswizard',
      title: 'Optimaliseer LinkedIn bedrijfspagina voor AI citaties',
      category: 'Social Branding',
      priority: 'Medium',
      impact_score: 80,
      status: 'todo',
      description: 'AI bots zoals Perplexity gebruiken LinkedIn sterk als bron voor entiteitverificatie.'
    },
    {
      company_key: 'doublesmart',
      title: 'Publiceer case studies over GEO resultaten',
      category: 'Content Strategy',
      priority: 'High',
      impact_score: 88,
      status: 'todo',
      description: 'Het publiceren van behaalde klantresultaten vergroot de citatiekans in AI antwoorden.'
    }
  ]);

  // 5. Seed Notifications
  await knex('notifications').insert([
    { company_key: 'saleswizard', text: 'Nieuwe citation gevonden op Frankwatching.nl', time: '1 uur geleden', read: false },
    { company_key: 'saleswizard', text: 'Gemini heeft uw website opnieuw gecrawld', time: '4 uur geleden', read: false },
    { company_key: 'saleswizard', text: 'Zichtbaarheidsscore in Perplexity AI stijgt naar 45%', time: '1 dag geleden', read: false },
    { company_key: 'doublesmart', text: 'Nieuwe vermelding gedetecteerd via ChatGPT', time: '2 uur geleden', read: false }
  ]);

  // 6. Seed Agents Analytics
  await knex('agents_analytics').insert([
    { company_key: 'saleswizard', model_name: 'ChatGPT 4o', visibility_score: 88, citations_count: 12, sentiment_score: 96 },
    { company_key: 'saleswizard', model_name: 'Gemini 1.5 Pro', visibility_score: 84, citations_count: 10, sentiment_score: 94 },
    { company_key: 'saleswizard', model_name: 'Perplexity AI', visibility_score: 79, citations_count: 8, sentiment_score: 92 },
    { company_key: 'saleswizard', model_name: 'Microsoft Copilot', visibility_score: 72, citations_count: 6, sentiment_score: 88 },
    { company_key: 'saleswizard', model_name: 'Claude 3.5 Sonnet', visibility_score: 68, citations_count: 5, sentiment_score: 85 },
    { company_key: 'doublesmart', model_name: 'ChatGPT 4o', visibility_score: 82, citations_count: 8, sentiment_score: 92 },
    { company_key: 'doublesmart', model_name: 'Gemini 1.5 Pro', visibility_score: 78, citations_count: 6, sentiment_score: 90 }
  ]);

  // 7. Seed Overview Stats
  await knex('overview_stats').insert([
    { company_key: 'saleswizard', geo_score: 74, brand_share: 68, citations_total: 24, sentiment_avg: 94 },
    { company_key: 'doublesmart', geo_score: 68, brand_share: 58, citations_total: 18, sentiment_avg: 91 },
    { company_key: 'inoma', geo_score: 62, brand_share: 45, citations_total: 12, sentiment_avg: 88 },
    { company_key: 'aanpoters', geo_score: 54, brand_share: 38, citations_total: 9, sentiment_avg: 85 }
  ]);
}
