import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { getApiStatus, getApiHistory, queryGemini } from '../services/aiEngine.js';
import { enqueueScrape } from '../services/queue.js';

const router = express.Router();

// GET /api/projects - Fetch all workspaces/projects (filtered for klant users)
router.get('/', async (req, res) => {
  const { userId, role } = req.query;
  try {
    let query = db('projects');
    
    if (role === 'klant' && userId) {
      query = query
        .join('user_projects', 'projects.id', '=', 'user_projects.project_id')
        .where('user_projects.user_id', userId)
        .select('projects.*');
    } else {
      query = query.select('*');
    }

    const projects = await query;
    
    // Count keywords per project from the database
    const keywordsCounts = await db('keywords')
      .select('company_key')
      .count('id as count')
      .groupBy('company_key');

    // Count prompts per project from the database
    const promptsCounts = await db('prompts')
      .select('company_key')
      .count('id as count')
      .groupBy('company_key');

    const keywordsMap = {};
    keywordsCounts.forEach(item => {
      keywordsMap[item.company_key] = item.count;
    });

    const promptsMap = {};
    promptsCounts.forEach(item => {
      promptsMap[item.company_key] = item.count;
    });

    const projectsWithCounts = projects.map(proj => {
      const companyKey = proj.company.toLowerCase().replace('.nl', '').trim();
      return {
        ...proj,
        keywordsCount: keywordsMap[companyKey] || 0,
        promptsCount: promptsMap[companyKey] || 0
      };
    });

    // Keep 'clients' as key in JSON response to maintain frontend compatibility
    res.json({ success: true, clients: projectsWithCounts });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects from database' });
  }
});

async function startBackgroundSetup(company, keywordsString) {
  const companyKey = company.toLowerCase().replace('.nl', '').trim();
  const rawKeywords = keywordsString.split(',').map(k => k.trim()).filter(Boolean);

  if (rawKeywords.length === 0) {
    await db('projects').where({ company }).update({ setup_status: 'completed', setup_progress: 100 });
    return;
  }

  try {
    let completedCount = 0;
    const totalSteps = rawKeywords.length;

    for (let i = 0; i < rawKeywords.length; i++) {
      const kw = rawKeywords[i];

      // 1. Insert keyword into db
      let keywordId;
      try {
        const [insertedId] = await db('keywords').insert({
          company_key: companyKey,
          keyword: kw,
          rank: 1,
          search_engine: 'ChatGPT',
          sentiment: '+90',
          citations_count: 1,
          monthly_searches: 100
        });
        keywordId = insertedId;
      } catch (err) {
        console.error('Error inserting keyword in background:', err);
        continue;
      }

      // 2. Generate prompts using Gemini
      const promptMessage = `We hebben een bedrijf genaamd "${company}" en het zoekwoord "${kw}".
Genereer exact 3 veelgestelde, natuurlijke consumentenvragen (FAQ-vragen) in het Nederlands die mensen stellen in AI-zoekmachines (zoals ChatGPT of Gemini) wanneer ze informatie zoeken over "${kw}".

Kwaliteitseisen voor de vragen:
1. Ze moeten klinken als natuurlijk geschreven vragen door een mens (bijv: "Wat kost...?", "Wie is de beste...?", "Hoe vind ik...?").
2. Integratie van het zoekwoord: Verwerk het zoekwoord "${kw}" op een grammaticaal correcte en vloeiende manier in de zin.
3. Locatie-afhandeling: Als het zoekwoord een plaatsnaam of regio bevat, schrijf de plaatsnaam met een hoofdletter en gebruik een passend voorzetsel (meestal "in" of "voor").
4. Output uitsluitend de 3 vragen gescheiden door een verticale streep (|) zonder nummering of andere tekst.`;

      let prompts = [];
      try {
        const aiResponse = await queryGemini({ prompt: promptMessage, companyName: company });
        if (aiResponse && aiResponse.text && aiResponse.text.includes('|')) {
          prompts = aiResponse.text.split('|').map(p => p.trim()).filter(Boolean);
        }
      } catch (aiErr) {
        console.error('Error generating prompts in background setup:', aiErr);
      }

      if (prompts.length < 3) {
        prompts = [
          `Wat kost een specialist gemiddeld voor ${kw}?`,
          `Wie is de best beoordeelde partij voor ${kw}?`,
          `Waar moet ik op letten bij het inschakelen van een expert voor ${kw}?`
        ];
      }

      // 3. Insert prompts and trigger enqueueScrape
      const defaultEngines = { chatgpt: true, gemini: true, perplexity: true, copilot: true, claude: true, aio: true };
      for (const pText of prompts.slice(0, 3)) {
        try {
          const [pId] = await db('prompts').insert({
            company_key: companyKey,
            keyword_id: keywordId,
            prompt_text: pText.trim(),
            category: 'AI Generated',
            response_summary: 'Wachtend op achtergrond scan...',
            brand_mentioned: false,
            position: null,
            sentiment: 'N/A',
            engine: 'ChatGPT',
            status: 'pending',
            engines: JSON.stringify(defaultEngines)
          });
          enqueueScrape(pId);
        } catch (promptInsertErr) {
          console.error('Error inserting prompt in background setup:', promptInsertErr);
        }
      }

      // 4. Update progress
      completedCount++;
      const progressPercent = Math.min(Math.round((completedCount / totalSteps) * 100), 95);
      await db('projects').where({ company }).update({
        setup_status: 'processing',
        setup_progress: progressPercent
      });
    }

    // Done!
    await db('projects').where({ company }).update({
      setup_status: 'completed',
      setup_progress: 100
    });
  } catch (err) {
    console.error('Error in background setup runner:', err);
    await db('projects').where({ company }).update({
      setup_status: 'completed',
      setup_progress: 100
    });
  }
}

