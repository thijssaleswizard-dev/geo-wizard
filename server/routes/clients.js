import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';

const router = express.Router();

// GET /api/clients - Fetch all workspaces/clients
router.get('/', async (req, res) => {
  try {
    const clients = await db('clients').select('*');
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients from database' });
  }
});

// POST /api/clients - Create a new client workspace
router.post('/', async (req, res) => {
  const { company, name, email, password, subscription } = req.body;

  if (!company || !name || !email) {
    return res.status(400).json({ error: 'Bedrijfsnaam, klantnaam en e-mailadres zijn verplicht.' });
  }

  try {
    const existingClient = await db('clients').where('company', company.trim()).first();
    if (existingClient) {
      return res.status(400).json({ error: 'Deze bedrijfsnaam/workspace bestaat al.' });
    }

    // 1. Insert into clients table
    const [clientId] = await db('clients').insert({
      company: company.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subscription: subscription || 'AI Pro',
      prompts_count: 5,
      visibility_index: 0
    });

    // 2. Also insert into users table if password is provided
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      const klantRole = await db('roles').where('name', 'klant').first();
      const roleId = klantRole ? klantRole.id : 2;

      const existingUser = await db('users').where('email', email.trim().toLowerCase()).first();
      if (!existingUser) {
        await db('users').insert({
          username: name.trim(),
          email: email.trim().toLowerCase(),
          password_hash,
          role_id: roleId,
          company_name: company.trim(),
          subscription: subscription || 'AI Pro',
          addon_prompts: 0
        });
      }
    }

    const newClient = await db('clients').where('id', clientId).first();

    res.status(201).json({
      success: true,
      client: {
        company: newClient.company,
        name: newClient.name,
        email: newClient.email,
        subscription: newClient.subscription,
        promptsCount: newClient.prompts_count,
        visibilityIndex: newClient.visibility_index
      }
    });
  } catch (err) {
    console.error('Error creating client workspace:', err);
    res.status(500).json({ error: 'Fout bij aanmaken van klant in database.' });
  }
});

export default router;
