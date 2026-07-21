import React, { useState } from 'react';
import { 
  Users, Search, ShieldAlert, CheckCircle, Plus, X,
  ExternalLink, Sparkles, Filter, Settings, Award, Loader2 
} from 'lucide-react';

export default function ClientAdmin({ clients, onSelectClient, onUpdateClientPlan, onAddClient }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('All');
  
  // Add Client Modal state
  const [showModal, setShowModal] = useState(false);
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subscription, setSubscription] = useState('AI Pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = filterPlan === 'All' || c.subscription === filterPlan;
    return matchesSearch && matchesPlan;
  });

  const handleAddClientSubmit = async (e) => {
    e.preventDefault();
    if (!company || !name || !email) {
      setError('Vul alstublieft Bedrijfsnaam, Klantnaam en E-mailadres in.');
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

      setLoading(false);
      setShowModal(false);
      
      // Reset form
      setCompany('');
      setName('');
      setEmail('');
      setPassword('');
      setSubscription('AI Pro');

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
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Client Workspaces Admin</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Beheer alle actieve klantprojecten, maak nieuwe klantprojecten aan en wijzig hun abonnementstiers.
          </p>
        </div>

        {/* Add Client Button */}
        <button
          onClick={() => { setShowModal(true); setError(''); }}
          style={{
            backgroundColor: 'var(--brand-primary)',
            color: 'white',
            fontWeight: 700,
            fontSize: '13px',
            padding: '10px 18px',
            borderRadius: 'var(--border-radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(68, 0, 153, 0.25)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
        >
          <Plus size={16} />
          Nieuwe Klant Toevoegen
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Zoek op klantnaam of bedrijf..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span>Abonnement:</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'AI Starter', 'AI Pro', 'AI Enterprise'].map((planOpt) => (
              <button
                key={planOpt}
                onClick={() => setFilterPlan(planOpt)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: filterPlan === planOpt ? 'var(--brand-primary)' : 'var(--bg-app)',
                  color: filterPlan === planOpt ? 'white' : 'var(--text-secondary)',
                  border: filterPlan === planOpt ? 'none' : '1px solid var(--border-medium)'
                }}
              >
                {planOpt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Client List Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Bedrijf / Domein</th>
              <th>Klantnaam</th>
              <th style={{ width: '180px' }}>Actief GEO Plan</th>
              <th style={{ textAlign: 'center', width: '130px' }}>Gevolgen Prompts</th>
              <th style={{ textAlign: 'center', width: '120px' }}>Visibility Share</th>
              <th style={{ textAlign: 'center', width: '150px' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => {
              const planColor = {
                'AI Starter': '#06b6d4',
                'AI Pro': '#a78bfa',
                'AI Enterprise': '#ec4899'
              }[client.subscription] || 'var(--text-muted)';

              return (
                <tr key={client.company}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: `${planColor}20`,
                        color: planColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '14px'
                      }}>
                        {client.company[0]}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{client.company}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{client.email}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {client.name}
                  </td>
                  <td>
                    <select
                      value={client.subscription}
                      onChange={(e) => onUpdateClientPlan(client.company, e.target.value)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderColor: 'var(--border-medium)',
                        color: planColor,
                        backgroundColor: 'var(--bg-card)'
                      }}
                    >
                      <option value="AI Starter">AI Starter (€195)</option>
                      <option value="AI Pro">AI Pro (€350)</option>
                      <option value="AI Enterprise">AI Enterprise (€750)</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    {client.promptsCount} / {
                      client.subscription === 'AI Starter' ? 15 :
                      client.subscription === 'AI Pro' ? 30 : 100
                    }
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-positive" style={{ fontWeight: 700 }}>
                      {client.visibilityIndex}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => onSelectClient(client.company)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--brand-primary)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
                    >
                      Bekijk Dashboard
                      <ExternalLink size={10} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                  Bedrijfsnaam / Domein *
                </label>
                <input
                  type="text"
                  placeholder="bijv. DeHoutbouwers.nl"
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
                  <option value="AI Enterprise">AI Enterprise (€750/mnd)</option>
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
                      Aanmaken...
                    </>
                  ) : (
                    'Klant Opslaan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
