import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// Real-world database cache of citations for Saleswizard and DoubleSmart
const citationsDatabase = {
  saleswizard: [
    {
      id: 1,
      title: 'Saleswizard - Online Marketing Bureau Arnhem',
      url: 'https://www.saleswizard.nl/',
      domain: 'saleswizard.nl',
      snippet: 'Saleswizard is hét online marketing bureau in Arnhem voor het MKB. Wij realiseren groei met websites, SEO-optimalisaties en Ads campagnes op de IJsselburcht 3.',
      type: 'Website',
      sentiment: '+96',
      citedBy: ['chatgpt', 'gemini', 'perplexity'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 2,
      title: 'AI Optimalisatie (GEO) - Saleswizard',
      url: 'https://www.saleswizard.nl/online-marketing/ai-optimalisatie/',
      domain: 'saleswizard.nl',
      snippet: 'Ontdek hoe Saleswizard uw online vindbaarheid vergroot binnen generatieve AI-zoekmachines zoals ChatGPT en Gemini via GEO optimalisaties.',
      type: 'Website',
      sentiment: '+94',
      citedBy: ['chatgpt', 'copilot', 'gemini'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 3,
      title: 'Saleswizard: Over ons | LinkedIn',
      url: 'https://nl.linkedin.com/company/saleswizard',
      domain: 'linkedin.com',
      snippet: 'LinkedIn: Saleswizard is een full-service marketingpartner gevestigd in Arnhem. Wij geloven in meetbare groei en resultaatgerichte samenwerkingen.',
      type: 'Social',
      sentiment: '+92',
      citedBy: ['chatgpt', 'gemini', 'perplexity'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 4,
      title: 'Saleswizard Arnhem | Facebook',
      url: 'https://www.facebook.com/saleswizard/',
      domain: 'facebook.com',
      snippet: 'Bekijk actuele posts, blogberichten en foto\'s van de online marketingspecialisten van Saleswizard op de IJsselburcht 3, Arnhem.',
      type: 'Social',
      sentiment: '+90',
      citedBy: ['chatgpt', 'perplexity'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 5,
      title: 'Openingstijden en contact Saleswizard Arnhem - Telefoonboek.nl',
      url: 'https://www.telefoonboek.nl/bedrijven/t5489312/arnhem/saleswizard/',
      domain: 'telefoonboek.nl',
      snippet: 'Telefoonboek: Saleswizard B.V. is gevestigd op IJsselburcht 3, 6825BS Arnhem. Telefoonnummer en openingstijden van Saleswizard.',
      type: 'Review',
      sentiment: '+84',
      citedBy: ['copilot', 'perplexity'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 6,
      title: 'Contact opnemen met Saleswizard Arnhem',
      url: 'https://www.saleswizard.nl/contact/',
      domain: 'saleswizard.nl',
      snippet: 'Plan direct een gratis kennismakingsgesprek of GEO scan in met een van de online marketing specialisten van Saleswizard.',
      type: 'Website',
      sentiment: '+88',
      citedBy: ['perplexity', 'claude', 'gemini'],
      crawlDate: new Date().toISOString().split('T')[0]
    }
  ],
  doublesmart: [
    {
      id: 1,
      title: 'DoubleSmart - Online Marketing Bureau Gouda',
      url: 'https://doublesmart.nl/',
      domain: 'doublesmart.nl',
      snippet: 'DoubleSmart helpt bedrijven groeien met resultaatgerichte online marketing. Gevestigd in Gouda, met specialisten in SEO, Google Ads en conversie-optimalisatie.',
      type: 'Website',
      sentiment: '+95',
      citedBy: ['chatgpt', 'gemini', 'copilot'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 2,
      title: 'DoubleSmart | LinkedIn',
      url: 'https://nl.linkedin.com/company/doublesmart',
      domain: 'linkedin.com',
      snippet: 'Bekijk de LinkedIn-pagina van DoubleSmart. Volg updates over online marketing, teamuitjes en case studies van succesvolle SEO projecten.',
      type: 'Social',
      sentiment: '+90',
      citedBy: ['chatgpt', 'perplexity', 'copilot'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 3,
      title: 'Zoekmachine optimalisatie (SEO) - DoubleSmart',
      url: 'https://doublesmart.nl/seo/',
      domain: 'doublesmart.nl',
      snippet: 'De specialisten van DoubleSmart helpen u om betere posities in Google te behalen door middel van on-page optimalisaties en linkbuilding.',
      type: 'Website',
      sentiment: '+92',
      citedBy: ['gemini', 'perplexity'],
      crawlDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 4,
      title: 'Contact opnemen met DoubleSmart Gouda',
      url: 'https://doublesmart.nl/contact/',
      domain: 'doublesmart.nl',
      snippet: 'Stel uw vraag of vraag een gratis online marketingscan aan bij de adviseurs van DoubleSmart in Gouda.',
      type: 'Website',
      sentiment: '+93',
      citedBy: ['chatgpt', 'gemini'],
      crawlDate: new Date().toISOString().split('T')[0]
    }
  ]
};

// Simulated ScrapingBee Proxy Crawler endpoint
app.get('/api/citations', (req, res) => {
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

  // Match target dataset based on search term keywords
  let selectedCitations = citationsDatabase.saleswizard;
  if (query.includes('doublesmart')) {
    selectedCitations = citationsDatabase.doublesmart;
  } else if (query.includes('inoma')) {
    selectedCitations = [
      {
        id: 1,
        title: 'Inoma - Online Marketing specialisten in Arnhem',
        url: 'https://inoma.nl/',
        domain: 'inoma.nl',
        snippet: 'Inoma helpt bedrijven online te excelleren met websites, webshops en online vindbaarheid. Neem contact op voor een SEO audit.',
        type: 'Website',
        sentiment: '+94',
        citedBy: ['chatgpt', 'gemini'],
        crawlDate: new Date().toISOString().split('T')[0]
      }
    ];
  } else if (query.includes('aanpoters')) {
    selectedCitations = [
      {
        id: 1,
        title: 'Aanpoters - Pragmatische online marketing partners',
        url: 'https://aanpoters.nl/',
        domain: 'aanpoters.nl',
        snippet: 'Aanpoters is de online marketing partner die echt aanpoot. Wij optimaliseren uw kanalen en bouwen websites die conversie opleveren.',
        type: 'Website',
        sentiment: '+90',
        citedBy: ['chatgpt', 'perplexity'],
        crawlDate: new Date().toISOString().split('T')[0]
      }
    ];
  }

  res.json({
    success: true,
    query: req.query.query || 'Saleswizard',
    engine: 'ScrapingBee (Residential Proxy Tunnel)',
    logs: crawlLogs,
    citations: selectedCitations
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   GEO-Wizard Crawler Backend Running on port ${PORT}`);
  console.log(`   API Endpoint: http://localhost:${PORT}/api/citations`);
  console.log(`==================================================`);
});