// POST /api/projects - Create a new project workspace
router.post('/', async (req, res) => {
  const { company, name, email, password, subscription, keywords } = req.body;

  if (!company || !name || !email) {
    return res.status(400).json({ error: 'Bedrijfsnaam, klantnaam en e-mailadres zijn verplicht.' });
  }

  try {
    const existingProject = await db('projects').where('company', company.trim()).first();
    if (existingProject) {
      return res.status(400).json({ error: 'Deze bedrijfsnaam/workspace bestaat al.' });
    }

    const hasKeywords = keywords && keywords.trim().length > 0;

    // 1. Insert into projects table
    const [projectId] = await db('projects').insert({
      company: company.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subscription: subscription || 'AI Pro',
      prompts_count: 5,
      visibility_index: 0,
      setup_status: hasKeywords ? 'processing' : 'completed',
      setup_progress: hasKeywords ? 0 : 100
    });

    // 2. Also insert into users table if password is provided
    let userId;
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      const klantRole = await db('roles').where('name', 'klant').first();
      const roleId = klantRole ? klantRole.id : 2;

      const existingUser = await db('users').where('email', email.trim().toLowerCase()).first();
      if (!existingUser) {
        const [insertedUserId] = await db('users').insert({
          username: name.trim(),
          email: email.trim().toLowerCase(),
          password_hash,
          role_id: roleId,
          company_name: company.trim(),
          subscription: subscription || 'AI Pro',
          addon_prompts: 0
        });
        userId = insertedUserId;
      } else {
        userId = existingUser.id;
      }
    } else {
      const existingUser = await db('users').where('email', email.trim().toLowerCase()).first();
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    // 3. Link user to the project in user_projects table
    if (userId) {
      await db('user_projects').insert({
        user_id: userId,
        project_id: projectId
      });
    }

    const newProject = await db('projects').where('id', projectId).first();

    // Start background keywords setup
    if (hasKeywords) {
      startBackgroundSetup(company.trim(), keywords).catch(err => {
        console.error('Error starting background setup:', err);
      });
    }

    res.status(201).json({
      success: true,
      client: {
        id: newProject.id,
        company: newProject.company,
        name: newProject.name,
        email: newProject.email,
        subscription: newProject.subscription,
        promptsCount: newProject.prompts_count,
        visibilityIndex: newProject.visibility_index,
        setup_status: newProject.setup_status,
        setup_progress: newProject.setup_progress
      }
    });
  } catch (err) {
    console.error('Error creating project workspace:', err);
    res.status(500).json({ error: 'Fout bij aanmaken van project in database.' });
  }
});

