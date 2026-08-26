import express from 'express';
import db from '../db.js';
import { enqueueScrape } from '../services/queue.js';
import { queryGemini } from '../services/aiEngine.js';

const router = express.Router();

// GET /api/prompts - Fetch prompts for a company
router.get('/', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '').trim();
  try {
    const prompts = await db('prompts').where({ company_key: companyKey }).orderBy('id', 'desc');
    
    const formatted = prompts.map(p => ({
      id: p.id,
      text: p.prompt_text,
      tag: p.category || 'Algemeen',
      engines: typeof p.engines === 'string' ? JSON.parse(p.engines) : (p.engines || { chatgpt: true, gemini: true, perplexity: true, copilot: true, claude: true, aio: true }),
      mentioned: Boolean(p.brand_mentioned),
      position: p.position,
      sentiment: p.sentiment || '+90',
      status: p.status || 'completed',
      logs: p.logs ? JSON.parse(p.logs) : [],
      dateAdded: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    }));

    res.json({ success: true, prompts: formatted });
  } catch (err) {
    console.error('Error fetching prompts:', err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// POST /api/prompts/generate - Generate 3 dynamic prompts based on a keyword and company
router.post('/generate', async (req, res) => {
  const { company, keyword } = req.body;
  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is verplicht voor het genereren van prompts.' });
  }

  const companyName = (company || 'Saleswizard').trim();
  const companyKey = companyName.toLowerCase().replace('.nl', '').trim();

  // Prompt logic for Gemini (FAQ-style consumer questions)
  const promptMessage = `We hebben een bedrijf genaamd "${companyName}" en het zoekwoord "${keyword}".
Genereer exact 3 veelgestelde, natuurlijke consumentenvragen (FAQ-vragen) in het Nederlands die mensen stellen in AI-zoekmachines (zoals ChatGPT of Gemini) wanneer ze informatie zoeken over "${keyword}".

Kwaliteitseisen voor de vragen:
1. Ze moeten klinken als natuurlijk geschreven vragen door een mens (bijv: "Wat kost...?", "Wie is de beste...?", "Hoe vind ik...?").
2. Integratie van het zoekwoord: Verwerk het zoekwoord "${keyword}" op een grammaticaal correcte en vloeiende manier in de zin.
   - FOUT: "Wat is het beste hoveniersbedrijf rheden in Nederland?" of "Wie is de best beoordeelde partij voor hoveniersbedrijf rheden?".
   - GOED: "Wat is het beste hoveniersbedrijf in Rheden?", "Wie is de best beoordeelde hovenier in Rheden?", "Hoeveel kost een hovenier in Rheden gemiddeld?".
3. Locatie-afhandeling: Als het zoekwoord een plaatsnaam of regio bevat (zoals 'rheden', 'velp', 'arnhem'), schrijf de plaatsnaam dan altijd met een hoofdletter en gebruik een passend voorzetsel (meestal "in" of "voor", bijv. "in Rheden"). Voeg geen overtollige/onlogische toevoegingen toe zoals "in Nederland" als er al een specifieke plaatsnaam is genoemd.
4. Output uitsluitend de 3 vragen gescheiden door een verticale streep (|) zonder nummering of andere tekst.

Voorbeeld van goede output voor het zoekwoord "hoveniersbedrijf rheden":
Wat kost een hoveniersbedrijf in Rheden gemiddeld? | Wie is de best beoordeelde hovenier in Rheden? | Waar moet ik op letten bij het inschakelen van een hoveniersbedrijf in Rheden?`;

  try {
    const aiResponse = await queryGemini({ prompt: promptMessage, companyName });
    let prompts = [];
    if (aiResponse && aiResponse.text && aiResponse.text.includes('|')) {
      prompts = aiResponse.text.split('|').map(p => p.trim()).filter(Boolean);
    }

    // FAQ Niche fallbacks if AI fails
    if (prompts.length < 3) {
      prompts = [
        `Wat kost een specialist gemiddeld voor ${keyword}?`,
        `Wie is de best beoordeelde partij voor ${keyword}?`,
        `Waar moet ik op letten bij het inschakelen van een expert voor ${keyword}?`
      ];
    }

    res.json({ success: true, prompts: prompts.slice(0, 3) });
  } catch (err) {
    console.error('Error generating prompts:', err);
    res.status(500).json({ error: 'Failed to generate prompts' });
  }
});

// POST /api/prompts - Create a new tracked prompt
router.post('/', async (req, res) => {
  const { company, text, tag, engines, keyword_id } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Prompt tekst is verplicht.' });
  }

  const companyKey = (company || 'saleswizard').toLowerCase().replace('.nl', '').trim();

  try {
    const defaultEngines = engines || { chatgpt: true, gemini: true, perplexity: true, copilot: true, claude: true, aio: true };
    const [newId] = await db('prompts').insert({
      company_key: companyKey,
      keyword_id: keyword_id ? parseInt(keyword_id) : null,
      prompt_text: text.trim(),
      category: tag || 'Algemeen',
      response_summary: 'Wachtend op achtergrond scan...',
      brand_mentioned: false,
      position: null,
      sentiment: 'N/A',
      engine: 'ChatGPT',
      status: 'pending',
      engines: JSON.stringify(defaultEngines)
    });

    const insertedPrompt = await db('prompts').where('id', newId).first();

    // Trigger background process
    enqueueScrape(newId);

    res.status(201).json({
      success: true,
      prompt: {
        id: insertedPrompt.id,
        text: insertedPrompt.prompt_text,
        tag: insertedPrompt.category,
        engines: defaultEngines,
        mentioned: false,
        position: null,
        sentiment: 'N/A',
        status: 'pending',
        dateAdded: new Date().toISOString().split('T')[0]
      }
    });
  } catch (err) {
    console.error('Error saving prompt to database:', err);
    res.status(500).json({ error: 'Fout bij opslaan van prompt in database.' });
  }
});

// POST /api/prompts/:id/scan - Force trigger background re-scan for a prompt
router.post('/:id/scan', async (req, res) => {
  const { id } = req.params;
  try {
    const promptRecord = await db('prompts').where({ id }).first();
    if (!promptRecord) {
      return res.status(404).json({ error: 'Prompt niet gevonden' });
    }

    await db('prompts').where({ id }).update({
      status: 'pending',
      updated_at: new Date().toISOString()
    });

    enqueueScrape(id);

    res.json({ success: true, message: 'Scan gestart op de achtergrond.' });
  } catch (err) {
    console.error('Error starting scan:', err);
    res.status(500).json({ error: 'Fout bij starten van scan.' });
  }
});

// DELETE /api/prompts/:id - Delete a tracked prompt
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCount = await db('prompts').where('id', id).del();
    if (!deletedCount) {
      return res.status(404).json({ error: 'Prompt niet gevonden' });
    }
    res.json({ success: true, message: 'Prompt succesvol verwijderd' });
  } catch (err) {
    console.error('Error deleting prompt:', err);
    res.status(500).json({ error: 'Fout bij verwijderen van prompt' });
  }
});

// POST /api/prompts/bulk-delete - Delete multiple prompts
router.post('/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Geen geldige IDs opgegeven.' });
  }

  try {
    await db('prompts').whereIn('id', ids).del();
    res.json({ success: true, message: 'Prompts succesvol verwijderd.' });
  } catch (err) {
    console.error('Error bulk deleting prompts:', err);
    res.status(500).json({ error: 'Fout bij bulk verwijderen van prompts' });
  }
});

export default router;
