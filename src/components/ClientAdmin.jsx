import React, { useState } from 'react';
import { Plus, Search, X, Loader2, Trash2, Edit2, Activity, Terminal, Sparkles } from 'lucide-react';

const FaviconImage = ({ domain, fallbackLabel, fallbackBg, fallbackColor, size = 20, style = {} }) => {
  const [error, setError] = React.useState(false);
  const cleanDomain = (domain || '').toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0];
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${size * 2}`;

  if (error || !cleanDomain) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '6px',
        backgroundColor: fallbackBg || '#f3f4f6',
        color: fallbackColor || '#4b5563',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(10, size - 12)}px`,
        fontWeight: 800,
        fontFamily: "'Outfit', sans-serif",
        ...style
      }}>
        {fallbackLabel ? fallbackLabel.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }

  return (
    <img
      src={faviconUrl}
      onError={() => setError(true)}
      alt=""
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '6px',
        objectFit: 'contain',
        ...style
      }}
    />
  );
};

export default function ClientAdmin({ clients, onSelectClient, onUpdateClientPlan, onAddClient, onDeleteClient, onUpdateClient }) {
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
  const [projectToDelete, setProjectToDelete] = useState(null);

  // Edit Client Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSubscription, setEditSubscription] = useState('AI Pro');

  // API Monitoring Modal state
  const [showMonitorModal, setShowMonitorModal] = useState(false);
  const [apiStatus, setApiStatus] = useState([]);
  const [apiHistory, setApiHistory] = useState([]);
  const [monitorLoading, setMonitorLoading] = useState(false);

  const fetchApiMonitorData = async () => {
    setMonitorLoading(true);
    try {
      const response = await fetch('/api/clients/api-monitor/status');
      const data = await response.json();
      if (data.success) {
        setApiStatus(data.status);
        setApiHistory(data.history);
      }
    } catch (err) {
      console.error('Error fetching API status monitor:', err);
    } finally {
      setMonitorLoading(false);
    }
  };

  const [recommending, setRecommending] = useState(false);

  const handleRecommendKeywords = async () => {
    if (!company || company === 'https://') {
      setError('Voer eerst een geldige website URL in bij stap 1.');
      return;
    }
    setRecommending(true);
    setError('');
    try {
      const response = await fetch('/api/keywords/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company })
      });
      const data = await response.json();
      if (data.success && data.formatted) {
        setKeywordInput(prev => {
          const trimmed = prev.trim();
          if (!trimmed) return data.formatted;
          return trimmed + ', ' + data.formatted;
        });
      } else {
        setError(data.error || 'Kon geen keywords aanbevelen.');
      }
    } catch (err) {
      console.error(err);
      setError('Fout bij verbinden met keyword recommender.');
    } finally {
      setRecommending(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(projectToDelete)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (onDeleteClient) {
          onDeleteClient(projectToDelete);
        }
        setProjectToDelete(null);
      } else {
        alert(data.error || 'Fout bij verwijderen van project.');
      }
    } catch (err) {
      console.error('Error deleting client:', err);
      alert('Kan geen verbinding maken met de server.');
    }
  };

  const handleEditClientClick = (client) => {
    setEditClient(client);
    setEditName(client.name || '');
    setEditEmail(client.email || '');
    setEditSubscription(client.subscription || 'AI Pro');
    setError('');
    setShowEditModal(true);
  };

  const handleEditClientSubmit = async (e) => {
    e.preventDefault();
    if (!editClient) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/clients/${editClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          subscription: editSubscription
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Fout bij bijwerken van project.');
        setLoading(false);
        return;
      }

      if (onUpdateClient) {
        onUpdateClient(data.client);
      }

      setLoading(false);
      setShowEditModal(false);
      setEditClient(null);
    } catch (err) {
      console.error('Error editing client:', err);
      setError('Kan geen verbinding maken met de server.');
      setLoading(false);
    }
  };

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
        body: JSON.stringify({ company, name, email, password, subscription, keywords: keywordInput })
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

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { fetchApiMonitorData(); setShowMonitorModal(true); }}
              style={{
                backgroundColor: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '24px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            >
              <Activity size={14} />
              API Status
            </button>

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
                onClick={client.setup_status === 'processing' ? null : () => onSelectClient(client.company)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  cursor: client.setup_status === 'processing' ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  opacity: client.setup_status === 'processing' ? 0.85 : 1
                }}
                className="project-card"
                onMouseEnter={(e) => {
                  if (client.setup_status !== 'processing') {
                    e.currentTarget.style.borderColor = 'var(--brand-primary)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                }}
              >
                {/* Left Side: Logo & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <FaviconImage
                    domain={client.company}
                    fallbackLabel={client.company}
                    fallbackBg={logoColor.bg}
                    fallbackColor={logoColor.text}
                    size={40}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                      {client.company}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {domain}
                    </span>
                  </div>
                </div>

                {/* Right Side: Keywords Count & Actions OR Progress Indicator */}
                {client.setup_status === 'processing' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader2 size={12} className="spin" style={{ color: 'var(--brand-primary)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        AI Prompts opzetten... {client.setup_progress}%
                      </span>
                    </div>
                    <div style={{ width: '120px', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${client.setup_progress}%`, height: '100%', backgroundColor: 'var(--brand-primary)', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                      {client.keywordsCount || 0} keywords
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEditClientClick(client); }}
                      title="Bewerk project"
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-primary)'; e.currentTarget.style.backgroundColor = 'var(--brand-light)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setProjectToDelete(client.company); }}
                      title="Verwijder project"
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          placeholder="bijv. https://dehoutbouwers.nl"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          disabled={loading}
                          required
                          style={{ width: '100%' }}
                        />
                      </div>
                      {company && company.length > 8 && (
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '8px', 
                          backgroundColor: '#f3f4f6', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px solid #e5e7eb',
                          flexShrink: 0
                        }}>
                          <FaviconImage
                            domain={company}
                            fallbackLabel={company}
                            fallbackBg="#f3f4f6"
                            fallbackColor="#9ca3af"
                            size={24}
                          />
                        </div>
                      )}
                    </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Keywords (komma-gescheiden)
                      </label>
                      <button
                        type="button"
                        onClick={handleRecommendKeywords}
                        disabled={recommending}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#440099',
                          backgroundColor: '#f3e8ff',
                          border: '1px solid #d8b4fe',
                          borderRadius: '16px',
                          padding: '2px 10px',
                          cursor: recommending ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {recommending ? (
                          <>
                            <Loader2 size={10} className="spin" />
                            Aanbevelen...
                          </>
                        ) : (
                          <>
                            <Sparkles size={10} />
                            Recommend keywords
                          </>
                        )}
                      </button>
                    </div>
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

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
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
          zIndex: 1100,
          padding: '20px'
        }}>
          <div className="card fade-in" style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Trash2 size={24} />
            </div>
            
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif" }}>
                Project Verwijderen?
              </h3>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px', lineHeight: '1.5' }}>
                Weet u zeker dat u het project <strong>{projectToDelete}</strong> en alle bijbehorende keywords en prompts wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '30px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '30px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Ja, verwijder
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Client Modal */}
      {showEditModal && editClient && (
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
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card fade-in" style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            position: 'relative'
          }}>
            <button
              onClick={() => { setShowEditModal(false); setEditClient(null); }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px', fontFamily: "'Outfit', sans-serif" }}>
              Project Bewerken
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>
              Pas de contactgegevens of het abonnement van het geselecteerde project aan.
            </p>

            <form onSubmit={handleEditClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Website / Company Domain
                </label>
                <input
                  type="text"
                  value={editClient.company}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '30px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#f3f4f6',
                    color: '#9ca3af',
                    fontSize: '13px',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Contactpersoon Naam
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Bijv. Jan de Vries"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '30px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  E-mailadres
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Bijv. jan@bedrijf.nl"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '30px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Abonnement
                </label>
                <select
                  value={editSubscription}
                  onChange={(e) => setEditSubscription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '30px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="AI Lite">AI Lite</option>
                  <option value="AI Pro">AI Pro</option>
                  <option value="AI Enterprise">AI Enterprise</option>
                </select>
              </div>

              {error && (
                <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, textAlign: 'center', marginTop: '4px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditClient(null); }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '30px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '30px',
                    border: 'none',
                    backgroundColor: 'var(--brand-primary)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Opslaan...
                    </>
                  ) : (
                    'Opslaan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* API Monitoring Modal */}
      {showMonitorModal && (
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
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card fade-in" style={{
            width: '100%',
            maxWidth: '720px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            position: 'relative',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <button
              onClick={() => setShowMonitorModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>

            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} className="animate-pulse" style={{ color: 'var(--brand-primary)' }} />
                API Status & Engine Monitor
              </h3>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                Bekijk de live verbindingsstatus en logboeken van de aangesloten LLM engines.
              </p>
            </div>

            {/* Engine Status Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '20px'
            }}>
              {apiStatus.map(eng => {
                let badgeBg = '#f3f4f6';
                let badgeColor = '#4b5563';
                let label = 'Niet gebruikt';

                if (eng.status === 'NOT_CONFIGURED') {
                  badgeBg = '#fee2e2';
                  badgeColor = '#ef4444';
                  label = 'Geen sleutel';
                } else if (eng.status === 'ACTIVE') {
                  badgeBg = '#dcfce7';
                  badgeColor = '#22c55e';
                  label = 'Actief';
                } else if (eng.status === 'DEGRADED') {
                  badgeBg = '#fef9c3';
                  badgeColor = '#ca8a04';
                  label = 'Degraded / Error';
                }

                return (
                  <div key={eng.engine} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    backgroundColor: '#fafafa'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>{eng.name.split(' ')[0]}</span>
                    <span style={{
                      alignSelf: 'flex-start',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: badgeBg,
                      color: badgeColor
                    }}>
                      {label}
                    </span>
                    {eng.lastError && (
                      <span style={{ fontSize: '9px', color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={eng.lastError}>
                        {eng.lastError}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Call History Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} />
                  Live API Logboeken (max. 50)
                </span>
                <button
                  onClick={fetchApiMonitorData}
                  disabled={monitorLoading}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--brand-primary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {monitorLoading ? 'Verversen...' : 'Nu verversen'}
                </button>
              </div>

              <div style={{
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: '11px',
                color: '#38bdf8',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '180px',
                overflowY: 'auto'
              }}>
                {apiHistory.length === 0 ? (
                  <span style={{ color: '#94a3b8' }}>Er zijn nog geen API-aanroepen geregistreerd in de huidige sessie.</span>
                ) : (
                  apiHistory.map((log, idx) => {
                    const isErr = log.status === 'ERROR';
                    const time = new Date(log.timestamp).toLocaleTimeString();
                    return (
                      <div key={idx} style={{ borderBottom: '1px solid #1e293b', paddingBottom: '6px', color: isErr ? '#f87171' : '#38dfa8' }}>
                        <span style={{ color: '#64748b', marginRight: '8px' }}>[{time}]</span>
                        <strong style={{ textTransform: 'uppercase', marginRight: '6px' }}>{log.engine}</strong>
                        <span style={{ color: isErr ? '#f87171' : '#e2e8f0' }}>{log.message}</span>
                        {log.latency && <span style={{ color: '#64748b', marginLeft: '8px' }}>({log.latency})</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowMonitorModal(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '30px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Sluiten
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
