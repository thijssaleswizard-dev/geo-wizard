import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
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

// POST /api/auth/register (Disabled: Only Admins can create users)
router.post('/register', async (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Publieke registratie is uitgeschakeld. Alleen beheerders kunnen nieuwe gebruikers aanmaken.'
  });
});

export default router;
