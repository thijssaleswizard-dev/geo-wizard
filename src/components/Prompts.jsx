import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, HelpCircle, AlertCircle, 
  Play, CheckCircle, XCircle, Filter, Tag, Loader2
} from 'lucide-react';

export default function Prompts({ activeWorkspace }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('All');
  const [promptsList, setPromptsList] = useState([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);

  // Modal / Inputs state for adding a prompt
  const [isAdding, setIsAdding] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptTag, setNewPromptTag] = useState('SEO Agency');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedEngines, setSelectedEngines] = useState({
    chatgpt: true,
    gemini: true,
    perplexity: true,
    copilot: true,
    claude: true,
    aio: true
  });

  // Fetch prompts from database on mount & activeWorkspace change
  useEffect(() => {
    let isMounted = true;
    setLoadingPrompts(true);

    const workspace = activeWorkspace || 'Saleswizard.nl';
    fetch(`/api/prompts?company=${encodeURIComponent(workspace)}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success) {
          setPromptsList(data.prompts || []);
        }
        if (isMounted) setLoadingPrompts(false);
      })
      .catch(err => {
        console.error('Failed to load prompts:', err);
        if (isMounted) setLoadingPrompts(false);
      });

    return () => { isMounted = false; };
  }, [activeWorkspace]);

  // Save prompt to database
  const handleAddPrompt = async (e) => {
    e.preventDefault();
    if (!newPromptText.trim()) return;

    setIsSaving(true);
    setErrorMsg('');

    try {
      const workspace = activeWorkspace || 'Saleswizard.nl';
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company: workspace,
          text: newPromptText.trim(),
          tag: newPromptTag,
          engines: selectedEngines
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMsg(data.error || 'Fout bij opslaan van prompt.');
        setIsSaving(false);
        return;
      }

      setPromptsList([data.prompt, ...promptsList]);
      setNewPromptText('');
      setIsAdding(false);
      setIsSaving(false);
    } catch (err) {
      console.error('Error saving prompt:', err);
      setErrorMsg('Kan geen verbinding maken met de server.');
      setIsSaving(false);
    }
  };

  // Delete prompt from database
  const handleDelete = async (id) => {
    if (window.confirm('Weet u zeker dat u deze prompt wilt verwijderen uit de tracking database?')) {
      try {
        const response = await fetch(`/api/prompts/${id}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
          setPromptsList(promptsList.filter(p => p.id !== id));
        } else {
          alert(data.error || 'Fout bij verwijderen.');
        }
      } catch (err) {
        console.error('Error deleting prompt:', err);
        alert('Kan de prompt niet verwijderen.');
      }
    }
  };

  const handleToggleEngine = (engineKey) => {
    setSelectedEngines(prev => ({
      ...prev,
      [engineKey]: !prev[engineKey]
    }));
  };

  // Filtered prompts
  const filteredPrompts = promptsList.filter(prompt => {
    const matchesSearch = prompt.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = filterTag === 'All' || prompt.tag === filterTag;
    return matchesSearch && matchesTag;
  });

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Section */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Tracked Prompts</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Beheer de AI prompts die dagelijks worden bijgehouden in de database voor <strong>{activeWorkspace || 'Saleswizard.nl'}</strong>.
          </p>
        </div>

        <button
          onClick={() => { setIsAdding(!isAdding); setErrorMsg(''); }}
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
            boxShadow: 'var(--shadow-md)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
        >
          <Plus size={16} />
          Add Tracked Prompt
        </button>
      </div>

      {/* Adding Form Section */}
      {isAdding && (
        <form onSubmit={handleAddPrompt} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--brand-light-border)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Add New Keyword Prompt to Database</h3>
          
          {errorMsg && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '10px 14px',
              color: '#ef4444',
              fontSize: '12px'
            }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Prompt Text / Question *</label>
            <input
              type="text"
              placeholder="e.g. Wat is het meest ervaren SEO bureau in Arnhem?"
              value={newPromptText}
              onChange={(e) => setNewPromptText(e.target.value)}
              disabled={isSaving}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="responsive-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Category Tag</label>
              <select value={newPromptTag} onChange={(e) => setNewPromptTag(e.target.value)} disabled={isSaving}>
                <option value="SEO Agency">SEO Agency</option>
                <option value="Marketing">Marketing</option>
                <option value="Webdesign">Webdesign</option>
                <option value="Hosting">Hosting</option>
                <option value="Algemeen">Algemeen</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Track on AI Engines</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                {Object.keys(selectedEngines).map((engineKey) => (
                  <button
                    type="button"
                    key={engineKey}
                    onClick={() => handleToggleEngine(engineKey)}
                    disabled={isSaving}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: selectedEngines[engineKey] ? 'var(--brand-light)' : 'transparent',
                      color: selectedEngines[engineKey] ? 'var(--brand-primary)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {engineKey}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--border-medium)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: 'var(--brand-primary)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="spin" />
                  Opslaan in DB...
                </>
              ) : (
                'Save Prompt to DB'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search controls */}
      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Search tracked prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span>Category:</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'SEO Agency', 'Marketing', 'Webdesign', 'Algemeen'].map((tagOption) => (
              <button
                key={tagOption}
                onClick={() => setFilterTag(tagOption)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: filterTag === tagOption ? 'var(--brand-primary)' : 'var(--bg-app)',
                  color: filterTag === tagOption ? 'white' : 'var(--text-secondary)',
                  border: filterTag === tagOption ? 'none' : '1px solid var(--border-medium)',
                  cursor: 'pointer'
                }}
              >
                {tagOption}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompts Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        {loadingPrompts ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            Prompts ophalen uit database...
          </div>
        ) : (
          <table className="premium-table">
            <thead>
              <tr>
                <th>Prompt text</th>
                <th style={{ width: '120px' }}>Category</th>
                <th>Engines tracked</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Status</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Avg Position</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrompts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    No tracked prompts found matching filters.
                  </td>
                </tr>
              ) : (
                filteredPrompts.map((prompt) => (
                  <tr key={prompt.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '300px' }}>
                      {prompt.text}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--brand-light)',
                        color: 'var(--brand-primary)'
                      }}>
                        <Tag size={10} />
                        {prompt.tag}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {Object.keys(prompt.engines || {}).map((engKey) => {
                          const active = prompt.engines[engKey];
                          const labelMap = {
                            chatgpt: 'GPT',
                            gemini: 'GEM',
                            perplexity: 'PPLX',
                            copilot: 'COPI',
                            claude: 'CLD',
                            aio: 'AIO'
                          };
                          return (
                            <span
                              key={engKey}
                              style={{
                                fontSize: '8px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                backgroundColor: active ? '#ece0ff' : 'var(--border-light)',
                                color: active ? 'var(--brand-primary)' : 'var(--text-muted)'
                              }}
                              title={`${engKey}: ${active ? 'Active' : 'Disabled'}`}
                            >
                              {labelMap[engKey] || engKey.toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {prompt.mentioned ? (
                        <span className="badge badge-positive" style={{ gap: '2px' }}>
                          <CheckCircle size={10} /> Mentioned
                        </span>
                      ) : (
                        <span className="badge badge-negative" style={{ gap: '2px' }}>
                          <XCircle size={10} /> Missed
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: prompt.position ? 'var(--brand-accent)' : 'var(--text-muted)' }}>
                      {prompt.position ? `#${prompt.position}` : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          title="Delete tracked prompt"
                          onClick={() => handleDelete(prompt.id)}
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
