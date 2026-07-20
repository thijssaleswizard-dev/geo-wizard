import React, { useState } from 'react';
import { ShieldCheck, User, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vul alstublieft alle velden in.');
      return;
    }

    // Default manual login check
    if (email === 'klant@saleswizard.nl' && password === 'klant123') {
      handleQuickLogin('klant', 'Saleswizard.nl', 'Saleswizard', 'AI Pro');
    } else if (email === 'klant@doublesmart.nl' && password === 'klant123') {
      handleQuickLogin('klant', 'DoubleSmart.nl', 'DoubleSmart', 'AI Starter');
    } else if (email === 'medewerker@saleswizard.nl' && password === 'sales123') {
      handleQuickLogin('medewerker', 'Saleswizard Employee', 'Saleswizard', 'None');
    } else {
      setError('Ongeldige inloggegevens. Gebruik de Quick Login knoppen hieronder om direct in te loggen!');
    }
  };

  const handleQuickLogin = (role, name, company, subscription) => {
    setError('');
    const mockUser = {
      role,
      name,
      company: role === 'klant' ? company : 'Saleswizard B.V.',
      email: role === 'klant' ? `info@${company.toLowerCase().replace('.nl', '')}.nl` : 'marketeer@saleswizard.nl',
      subscription,
      addonPrompts: 0,
      avatar: company[0].toUpperCase()
    };
    onLogin(mockUser);
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
            Beheer uw AI zoekmachine-vindbaarheid & GEO campagnes.
          </p>
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
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
              boxShadow: '0 4px 12px rgba(68, 0, 153, 0.3)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
          >
            Inloggen
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Quick Login</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        {/* Quick Testing Shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          <button
            onClick={() => handleQuickLogin('klant', 'Saleswizard.nl', 'Saleswizard', 'AI Pro')}
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(167, 139, 250, 0.1)',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(167, 139, 250, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(167, 139, 250, 0.1)'}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} style={{ color: '#a78bfa' }} />
              Inloggen als Klant (Saleswizard)
            </span>
            <span style={{ fontSize: '10px', color: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>AI Pro</span>
          </button>

          <button
            onClick={() => handleQuickLogin('klant', 'DoubleSmart.nl', 'DoubleSmart', 'AI Starter')}
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.1)'}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} style={{ color: '#22d3ee' }} />
              Inloggen als Klant (DoubleSmart)
            </span>
            <span style={{ fontSize: '10px', color: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>AI Starter</span>
          </button>

          <button
            onClick={() => handleQuickLogin('medewerker', 'Saleswizard Marketeer', 'Saleswizard', 'None')}
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.1)'}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: '#f472b6' }} />
              Inloggen als Saleswizard Medewerker
            </span>
            <span style={{ fontSize: '10px', color: '#f472b6', backgroundColor: 'rgba(244, 114, 182, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>Admin</span>
          </button>

        </div>

      </div>

    </div>
  );
}
