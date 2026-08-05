import axios from 'axios';

const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY || '';
const IS_MOCK_MODE = !MOLLIE_API_KEY;

if (IS_MOCK_MODE) {
  console.log('⚠️  MOLLIE_API_KEY is niet geconfigureerd in .env. Mollie draait nu in SIMULATIE modus.');
}

const mollieApi = axios.create({
  baseURL: 'https://api.mollie.com/v2',
  headers: {
    Authorization: `Bearer ${MOLLIE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Maak een Mollie Customer aan
 */
export async function createCustomer(email, name) {
  if (IS_MOCK_MODE) {
    const mockId = `cst_mock_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`[Mollie Mock] Customer aangemaakt voor ${name} (${email}) -> ID: ${mockId}`);
    return { id: mockId, name, email };
  }

  try {
    const response = await mollieApi.post('/customers', { name, email });
    return response.data;
  } catch (error) {
    console.error('Mollie createCustomer error:', error.response?.data || error.message);
    throw new Error('Fout bij het aanmaken van Mollie klant.');
  }
}

/**
 * Maak de eerste betaling aan om een mandaat te verkrijgen
 */
export async function createFirstPayment({ customerId, amount, description, redirectUrl, webhookUrl, userId }) {
  if (IS_MOCK_MODE) {
    const mockPaymentId = `tr_mock_${Math.random().toString(36).substring(2, 10)}`;
    // De mock redirectUrl leidt naar onze lokale payment simulator component
    const simulatedCheckoutUrl = `http://localhost:5173/?simulate_payment=true&payment_id=${mockPaymentId}&customer_id=${customerId}&amount=${amount}&description=${encodeURIComponent(description)}&userId=${userId}`;
    
    console.log(`[Mollie Mock] Eerste betaling aangemaakt. ID: ${mockPaymentId}. Checkout URL: ${simulatedCheckoutUrl}`);
    return {
      id: mockPaymentId,
      status: 'open',
      amount: { currency: 'EUR', value: amount },
      description,
      _links: {
        checkout: {
          href: simulatedCheckoutUrl
        }
      }
    };
  }

  try {
    const response = await mollieApi.post('/payments', {
      amount: {
        currency: 'EUR',
        value: Number(amount).toFixed(2)
      },
      description,
      redirectUrl,
      webhookUrl,
      customerId,
      sequenceType: 'first'
    });
    return response.data;
  } catch (error) {
    console.error('Mollie createFirstPayment error:', error.response?.data || error.message);
    throw new Error('Fout bij het aanmaken van Mollie betaling.');
  }
}

/**
 * Maak een doorlopend abonnement aan (Recurring Subscription)
 */
export async function createSubscription({ customerId, amount, description, interval = '1 month' }) {
  if (IS_MOCK_MODE) {
    const mockSubscriptionId = `sub_mock_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`[Mollie Mock] Recurring abonnement aangemaakt voor klant ${customerId}. ID: ${mockSubscriptionId}, Bedrag: €${amount} p/m`);
    return {
      id: mockSubscriptionId,
      customerId,
      status: 'active',
      amount: { currency: 'EUR', value: amount },
      interval,
      description
    };
  }

  try {
    const response = await mollieApi.post(`/customers/${customerId}/subscriptions`, {
      amount: {
        currency: 'EUR',
        value: Number(amount).toFixed(2)
      },
      interval,
      description,
      webhookUrl: process.env.MOLLIE_WEBHOOK_URL || undefined
    });
    return response.data;
  } catch (error) {
    console.error('Mollie createSubscription error:', error.response?.data || error.message);
    throw new Error('Fout bij het aanmaken van Mollie abonnement.');
  }
}

/**
 * Haal betalingsgegevens op (bijv. in de webhook)
 */
export async function getPayment(paymentId) {
  if (IS_MOCK_MODE) {
    return {
      id: paymentId,
      status: 'paid', // In mock mode simuleren we dat het betaald is
      customerId: 'cst_mock_placeholder'
    };
  }

  try {
    const response = await mollieApi.get(`/payments/${paymentId}`);
    return response.data;
  } catch (error) {
    console.error('Mollie getPayment error:', error.response?.data || error.message);
    throw new Error('Fout bij het ophalen van Mollie betaling.');
  }
}
