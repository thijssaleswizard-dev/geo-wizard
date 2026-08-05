import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { getPayment, createSubscription } from '../services/mollieService.js';
import { generateInvoice } from '../services/invoiceService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for mapping packages to their prices and names
const PACKAGES = {
  starter: { name: 'AI/GEO Starter pakket', price: 195.00 },
  pro: { name: 'AI/GEO Pro pakket', price: 350.00 },
  top: { name: 'AI/GEO Top pakket', price: 700.00 }
};

/**
 * GET /api/payments/invoices
 * Haal alle facturen op van de ingelogde gebruiker
 */
router.get('/invoices', async (req, res) => {
  // Let op: in een echte productie app zouden we hier sessie/token-gebaseerde auth gebruiken.
  // Voor nu halen we het user_id uit de query of headers voor demo doeleinden.
  const userId = req.query.userId || req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Niet geautoriseerd.' });
  }

  try {
    const invoices = await db('invoices')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');

    res.json({ success: true, invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Interne fout bij ophalen van facturen.' });
  }
});

/**
 * GET /api/payments/invoices/download/:filename
 * Toon de gegenereerde HTML factuur in de browser
 */
router.get('/invoices/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'invoices', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Factuur niet gevonden.');
  }

  res.sendFile(filePath);
});

/**
 * POST /api/payments/webhook
 * Mollie Webhook om status-updates van betalingen te ontvangen
 */
router.post('/webhook', async (req, res) => {
  const { id: paymentId } = req.body;
  if (!paymentId) {
    return res.status(400).send('Missing payment ID');
  }

  try {
    console.log(`[Mollie Webhook] Betalingsupdate ontvangen voor ${paymentId}`);
    
    // Haal betalingsgegevens op
    const payment = await getPayment(paymentId);
    
    if (payment.status === 'paid') {
      // Zoek gebruiker behorende bij deze Mollie klant of betaling
      // Mollie laat ons metadata meesturen, in mock/live mode kunnen we ook zoeken op customerId
      const customerId = payment.customerId || payment.metadata?.customerId;
      const userId = payment.metadata?.userId;

      let user;
      if (userId) {
        user = await db('users').where({ id: userId }).first();
      } else if (customerId) {
        user = await db('users').where({ mollie_customer_id: customerId }).first();
      }

      if (!user) {
        console.warn(`[Mollie Webhook] Geen gebruiker gevonden voor betaling ${paymentId}`);
        return res.status(200).send('OK but user not found');
      }

      // Check of de betaling al is verwerkt
      if (user.payment_status === 'paid') {
        console.log(`[Mollie Webhook] Betaling al verwerkt voor user ${user.id}`);
        return res.status(200).send('OK');
      }

      // Bepaal pakket details
      const packageKey = user.subscription.toLowerCase().replace('ai/geo ', '').replace(' pakket', '').trim();
      const pack = PACKAGES[packageKey] || PACKAGES.pro; // Default naar pro als er iets misgaat

      // 1. Update status van gebruiker naar 'paid'
      await db('users')
        .where({ id: user.id })
        .update({ payment_status: 'paid' });

      // 2. Maak recurring subscription aan in Mollie
      const subscription = await createSubscription({
        customerId: user.mollie_customer_id,
        amount: pack.price.toFixed(2),
        description: `GEO-Wizard - ${pack.name} Abonnement`
      });

      // Update de user met het subscription ID
      await db('users')
        .where({ id: user.id })
        .update({ mollie_subscription_id: subscription.id });

      // 3. Genereer de eerste factuur (opstartkosten + eerste maand)
      await generateInvoice({
        userId: user.id,
        packageName: pack.name,
        packagePrice: pack.price,
        isFirstInvoice: true
      });

      console.log(`[Mollie Webhook] Betaling succesvol verwerkt. User ${user.id} is nu actief.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * POST /api/payments/simulate-payment
 * Ontwikkelaarsroute om een succesvolle betaling te simuleren lokaal
 */
router.post('/simulate-payment', async (req, res) => {
  const { paymentId, customerId, userId } = req.body;

  try {
    console.log(`[Simulatie Betaling] Handmatige betalingstrigger ontvangen voor User ${userId}`);
    
    // We roepen intern de webhook logica aan met een mock object
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    const packageKey = user.subscription.toLowerCase().replace('ai/geo ', '').replace(' pakket', '').trim();
    const pack = PACKAGES[packageKey] || PACKAGES.pro;

    // Update status naar paid
    await db('users')
      .where({ id: userId })
      .update({ payment_status: 'paid', mollie_customer_id: customerId });

    // Simuleer subscription aanmaak
    const mockSubscriptionId = `sub_mock_${Math.random().toString(36).substring(2, 10)}`;
    await db('users')
      .where({ id: userId })
      .update({ mollie_subscription_id: mockSubscriptionId });

    // Genereer de factuur
    await generateInvoice({
      userId: userId,
      packageName: pack.name,
      packagePrice: pack.price,
      isFirstInvoice: true
    });

    res.json({ success: true, message: 'Betaling en factuur succesvol gesimuleerd.' });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: 'Interne fout bij simulatie.' });
  }
});

export default router;
