import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { createCustomer, createFirstPayment } from '../services/mollieService.js';

const router = express.Router();

const PACKAGES = {
  starter: { name: 'AI/GEO Starter pakket', price: 195.00, totalFirst: 945.00 },
  pro: { name: 'AI/GEO Pro pakket', price: 350.00, totalFirst: 1100.00 },
  top: { name: 'AI/GEO Top pakket', price: 700.00, totalFirst: 1450.00 }
};

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
        'users.payment_status',
        'users.mollie_customer_id',
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

    // Check payment status for customers
    if (user.role === 'klant' && user.payment_status !== 'paid') {
      // Genereer opnieuw een checkout URL zodat ze de betaling kunnen afronden
      const packageKey = user.subscription.toLowerCase().replace('ai/geo ', '').replace(' pakket', '').trim();
      const pack = PACKAGES[packageKey] || PACKAGES.pro;

      const firstPayment = await createFirstPayment({
        customerId: user.mollie_customer_id,
        amount: pack.totalFirst.toFixed(2),
        description: `Eerste betaling + Opstartkosten: ${pack.name}`,
        redirectUrl: `http://localhost:5173/?payment_success=true&userId=${user.id}`,
        webhookUrl: `http://localhost:5002/api/payments/webhook`
      });

      return res.status(402).json({
        success: false,
        needs_payment: true,
        checkoutUrl: firstPayment._links.checkout.href,
        userId: user.id,
        customerId: user.mollie_customer_id,
        error: 'Betaling is nog niet afgerond. U wordt omgeleid naar de betaalpagina.'
      });
    }

    let companyName = 'Saleswizard B.V.';
    if (user.role === 'klant') {
      const firstProject = await db('user_projects')
        .join('projects', 'user_projects.project_id', '=', 'projects.id')
        .where('user_projects.user_id', user.id)
        .select('projects.company')
        .first();
      if (firstProject) {
        companyName = firstProject.company;
      } else {
        companyName = user.company_name || 'Saleswizard B.V.';
      }
    } else {
      companyName = user.company_name || 'Saleswizard B.V.';
    }
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

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, companyName, subscriptionKey } = req.body;

  if (!username || !email || !password || !companyName || !subscriptionKey) {
    return res.status(400).json({ error: 'Vul alstublieft alle verplichte velden in.' });
  }

  const pack = PACKAGES[subscriptionKey.toLowerCase()];
  if (!pack) {
    return res.status(400).json({ error: 'Ongeldig pakket geselecteerd.' });
  }

  try {
    // Check if user already exists
    const existingUser = await db('users').where({ email: email.trim().toLowerCase() }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    }

    // Get role ID for 'klant'
    const klantRole = await db('roles').where({ name: 'klant' }).first();
    if (!klantRole) {
      return res.status(500).json({ error: 'Klantrol niet gevonden in database.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create Mollie Customer first
    const mollieCustomer = await createCustomer(email.trim().toLowerCase(), username);

    // Insert user with 'pending' payment status
    const [userId] = await db('users').insert({
      username: username,
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role_id: klantRole.id,
      company_name: companyName,
      subscription: pack.name,
      addon_prompts: 0,
      payment_status: 'pending',
      mollie_customer_id: mollieCustomer.id
    });

    // Create the first payment in Mollie (Setup costs + first month subscription fee)
    const firstPayment = await createFirstPayment({
      customerId: mollieCustomer.id,
      amount: pack.totalFirst.toFixed(2),
      description: `Eerste betaling + Opstartkosten: ${pack.name}`,
      redirectUrl: `http://localhost:5173/?payment_success=true&userId=${userId}`,
      webhookUrl: `http://localhost:5002/api/payments/webhook`
    });

    res.status(201).json({
      success: true,
      message: 'Registratie succesvol. Rond de betaling af om uw account te activeren.',
      userId,
      customerId: mollieCustomer.id,
      checkoutUrl: firstPayment._links.checkout.href
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Interne serverfout bij registreren.' });
  }
});

export default router;