// PUT /api/projects/:id - Edit an existing project workspace
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, subscription } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Projectnaam en e-mailadres zijn verplicht.' });
  }

  try {
    const existingProject = await db('projects').where('id', id).first();
    if (!existingProject) {
      return res.status(404).json({ error: 'Project niet gevonden.' });
    }

    // 1. Update projects table
    await db('projects')
      .where('id', id)
      .update({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subscription: subscription || existingProject.subscription,
        updated_at: new Date().toISOString()
      });

    // 2. Also update associated user account in users table if the email matches the old one
    await db('users')
      .where('email', existingProject.email)
      .update({
        username: name.trim(),
        email: email.trim().toLowerCase(),
        subscription: subscription || existingProject.subscription
      });

    const updatedProject = await db('projects').where('id', id).first();

    res.json({
      success: true,
      message: 'Project succesvol bijgewerkt.',
      client: {
        id: updatedProject.id,
        company: updatedProject.company,
        name: updatedProject.name,
        email: updatedProject.email,
        subscription: updatedProject.subscription,
        promptsCount: updatedProject.prompts_count,
        visibilityIndex: updatedProject.visibility_index
      }
    });
  } catch (err) {
    console.error('Error updating project workspace:', err);
    res.status(500).json({ error: 'Fout bij bijwerken van project in database.' });
  }
});

// DELETE /api/projects/:company - Delete a project workspace and its associated data
router.delete('/:company', async (req, res) => {
  const { company } = req.params;
  const decodedCompany = decodeURIComponent(company).trim();
  const companyKey = decodedCompany.toLowerCase().replace('.nl', '').trim();

  try {
    const projRecord = await db('projects').whereRaw('LOWER(company) = ?', [decodedCompany.toLowerCase()]).first();
    if (projRecord) {
      // Delete user_projects mappings first (FK relation)
      await db('user_projects').where({ project_id: projRecord.id }).del();
    }

    // Delete project workspace record
    await db('projects').whereRaw('LOWER(company) = ?', [decodedCompany.toLowerCase()]).del();
    
    // Delete all linked keywords
    await db('keywords').where({ company_key: companyKey }).del();
    
    // Delete all linked prompts
    await db('prompts').where({ company_key: companyKey }).del();

    // Delete all linked citations
    await db('citations').where({ company_key: companyKey }).del();

    // Delete all linked client users
    await db('users')
      .whereRaw('LOWER(company_name) = ?', [decodedCompany.toLowerCase()])
      .orWhereRaw('LOWER(company_name) = ?', [companyKey])
      .del();

    res.json({ success: true, message: `Project "${decodedCompany}" succesvol verwijderd.` });
  } catch (err) {
    console.error('Error deleting project workspace:', err);
    res.status(500).json({ error: 'Fout bij verwijderen van project in database.' });
  }
});

// GET /api/projects/api-monitor/status - Fetch live API key status and history logs
router.get('/api-monitor/status', (req, res) => {
  try {
    const status = getApiStatus();
    const history = getApiHistory();
    res.json({ success: true, status, history });
  } catch (err) {
    console.error('Error fetching API monitor stats:', err);
    res.status(500).json({ error: 'Fout bij ophalen van API monitor data.' });
  }
});

export default router;
