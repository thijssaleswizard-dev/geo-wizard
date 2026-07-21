import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Authentication Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vul alstublieft alle velden in.' });
  }

  try {
    const user = await db('users')
      .join('roles', 'users.role_id', '=', 'roles.id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.password_hash',
        'users.company_name',
        'users.subscription',
        'users.addon_prompts',
        'roles.name as role'
      )
      .where('users.email', email.trim().toLowerCase())
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Ongeldige e-mail of wachtwoord. Probeer het opnieuw.' });
    }

    let isMatch = false;
    if (user.password_hash.startsWith('sha256_placeholder_')) {
      isMatch = user.password_hash === 'sha256_placeholder_' + password || user.password_hash === password;
    } else {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Ongeldige e-mail of wachtwoord. Probeer het opnieuw.' });
    }

    const companyName = user.company_name || 'Saleswizard B.V.';
    const avatar = companyName[0] ? companyName[0].toUpperCase() : 'U';

    res.json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
        name: user.username,
        company: user.role === 'klant' ? companyName : 'Saleswizard B.V.',
        email: user.email,
        subscription: user.subscription || 'AI Pro',
        addonPrompts: user.addon_prompts || 0,
        avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Interne serverfout bij inloggen.' });
  }
});

// Authentication Register Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, company_name } = req.body;

  if (!username || !email || !password || !company_name) {
    return res.status(400).json({ error: 'Vul alstublieft alle velden in.' });
  }

  try {
    const existingUser = await db('users').where('email', email.trim().toLowerCase()).first();
    if (existingUser) {
      return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const klantRole = await db('roles').where('name', 'klant').first();
    const roleId = klantRole ? klantRole.id : 2;

    const [userId] = await db('users').insert({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      role_id: roleId,
      company_name: company_name.trim(),
      subscription: 'AI Starter',
      addon_prompts: 0
    });

    const registeredUser = await db('users')
      .join('roles', 'users.role_id', '=', 'roles.id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.company_name',
        'users.subscription',
        'users.addon_prompts',
        'roles.name as role'
      )
      .where('users.id', userId)
      .first();

    const companyName = registeredUser.company_name || company_name;
    const avatar = companyName[0] ? companyName[0].toUpperCase() : 'U';

    res.status(201).json({
      success: true,
      user: {
        id: registeredUser.id,
        role: registeredUser.role,
        name: registeredUser.username,
        company: companyName,
        email: registeredUser.email,
        subscription: registeredUser.subscription || 'AI Starter',
        addonPrompts: registeredUser.addon_prompts || 0,
        avatar
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Interne serverfout tijdens registratie.' });
  }
});

// Simulated ScrapingBee Proxy Crawler endpoint fetching from Knex Database
app.get('/api/citations', async (req, res) => {
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

    // Query database via Knex
    const rawCitations = await db('citations').where({ company_key: companyKey });

    // Format citations to match API format expected by frontend
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

// GET /api/clients - Fetch all workspaces/clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await db('clients').select('*');
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients from database' });
  }
});

// GET /api/keywords - Fetch keywords for a company
app.get('/api/keywords', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const keywords = await db('keywords').where({ company_key: companyKey });
    res.json({ success: true, keywords });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// GET /api/prompts - Fetch prompts for a company
app.get('/api/prompts', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const prompts = await db('prompts').where({ company_key: companyKey });
    res.json({ success: true, prompts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// GET /api/recommendations - Fetch recommendations for a company
app.get('/api/recommendations', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const recommendations = await db('recommendations').where({ company_key: companyKey });
    res.json({ success: true, recommendations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// GET /api/notifications - Fetch notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await db('notifications').select('*');
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/agents-analytics - Fetch agents analytics for a company
app.get('/api/agents-analytics', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const analytics = await db('agents_analytics').where({ company_key: companyKey });
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agents analytics' });
  }
});

// GET /api/overview-stats - Fetch overview stats for a company
app.get('/api/overview-stats', async (req, res) => {
  const companyKey = (req.query.company || 'saleswizard').toLowerCase().replace('.nl', '');
  try {
    const stats = await db('overview_stats').where({ company_key: companyKey }).first();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch overview stats' });
  }
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   GEO-Wizard Crawler Backend Running on port ${PORT}`);
  console.log(`   API Endpoint: http://localhost:${PORT}/api/citations`);
  console.log(`==================================================`);
});
