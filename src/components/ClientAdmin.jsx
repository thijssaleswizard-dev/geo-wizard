import React, { useState } from 'react';
import { Plus, Search, X, Loader2 } from 'lucide-react';

export default function ClientAdmin({ clients, onSelectClient, onUpdateClientPlan, onAddClient }) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Client Modal state
  const [showModal, setShowModal] = useState(false);
  const [company, setCompany] = useState('https://');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subscription, setSubscription] = useState('AI Pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [keywordInput, setKeywordInput] = useState('');

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.company.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleAddClientSubmit = async (e) => {
    e.preventDefault();
    
    if (step === 1) {
      if (!company || !name || !email) {
        setError('Vul alstublieft Bedrijfsnaam, Klantnaam en E-mailadres in.');
        return;
      }
      
      // Clean company name to domain if it is a url
      let cleanedCompany = company.trim();
      if (cleanedCompany.startsWith('http://') || cleanedCompany.startsWith('https://')) {
        cleanedCompany = cleanedCompany.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0];
      }
      setCompany(cleanedCompany);
      
      setStep(2);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ company, name, email, password, subscription })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Fout bij aanmaken van klant.');
        setLoading(false);
        return;
      }

      // Save step 2 keywords if entered
      if (keywordInput.trim()) {
        const rawKeywords = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
        for (const kw of rawKeywords) {
          // POST /api/keywords
          const kwResponse = await fetch('/api/keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: company, keyword: kw, volume: 100 })
          });
          const kwData = await kwResponse.json();

          if (kwData.success) {
            // Generate the default 3 prompts
            const prompts = [
              `Wat is het beste ${kw} in Nederland?`,
              `Welke ${kw} partijen zijn gespecialiseerd in MKB groei?`,
              `Hoe kies ik een betrouwbare partner voor ${kw}?`
            ];
            for (const pText of prompts) {
              await fetch('/api/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: company, text: pText, tag: 'AI Generated' })
              });
            }
          }
        }
      }

      setLoading(false);
      setShowModal(false);
      
      // Reset form
      setCompany('https://');
      setName('');
      setEmail('');
      setPassword('');
      setSubscription('AI Pro');
      setKeywordInput('');
      setStep(1);

      if (onAddClient) {
        onAddClient(data.client);
      }
    } catch (err) {
      console.error('Error adding client:', err);
      setError('Kan geen verbinding maken met de server.');
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{
      padding: '40px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      width: '100%'
    }}>
      <div style={{ width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#111827',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.5px'
            }}>
              Projects
            </h1>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>
              View and manage your brands in Saleswizard.
            </p>
          </div>

          <button
            onClick={() => { setShowModal(true); setError(''); setStep(1); setKeywordInput(''); setCompany('https://'); }}
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              border: 'none',
              borderRadius: '24px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000000'}
          >
            <Plus size={14} strokeWidth={3} />
            Create Project
          </button>
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Zoek projecten op bedrijfsnaam of klantnaam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 42px',
              borderRadius: '24px',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              color: '#1f2937',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              outline: 'none',
              transition: 'border-color 0.15s ease'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
          />
        </div>

        {/* Project Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredClients.map((client) => {
            const domain = client.company.toLowerCase().includes('.') 
              ? client.company.toLowerCase() 
              : `${client.company.toLowerCase()}.nl`;
            
            // Generate a premium colored icon based on company name
            const colors = [
              { bg: '#fee2e2', text: '#ef4444' }, // Red
              { bg: '#e0e7ff', text: '#6366f1' }, // Indigo
              { bg: '#dcfce7', text: '#22c55e' }, // Green
              { bg: '#fef9c3', text: '#eab308' }, // Yellow
              { bg: '#f3e8ff', text: '#a855f7' }, // Purple
              { bg: '#ecfeff', text: '#06b6d4' }  // Cyan
            ];
            const colorIdx = client.company.charCodeAt(0) % colors.length;
            const logoColor = colors[colorIdx];

            return (
              <div
                key={client.company}
                onClick={() => onSelectClient(client.company)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
                className="project-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                }}
              >
                {/* Left Side: Logo & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: logoColor.bg,
                    color: logoColor.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '16px',
                    fontFamily: "'Outfit', sans-serif"
                  }}>
                    {client.company[0].toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                      {client.company}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {domain}
                    </span>
                  </div>
                </div>

                {/* Right Side: Keywords Count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    {client.keywordsCount || 0} keywords
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Add Client Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card fade-in" style={{
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                right: '20px',
                top: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            {step === 1 ? (
              <>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                    Nieuwe Klant Workspace Toevoegen
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Maak een nieuw klantproject aan in de SQLite database.
                  </p>
                </div>

                {error && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '10px 14px',
                    color: '#ef4444',
                    fontSize: '12px'
                  }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleAddClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Website URL (met https://) *
                    </label>
                    <input
                      type="text"
                      placeholder="bijv. https://dehoutbouwers.nl"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Klant Contactnaam *
                    </label>
                    <input
                      type="text"
                      placeholder="bijv. Mark de Boer"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      E-mailadres *
                    </label>
                    <input
                      type="email"
                      placeholder="mark@dehoutbouwers.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Wachtwoord (Optioneel voor inloggen)
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Actief GEO Abonnement
                    </label>
                    <select
                      value={subscription}
                      onChange={(e) => setSubscription(e.target.value)}
                      disabled={loading}
                    >
                      <option value="AI Starter">AI Starter (€195/mnd)</option>
                      <option value="AI Pro">AI Pro (€350/mnd)</option>
                      <option value="AI Enterprise">AI Enterprise (€700/mnd)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '10px 20px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--brand-primary)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Volgende: Keywords
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                    Keywords Toevoegen
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Voeg optioneel alvast keywords toe voor dit project (komma-gescheiden).
                  </p>
                </div>

                {error && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '10px 14px',
                    color: '#ef4444',
                    fontSize: '12px'
                  }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleAddClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Keywords (komma-gescheiden)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="bijv. seo optimalisatie, online marketing bureau, ads uitbesteden"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={loading}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Vorige
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--brand-primary)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={14} className="spin" />
                          Project Aanmaken...
                        </>
                      ) : (
                        'Project Aanmaken'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
