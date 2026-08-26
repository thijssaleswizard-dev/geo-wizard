import React, { useState } from 'react';
import { CreditCard, CheckCircle, Shield, ArrowRight, Loader2 } from 'lucide-react';

export default function PaymentSimulator({ paymentId, customerId, amount, description, userId, onPaymentComplete }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleCompletePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/payments/simulate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId,
          customerId,
          userId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Simulatie betaling mislukt.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      
      // Wacht 2 seconden en keer terug naar de app
      setTimeout(() => {
        onPaymentComplete();
      }, 2000);

    } catch (err) {
      console.error('Simulation payment error:', err);
      setError('Kan geen verbinding maken met de server om betaling te simuleren.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#f4f5f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      color: '#1a1a1a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
        border: '1px solid #e1e4e6',
        overflow: 'hidden'
      }}>
        {/* Mollie Header */}
        <div style={{
          backgroundColor: '#3f51b5',
          color: 'white',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Mollie Test Gateway
            </div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 700 }}>
              Simuleer Uw Betaling
            </h2>
          </div>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 600
          }}>
            TEST MODUS
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Success screen */}
          {success ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', padding: '20px 0' }}>
              <div style={{ color: '#2e7d32' }}>
                <CheckCircle size={64} />
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#2e7d32' }}>
                Betaling Geslaagd!
              </h3>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                Uw betaling is succesvol verwerkt. Uw abonnement is nu actief en uw eerste factuur is gegenereerd. U wordt nu teruggestuurd naar de portal...
              </p>
            </div>
          ) : (
            <>
              {/* Error alert */}
              {error && (
                <div style={{
                  backgroundColor: '#ffebee',
                  border: '1px solid #ffcdd2',
                  borderRadius: '6px',
                  padding: '12px',
                  color: '#c62828',
                  fontSize: '13px'
                }}>
                  {error}
                </div>
              )}

              {/* Transaction Summary */}
              <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6c757d' }}>
                  <span>Omschrijving</span>
                  <span style={{ fontWeight: 600, color: '#212529' }}>{description}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6c757d' }}>
                  <span>Klant ID</span>
                  <span style={{ fontFamily: 'monospace', color: '#212529' }}>{customerId}</span>
                </div>
                <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Totaal te betalen</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#3f51b5' }}>
                    € {Number(amount).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
                  Kies een betaalmethode (Gesimuleerd)
                </h4>
                
                <div style={{
                  border: '2px solid #3f51b5',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  backgroundColor: '#f5f7ff'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '6px',
                    backgroundColor: '#e8eaf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3f51b5'
                  }}>
                    <CreditCard size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>iDEAL / SEPA Direct Debit</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Automatische incasso voor toekomstige termijnen</div>
                  </div>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: '5px solid #3f51b5',
                    backgroundColor: 'white'
                  }} />
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={handleCompletePayment}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#3f51b5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 4px 12px rgba(63, 81, 181, 0.2)'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#303f9f')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#3f51b5')}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Bezig met verwerken...
                  </>
                ) : (
                  <>
                    Voltooi Betaling (€ {Number(amount).toFixed(2).replace('.', ',')})
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Secure badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#6c757d', marginTop: '-8px' }}>
                <Shield size={14} style={{ color: '#2e7d32' }} />
                Beveiligde SSL-verbinding via Mollie sandbox
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
