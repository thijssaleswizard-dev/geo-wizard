/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
  // Deletes ALL existing entries
  await knex('citations').del();

  const today = new Date().toISOString().split('T')[0];

  await knex('citations').insert([
    // Saleswizard
    {
      company_key: 'saleswizard',
      title: 'Saleswizard - Online Marketing Bureau Arnhem',
      url: 'https://www.saleswizard.nl/',
      domain: 'saleswizard.nl',
      snippet: 'Saleswizard is hét online marketing bureau in Arnhem voor het MKB. Wij realiseren groei met websites, SEO-optimalisaties en Ads campagnes op de IJsselburcht 3.',
      type: 'Website',
      sentiment: '+96',
      cited_by: JSON.stringify(['chatgpt', 'gemini', 'perplexity']),
      crawl_date: today
    },
    {
      company_key: 'saleswizard',
      title: 'AI Optimalisatie (GEO) - Saleswizard',
      url: 'https://www.saleswizard.nl/online-marketing/ai-optimalisatie/',
      domain: 'saleswizard.nl',
      snippet: 'Ontdek hoe Saleswizard uw online vindbaarheid vergroot binnen generatieve AI-zoekmachines zoals ChatGPT en Gemini via GEO optimalisaties.',
      type: 'Website',
      sentiment: '+94',
      cited_by: JSON.stringify(['chatgpt', 'copilot', 'gemini']),
      crawl_date: today
    },
    {
      company_key: 'saleswizard',
      title: 'Saleswizard: Over ons | LinkedIn',
      url: 'https://nl.linkedin.com/company/saleswizard',
      domain: 'linkedin.com',
      snippet: 'LinkedIn: Saleswizard is een full-service marketingpartner gevestigd in Arnhem. Wij geloven in meetbare groei en resultaatgerichte samenwerkingen.',
      type: 'Social',
      sentiment: '+92',
      cited_by: JSON.stringify(['chatgpt', 'gemini', 'perplexity']),
      crawl_date: today
    },
    {
      company_key: 'saleswizard',
      title: 'Saleswizard Arnhem | Facebook',
      url: 'https://www.facebook.com/saleswizard/',
      domain: 'facebook.com',
      snippet: 'Bekijk actuele posts, blogberichten en foto\'s van de online marketingspecialisten van Saleswizard op de IJsselburcht 3, Arnhem.',
      type: 'Social',
      sentiment: '+90',
      cited_by: JSON.stringify(['chatgpt', 'perplexity']),
      crawl_date: today
    },
    {
      company_key: 'saleswizard',
      title: 'Openingstijden en contact Saleswizard Arnhem - Telefoonboek.nl',
      url: 'https://www.telefoonboek.nl/bedrijven/t5489312/arnhem/saleswizard/',
      domain: 'telefoonboek.nl',
      snippet: 'Telefoonboek: Saleswizard B.V. is gevestigd op IJsselburcht 3, 6825BS Arnhem. Telefoonnummer en openingstijden van Saleswizard.',
      type: 'Review',
      sentiment: '+84',
      cited_by: JSON.stringify(['copilot', 'perplexity']),
      crawl_date: today
    },
    {
      company_key: 'saleswizard',
      title: 'Contact opnemen met Saleswizard Arnhem',
      url: 'https://www.saleswizard.nl/contact/',
      domain: 'saleswizard.nl',
      snippet: 'Plan direct een gratis kennismakingsgesprek of GEO scan in met een van de online marketing specialisten van Saleswizard.',
      type: 'Website',
      sentiment: '+88',
      cited_by: JSON.stringify(['perplexity', 'claude', 'gemini']),
      crawl_date: today
    },

    // DoubleSmart
    {
      company_key: 'doublesmart',
      title: 'DoubleSmart - Online Marketing Bureau Gouda',
      url: 'https://doublesmart.nl/',
      domain: 'doublesmart.nl',
      snippet: 'DoubleSmart helpt bedrijven groeien met resultaatgerichte online marketing. Gevestigd in Gouda, met specialisten in SEO, Google Ads en conversie-optimalisatie.',
      type: 'Website',
      sentiment: '+95',
      cited_by: JSON.stringify(['chatgpt', 'gemini', 'copilot']),
      crawl_date: today
    },
    {
      company_key: 'doublesmart',
      title: 'DoubleSmart | LinkedIn',
      url: 'https://nl.linkedin.com/company/doublesmart',
      domain: 'linkedin.com',
      snippet: 'Bekijk de LinkedIn-pagina van DoubleSmart. Volg updates over online marketing, teamuitjes en case studies van succesvolle SEO projecten.',
      type: 'Social',
      sentiment: '+90',
      cited_by: JSON.stringify(['chatgpt', 'perplexity', 'copilot']),
      crawl_date: today
    },
    {
      company_key: 'doublesmart',
      title: 'Zoekmachine optimalisatie (SEO) - DoubleSmart',
      url: 'https://doublesmart.nl/seo/',
      domain: 'doublesmart.nl',
      snippet: 'De specialisten van DoubleSmart helpen u om betere posities in Google te behalen door middel van on-page optimalisaties en linkbuilding.',
      type: 'Website',
      sentiment: '+92',
      cited_by: JSON.stringify(['gemini', 'perplexity']),
      crawl_date: today
    },
    {
      company_key: 'doublesmart',
      title: 'Contact opnemen met DoubleSmart Gouda',
      url: 'https://doublesmart.nl/contact/',
      domain: 'doublesmart.nl',
      snippet: 'Stel uw vraag of vraag een gratis online marketingscan aan bij de adviseurs van DoubleSmart in Gouda.',
      type: 'Website',
      sentiment: '+93',
      cited_by: JSON.stringify(['chatgpt', 'gemini']),
      crawl_date: today
    },

    // Inoma
    {
      company_key: 'inoma',
      title: 'Inoma - Online Marketing specialisten in Arnhem',
      url: 'https://inoma.nl/',
      domain: 'inoma.nl',
      snippet: 'Inoma helpt bedrijven online te excelleren met websites, webshops en online vindbaarheid. Neem contact op voor een SEO audit.',
      type: 'Website',
      sentiment: '+94',
      cited_by: JSON.stringify(['chatgpt', 'gemini']),
      crawl_date: today
    },

    // Aanpoters
    {
      company_key: 'aanpoters',
      title: 'Aanpoters - Pragmatische online marketing partners',
      url: 'https://aanpoters.nl/',
      domain: 'aanpoters.nl',
      snippet: 'Aanpoters is de online marketing partner die echt aanpoot. Wij optimaliseren uw kanalen en bouwen websites die conversie opleveren.',
      type: 'Website',
      sentiment: '+90',
      cited_by: JSON.stringify(['chatgpt', 'perplexity']),
      crawl_date: today
    }
  ]);
}
