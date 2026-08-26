import React, { useState } from 'react';
import { ShieldCheck, User, Lock, ArrowRight, Loader2, Building, Mail, Sparkles, Check } from 'lucide-react';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('pro');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegister) {
      if (!email || !password || !username || !companyName) {
        setError('Vul alstublieft alle velden in om te registreren.');
        return;
      }
      setLoading(true);

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            email,
            password,
            companyName,
            subscriptionKey: selectedPackage
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || 'Registratie mislukt.');
          setLoading(false);
          return;
        }

        setLoading(false);
        // Stuur de gebruiker door naar Mollie checkout (simulatie of echt)
        window.location.href = data.checkoutUrl;
      } catch (err) {
        console.error('Registration network error:', err);
        setError('Kan geen verbinding maken met de server. Controleer of de backend draait.');
        setLoading(false);
      }
    } else {
      if (!email || !password) {
        setError('Vul alstublieft alle velden in om in te loggen.');
        return;
      }
      setLoading(true);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.status === 402 && data.needs_payment) {
          // Betaling moet nog afgerond worden, stuur door naar checkout URL
          setError(data.error || 'Rond de betaling af.');
          setTimeout(() => {
            window.location.href = data.checkoutUrl;
          }, 1500);
          return;
        }

        if (!response.ok || !data.success) {
          setError(data.error || 'Ongeldige inloggegevens.');
          setLoading(false);
          return;
        }

        setLoading(false);
        onLogin(data.user);
      } catch (err) {
        console.error('Auth network error:', err);
        setError('Kan geen verbinding maken met de server. Controleer of de backend draait.');
        setLoading(false);
      }
    }
  };

  const packagesInfo = [
    {
      key: 'starter',
      name: 'AI/GEO Starter pakket',
      price: '195',
      setup: '750',
      features: [
        'Nulmeting AI-zichtbaarheid',
        'AI strategie',
        'Monitoring 15 prompts',
        '1 paginaoptimalisatie p/m',
        'AI Zichtbaarheidsrapport',
        '1 backlink p/m',
        'Max 1,5 uur support p/m',
        'Jaarlijkse evaluatie'
      ]
    },
    {
      key: 'pro',
      name: 'AI/GEO Pro pakket',
      price: '350',
      setup: '750',
      features: [
        'Nulmeting AI-zichtbaarheid',
        'AI strategie',
        'Monitoring 30 prompts',
        '1 paginaoptimalisatie p/m',
        '1 FAQ sectie p/m',
        '1 post/pagina extra p/m',
        'AI Zichtbaarheidsrapport',
        '2 backlinks p/m',
        'Max 4 uur support p/m',
        'Halfjaarlijkse evaluatie'
      ],
      popular: true
    },
    {
      key: 'top',
      name: 'AI/GEO Top pakket',
      price: '700',
      setup: '750',
      features: [
        'Nulmeting AI-zichtbaarheid',
        'AI strategie',
        'Monitoring 60 prompts',
        '2 paginaoptimalisaties p/m',
        '2 FAQ secties p/m',
        '2 posts/pagina\'s p/m',
        'AI Zichtbaarheidsrapport',
        '4 backlinks p/m',
        'Max 8 uur support p/m',
        'Kwartaalevaluatie'
      ]
    }
  ];

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #1f143a 0%, #0b0717 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>

      <div className="fade-in" style={{
        width: '100%',
        maxWidth: isRegister ? '1000px' : '440px',
        backgroundColor: 'rgba(21, 15, 36, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(167, 139, 250, 0.15)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '40px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        boxSizing: 'border-box',
        transition: 'max-width 0.4s ease-in-out'
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
            {isRegister ? 'Start uw GEO Optimalisatie' : 'GEO-Wizard Portaal'}
          </h2>

          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
            {isRegister ? 'Kies een pakket en activeer uw account' : 'Beheer uw AI zoekmachine-vindbaarheid & GEO campagnes.'}
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

        {/* Main form and package selector container */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: isRegister ? 'row' : 'column',
          gap: '32px',
          flexWrap: 'wrap'
        }}>
          
          {/* Form Fields */}
          <div style={{
            flex: '1 1 350px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            
            {isRegister && (
              <>
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
                      required
                      style={{
                        width: '100%',
                        paddingLeft: '38px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        borderRadius: 'var(--border-radius-sm)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Contactpersoon
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                    <input
                      type="text"
                      placeholder="Voor- en achternaam"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      required
                      style={{
                        width: '100%',
                        paddingLeft: '38px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        borderRadius: 'var(--border-radius-sm)',
                        boxSizing: 'border-box'
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
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                <input
                  type="email"
                  placeholder="naam@bedrijf.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  style={{
                    width: '100%',
                    paddingLeft: '38px',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    borderRadius: 'var(--border-radius-sm)',
                    boxSizing: 'border-box'
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
                  required
                  style={{
                    width: '100%',
                    paddingLeft: '38px',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    borderRadius: 'var(--border-radius-sm)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '12px',
                backgroundColor: 'var(--brand-primary)',
                color: 'white',
                fontWeight: 700,
                padding: '14px',
                borderRadius: 'var(--border-radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(68, 0, 153, 0.3)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                border: 'none',
                width: '100%',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--brand-primary)')}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Verwerken...
                </>
              ) : (
                <>
                  {isRegister ? 'Registreren & Betalen' : 'Inloggen'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* Package Selector (Only shown in register mode) */}
          {isRegister && (
            <div style={{
              flex: '1 1 500px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Kies uw GEO optimalisatiepakket
              </label>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {packagesInfo.map((p) => {
                  const isSelected = selectedPackage === p.key;
                  return (
                    <div
                      key={p.key}
                      onClick={() => setSelectedPackage(p.key)}
                      style={{
                        border: isSelected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.1)' : 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        position: 'relative',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            border: isSelected ? '5px solid #7c3aed' : '2px solid rgba(255,255,255,0.3)',
                            backgroundColor: 'white',
                            flexShrink: 0
                          }} />
                          <span style={{ fontWeight: 700, color: 'white', fontSize: '15px' }}>{p.name}</span>
                          {p.popular && (
                            <span style={{
                              backgroundColor: '#7c3aed',
                              color: 'white',
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0
                            }}>
                              <Sparkles size={10} />
                              MEEST GEKOZEN
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>€ {p.price} p/m</span>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>€ {p.setup} opstartkosten</div>
                        </div>
                      </div>

                      {/* Small list of features */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px 12px',
                        marginTop: '4px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        paddingTop: '8px'
                      }}>
                        {p.features.slice(0, 4).map((f, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                            <Check size={12} style={{ color: '#10b981' }} />
                            {f}
                          </div>
                        ))}
                        {p.features.length > 4 && (
                          <div style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600 }}>
                            + {p.features.length - 4} meer services
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </form>

        {/* Toggle between login/register */}
        <div style={{
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '16px',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.6)'
        }}>
          {isRegister ? (
            <>
              Heeft u al een account?{' '}
              <span
                onClick={() => { setIsRegister(false); setError(''); }}
                style={{ color: '#a78bfa', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Log hier in
              </span>
            </>
          ) : (
            <>
              Nog geen account?{' '}
              <span
                onClick={() => { setIsRegister(true); setError(''); }}
                style={{ color: '#a78bfa', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Registreer nu
              </span>
            </>
          )}
        </div>

        {/* Demo Credentials Info Box (Only on login) */}
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
              <div><strong>Medewerker:</strong> <code>medewerker@saleswizard.nl</code> / <code>sales123</code></div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
