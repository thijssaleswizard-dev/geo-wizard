import React, { useState } from 'react';
import { ShieldCheck, User, Lock, ArrowRight, Building, Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isRegister) {
      if (!name || !companyName || !email || !password) {
        setError('Vul alstublieft alle velden in om te registreren.');
        return;
      }
    } else {
      if (!email || !password) {
        setError('Vul alstublieft alle velden in om in te loggen.');
        return;
      }
    }

    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister
      ? { username: name, company_name: companyName, email, password }
      : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || (isRegister ? 'Registratie mislukt.' : 'Ongeldige inloggegevens.'));
        setLoading(false);
        return;
      }

      setLoading(false);
      onLogin(data.user);
    } catch (err) {
      console.error('Auth network error:', err);
      setError('Kan geen verbinding maken met de server. Controleer of de backend draait op poort 5002.'.err);
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'radial-gradient(circle at center, #1f143a 0%, #0b0717 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflowY: 'auto'
    }}>

      <div className="fade-in" style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'rgba(21, 15, 36, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(167, 139, 250, 0.15)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '40px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>

        {/* Logo and Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'var(--brand-accent-gradient)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '28px',
            fontFamily: "'Outfit', sans-serif",
            boxShadow: '0 8px 16px rgba(124, 58, 237, 0.3)'
          }}>
            S
          </div>

          <h2 style={{
            color: 'white',
            fontSize: '24px',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            marginTop: '8px'
          }}>
            GEO-Wizard Portaal
          </h2>

          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
            {isRegister ? 'Meld uw organisatie aan voor GEO campagnes.' : 'Beheer uw AI zoekmachine-vindbaarheid & GEO campagnes.'}
          </p>
        </div>

        {/* Tab Toggle (Inloggen / Registreren) */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '4px',
          borderRadius: 'var(--border-radius-sm)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: !isRegister ? 'var(--brand-primary)' : 'transparent',
              color: !isRegister ? 'white' : 'rgba(255,255,255,0.6)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Inloggen
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isRegister ? 'var(--brand-primary)' : 'transparent',
              color: isRegister ? 'white' : 'rgba(255,255,255,0.6)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Registreren
          </button>
        </div>

        {/* Error alert */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '10px 14px',
            color: '#fca5a5',
            fontSize: '12px'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {isRegister && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Uw Naam
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                  <input
                    type="text"
                    placeholder="Jan de Vries"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      paddingLeft: '38px',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      borderRadius: 'var(--border-radius-sm)'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bedrijfsnaam
                </label>
                <div style={{ position: 'relative' }}>
                  <Building size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                  <input
                    type="text"
                    placeholder="Uw Bedrijf B.V."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      paddingLeft: '38px',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      borderRadius: 'var(--border-radius-sm)'
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              E-mailadres
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
              <input
                type="email"
                placeholder="naam@bedrijf.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  paddingLeft: '38px',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: 'var(--border-radius-sm)'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Wachtwoord
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  paddingLeft: '38px',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: 'var(--border-radius-sm)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              backgroundColor: 'var(--brand-primary)',
              color: 'white',
              fontWeight: 700,
              padding: '12px',
              borderRadius: 'var(--border-radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(68, 0, 153, 0.3)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--brand-primary)')}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" />
                {isRegister ? 'Bezig met registreren...' : 'Bezig met inloggen...'}
              </>
            ) : (
              <>
                {isRegister ? 'Account Aanmaken' : 'Inloggen'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials Info Box */}
        {!isRegister && (
          <div style={{
            backgroundColor: 'rgba(167, 139, 250, 0.08)',
            border: '1px solid rgba(167, 139, 250, 0.2)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a78bfa', fontSize: '12px', fontWeight: 700 }}>
              <ShieldCheck size={15} />
              Test Accounts (Database Authenticated)
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>Klant:</strong> <code>klant@saleswizard.nl</code> / <code>klant123</code></div>
              <div><strong>Klant:</strong> <code>klant@doublesmart.nl</code> / <code>klant123</code></div>
              <div><strong>Medewerker:</strong> <code>medewerker@saleswizard.nl</code> / <code>sales123</code></div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
