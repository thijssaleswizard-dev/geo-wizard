import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/prompts - Fetch prompts for a company
router.get('/', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '').trim();
  try {
    const prompts = await db('prompts').where({ company_key: companyKey }).orderBy('id', 'desc');
    
    // Format response to match expected frontend structure
    const formatted = prompts.map(p => ({
      id: p.id,
      text: p.prompt_text,
      tag: p.category || 'Algemeen',
      engines: typeof p.engines === 'string' ? JSON.parse(p.engines) : (p.engines || { chatgpt: true, gemini: true, perplexity: true, copilot: true, claude: true, aio: true }),
      mentioned: Boolean(p.brand_mentioned),
      position: p.position,
      sentiment: p.sentiment || '+90',
      dateAdded: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    }));

    res.json({ success: true, prompts: formatted });
  } catch (err) {
    console.error('Error fetching prompts:', err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// POST /api/prompts - Create a new tracked prompt
router.post('/', async (req, res) => {
  const { company, text, tag, engines } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Prompt tekst is verplicht.' });
  }

  const companyKey = (company || 'saleswizard').toLowerCase().replace('.nl', '').trim();

  try {
    const mentioned = Math.random() > 0.3;
    const position = mentioned ? Math.floor(Math.random() * 3) + 1 : null;

    const [newId] = await db('prompts').insert({
      company_key: companyKey,
      prompt_text: text.trim(),
      category: tag || 'Algemeen',
      response_summary: `AI analyse voor "${text.trim()}"`,
      brand_mentioned: mentioned,
      position: position,
      sentiment: '+92',
      engine: 'ChatGPT'
    });

    const insertedPrompt = await db('prompts').where('id', newId).first();

    res.status(201).json({
      success: true,
      prompt: {
        id: insertedPrompt.id,
        text: insertedPrompt.prompt_text,
        tag: insertedPrompt.category,
        engines: engines || { chatgpt: true, gemini: true, perplexity: true, copilot: true, claude: true, aio: true },
        mentioned: Boolean(insertedPrompt.brand_mentioned),
        position: insertedPrompt.position,
        sentiment: insertedPrompt.sentiment,
        dateAdded: new Date().toISOString().split('T')[0]
      }
    });
  } catch (err) {
    console.error('Error saving prompt to database:', err);
    res.status(500).json({ error: 'Fout bij opslaan van prompt in database.' });
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

export default router;
