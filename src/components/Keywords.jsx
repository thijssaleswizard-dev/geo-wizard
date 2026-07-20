import React, { useState } from 'react';
import { 
  Plus, Search, HelpCircle, Archive, Trash2, 
  ChevronDown, ChevronRight, Sparkles, Check, Info, TrendingUp,
  Play, Eye, ExternalLink, Sliders, Settings, AlertTriangle, ShieldCheck,
  Edit2, X
} from 'lucide-react';

export default function Keywords({ currentUser, onUpdateAddonPrompts }) {
  const [isAdding, setIsAdding] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedFeedback, setGeneratedFeedback] = useState([]);
  const [expandedKeywords, setExpandedKeywords] = useState(new Set([1])); // Pre-expand first one

  // Active tab per expanded keyword (default is 'prompts')
  const [keywordTabs, setKeywordTabs] = useState({}); // e.g. { [kwId]: 'prompts' }

  // Toggle edit prompts mode per keyword
  const [editPromptModes, setEditPromptModes] = useState({}); // e.g. { [kwId]: boolean }

  // Text inputs for adding custom prompts per keyword
  const [customPromptInputs, setCustomPromptInputs] = useState({}); // e.g. { [kwId]: string }

  // Keywords database with self-contained associated prompts
  const [keywords, setKeywords] = useState([
    { 
      id: 1, 
      text: 'online marketing bureau', 
      rank: '#7', 
      sov: 6, 
      position: '2.0', 
      volume: '1.6k', 
      brands: ['saleswizard', 'doublesmart', 'perplexity'],
      prompts: [
        { text: 'Wat zijn de kosten van een online marketing bureau voor MKB?', status: 'Cited', engines: ['chatgpt', 'gemini', 'perplexity'], brandsCount: 14, sourcesCount: 23 },
        { text: 'beste online marketing bureau arnhem', status: 'Cited', engines: ['chatgpt', 'gemini', 'perplexity', 'copilot'], brandsCount: 36, sourcesCount: 54, mentioned: true },
        { text: 'Kan een online marketing bureau mijn website verbeteren?', status: 'Cited', engines: ['chatgpt', 'perplexity'], brandsCount: 26, sourcesCount: 38 },
        { text: 'Wat is de gemiddelde prijs van een online marketing bureau per maand?', status: 'Cited', engines: ['chatgpt', 'gemini'], brandsCount: 21, sourcesCount: 27 },
        { text: 'Zoek een betrouwbaar online marketing bureau voor mijn webshop.', status: 'Cited', engines: ['perplexity'], brandsCount: 50, sourcesCount: 23 },
        { text: 'Welk online marketing bureau kan mi helpen met social media campagnes?', status: 'Cited', engines: ['chatgpt', 'gemini'], brandsCount: 37, sourcesCount: 44 },
        { text: 'Vergelijk online marketing bureaus met focus op conversie optimalisatie.', status: 'Cited', engines: ['gemini', 'perplexity'], brandsCount: 36, sourcesCount: 34 },
        { text: 'Beste online marketing bureau voor SEO en SEA in Nederland?', status: 'Cited', engines: ['chatgpt', 'copilot'], brandsCount: 57, sourcesCount: 40 }
      ]
    },
    { 
      id: 2, 
      text: 'geo optimalisatie', 
      rank: '#113', 
      sov: 1, 
      position: '3.0', 
      volume: '320', 
      brands: ['google', 'chatgpt', 'gemini'],
      prompts: [
        { text: 'Wie kan mij helpen met geo optimalisatie voor AI zoekmachines?', status: 'Cited', engines: ['gemini'], brandsCount: 12, sourcesCount: 15 },
        { text: 'Wat is het meest ervaren bureau voor generative engine optimization?', status: 'Not Mentioned', engines: ['chatgpt', 'gemini'], brandsCount: 2, sourcesCount: 4 }
      ]
    },
    { 
      id: 3, 
      text: 'sea uitbesteden', 
      rank: '-', 
      sov: 0, 
      position: '-', 
      volume: '720', 
      brands: ['inoma', 'google', 'saleswizard'],
      prompts: [
        { text: 'Hoe vind ik een betrouwbare SEA specialist in Gelderland?', status: 'Not Mentioned', engines: ['inoma'], brandsCount: 0, sourcesCount: 2 },
        { text: 'Wie kan Google Ads (SEA) campagnes beheren in Arnhem?', status: 'Not Mentioned', engines: ['google', 'saleswizard'], brandsCount: 3, sourcesCount: 8 }
      ]
    },
    { 
      id: 4, 
      text: 'social media marketing', 
      rank: '-', 
      sov: 0, 
      position: '-', 
      volume: '2.4k', 
      brands: ['trafficbuilders', 'emerce', 'saleswizard'],
      prompts: [
        { text: 'Welk bureau in Arnhem is goed in social media marketing?', status: 'Not Mentioned', engines: ['saleswizard'], brandsCount: 1, sourcesCount: 3 },
        { text: 'Hoe vergroot ik mijn naamsbekendheid via Facebook en Instagram?', status: 'Not Mentioned', engines: ['emerce', 'saleswizard'], brandsCount: 2, sourcesCount: 9 }
      ]
    }
  ]);

  const [archivedKeywords, setArchivedKeywords] = useState([
    { id: 101, text: 'seo consultant arnhem', rank: '#14', sov: 4, position: '4.2', volume: '210', brands: ['saleswizard', 'inoma'], prompts: [] }
  ]);

  // Subscription Prompts Limit Checks
  const getPlanLimit = () => {
    const sub = currentUser.subscription;
    const addon = currentUser.addonPrompts || 0;
    let base = 15;
    if (sub === 'AI Pro') base = 30;
    if (sub === 'AI Enterprise') base = 100;
    return base + addon;
  };

  const activeLimit = getPlanLimit();
  const totalUsedPrompts = keywords.reduce((sum, kw) => sum + kw.prompts.length, 0);
  const isLimitReached = totalUsedPrompts >= activeLimit;

  // Toggle active tab per keyword (Rankings, Prompts, Sources, Shopping, Settings)
  const getKeywordTab = (kwId) => keywordTabs[kwId] || 'prompts';
  const setKeywordTab = (kwId, tabName) => {
    setKeywordTabs(prev => ({ ...prev, [kwId]: tabName }));
  };

  // Toggle Edit prompts mode
  const getEditPromptMode = (kwId) => !!editPromptModes[kwId];
  const toggleEditPromptMode = (kwId) => {
    setEditPromptModes(prev => ({ ...prev, [kwId]: !prev[kwId] }));
  };

  // Handle input changes
  const getCustomPromptInput = (kwId) => customPromptInputs[kwId] || '';
  const setCustomPromptInput = (kwId, val) => {
    setCustomPromptInputs(prev => ({ ...prev, [kwId]: val }));
  };

  const handleToggleRow = (id) => {
    const newExpanded = new Set(expandedKeywords);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedKeywords(newExpanded);
  };

  // Add Custom Prompt to a specific Keyword
  const handleAddCustomPrompt = (kwId) => {
    const text = getCustomPromptInput(kwId).trim();
    if (!text) return;

    // Check if adding one prompt exceeds the limits
    if (totalUsedPrompts >= activeLimit) {
      alert(`Prompts limiet bereikt! Verhoog uw add-on bundel in de warning-card of de accountpagina om meer prompts toe te voegen.`);
      return;
    }

    setKeywords(keywords.map(kw => {
      if (kw.id === kwId) {
        return {
          ...kw,
          prompts: [
            ...kw.prompts,
            { text, status: 'Not Mentioned', engines: ['chatgpt', 'gemini'], brandsCount: 0, sourcesCount: 0 }
          ]
        };
      }
      return kw;
    }));

    setCustomPromptInput(kwId, '');
  };

  // Delete Prompt from Keyword
  const handleDeletePrompt = (kwId, promptText) => {
    setKeywords(keywords.map(kw => {
      if (kw.id === kwId) {
        return {
          ...kw,
          prompts: kw.prompts.filter(p => p.text !== promptText)
        };
      }
      return kw;
    }));
  };

  // Add new keywords via form
  const handleAddKeywords = (e) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;

    const rawKeywords = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
    const addedKeywords = [];
    const generatedPrompts = [];

    // Calculate how many prompts this would generate
    const promptsToGenerateCount = rawKeywords.length * 3;
    if (totalUsedPrompts + promptsToGenerateCount > activeLimit) {
      alert(`Actie afgebroken! Het toevoegen van deze keywords genereert ${promptsToGenerateCount} prompts, wat uw resterende ruimte overschrijdt (${activeLimit - totalUsedPrompts} prompts beschikbaar). Upgrade eerst uw add-on bundel.`);
      return;
    }

    rawKeywords.forEach((kw, idx) => {
      const prompts = [
        `Wat is het beste ${kw} in Nederland?`,
        `Welke ${kw} partijen zijn gespecialiseerd in MKB groei?`,
        `Hoe kies ik een betrouwbare partner voor ${kw}?`
      ];

      const promptObjects = prompts.map(text => ({
        text,
        status: 'Not Mentioned',
        engines: ['chatgpt', 'gemini', 'perplexity'],
        brandsCount: 0,
        sourcesCount: 0
      }));

      const newKw = {
        id: Date.now() + idx,
        text: kw.toLowerCase(),
        rank: '-',
        sov: 0,
        position: '-',
        volume: '100',
        brands: ['saleswizard'],
        prompts: promptObjects
      };

      addedKeywords.push(newKw);
      
      prompts.forEach(pText => {
        generatedPrompts.push({
          text: pText,
          tag: 'AI Generated'
        });
      });
    });

    setKeywords(prev => [...addedKeywords, ...prev]);
    setKeywordInput('');
    setGeneratedFeedback(generatedPrompts);

    // Autoexpand the first added keyword
    if (addedKeywords.length > 0) {
      setExpandedKeywords(prev => {
        const next = new Set(prev);
        next.add(addedKeywords[0].id);
        return next;
      });
    }
  };

  const handleDeleteKeyword = (id) => {
    setKeywords(keywords.filter(kw => kw.id !== id));
  };

  const handleArchiveKeyword = (kw) => {
    setKeywords(keywords.filter(k => k.id !== kw.id));
    setArchivedKeywords([kw, ...archivedKeywords]);
  };

  // Brand logo mapping details
  const getBrandLogo = (brandKey) => {
    const brandMap = {
      saleswizard: { label: 'S', color: '#440099', text: 'white' },
      doublesmart: { label: 'D', color: '#06b6d4', text: 'white' },
      perplexity: { label: 'P', color: '#139ea5', text: 'white' },
      google: { label: 'G', color: '#ea4335', text: 'white' },
      chatgpt: { label: 'C', color: '#10a37f', text: 'white' },
      gemini: { label: 'G', color: '#1a73e8', text: 'white' },
      inoma: { label: 'I', color: '#22c55e', text: 'white' },
      trafficbuilders: { label: 'T', color: '#f97316', text: 'white' },
      emerce: { label: 'E', color: '#ec4899', text: 'white' }
    };
    return brandMap[brandKey] || { label: '?', color: '#64748b', text: 'white' };
  };

  const filteredKeywords = keywords.filter(kw => 
    kw.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header bar */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Keywords</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Beheer uw keywords voor AI-zoekmachine monitoring. Klik op een rij om de prompt explorer te openen.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAdding(!isAdding);
            setGeneratedFeedback([]);
          }}
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
            boxShadow: 'var(--shadow-md)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
        >
          <Plus size={16} />
          Add Keywords
        </button>
      </div>

      {/* Prompts Limits Usage Card */}
      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 800 }}>PROMPTS IN USE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
              {totalUsedPrompts}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {activeLimit} prompts</span>
          </div>
        </div>

        <div style={{ flex: 1, maxWidth: '300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>Limit utilization</span>
            <span>{Math.round((totalUsedPrompts / activeLimit) * 100)}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min((totalUsedPrompts / activeLimit) * 100, 100)}%`,
              height: '100%',
              backgroundColor: isLimitReached ? '#ef4444' : 'var(--brand-primary)',
              borderRadius: '4px'
            }}></div>
          </div>
        </div>

        {currentUser.role === 'klant' && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Basis ({currentUser.subscription === 'AI Starter' ? 15 : currentUser.subscription === 'AI Pro' ? 30 : 100}) 
            {currentUser.addonPrompts > 0 && ` + Add-on (${currentUser.addonPrompts})`}
          </div>
        )}
      </div>

      {/* Prompts Limit Reached Warnings Alert */}
      {isLimitReached && (
        <div className="card" style={{ border: '1px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.02)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'start' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#ef4444' }}>Prompts Limiet Bereikt!</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                U gebruikt momenteel **{totalUsedPrompts}** van de **{activeLimit}** prompts uit uw abonnement. Schaf hieronder direct extra prompts tracking-capaciteit aan voor **€1,50 per prompt per maand** om meer keywords of custom prompts te monitoren.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '12px', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', alignSelf: 'center', marginRight: '6px' }}>
              Koop extra prompts:
            </span>
            {[10, 20, 30, 40, 50].map((addCount) => {
              const currentTotal = currentUser.addonPrompts || 0;
              const isCurrent = currentTotal === addCount;
              return (
                <button
                  key={addCount}
                  onClick={() => onUpdateAddonPrompts(addCount)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isCurrent ? 'var(--brand-primary)' : 'rgba(68,0,153,0.04)',
                    color: isCurrent ? 'white' : 'var(--brand-primary)',
                    border: '1px solid var(--brand-primary-hover)',
                    cursor: 'pointer'
                  }}
                >
                  +{addCount} prompts (+€{addCount * 1.50}/m)
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Keywords Form Panel */}
      {isAdding && (
        <form onSubmit={handleAddKeywords} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--brand-light-border)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} style={{ color: '#a78bfa' }} />
            Add Keywords & Generate Prompts
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Keywords (comma-separated)</label>
            <textarea
              rows={2}
              placeholder="e.g. seo arnhem, online marketing bureau, ads uitbesteden"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              required
              disabled={isLimitReached}
              style={{ width: '100%' }}
            />
            {isLimitReached ? (
              <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>
                Verhoog eerst uw prompts limiet hierboven om keywords toe te voegen.
              </span>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Our AI Prompts Generator will automatically create 3 natural question prompts for each keyword to scan AI search engines.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--border-medium)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLimitReached}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: isLimitReached ? 'var(--border-medium)' : 'var(--brand-primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Genereer Prompts & Voeg Toe
            </button>
          </div>
        </form>
      )}

      {/* Search Filter */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Search size={16} style={{ opacity: 0.5 }} />
        <input
          type="text"
          placeholder="Filter keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ border: 'none', padding: '4px', flex: 1, backgroundColor: 'transparent', outline: 'none' }}
        />
      </div>

      {/* Keywords Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th style={{ width: '120px' }}>Rank</th>
              <th style={{ width: '180px' }}>Share of Voice</th>
              <th style={{ width: '100px' }}>Position</th>
              <th style={{ width: '140px' }}>Search Volume</th>
              <th>Top Brands</th>
              <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredKeywords.map((kw) => {
              const isExpanded = expandedKeywords.has(kw.id);
              const activeTab = getKeywordTab(kw.id);
              const isEditMode = getEditPromptMode(kw.id);

              return (
                <React.Fragment key={kw.id}>
                  {/* Primary Row */}
                  <tr 
                    style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'rgba(68, 0, 153, 0.02)' : 'transparent' }}
                    onClick={() => handleToggleRow(kw.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isExpanded ? (
                          <ChevronDown size={14} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                        ) : (
                          <ChevronRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                        )}
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{kw.text}</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)' }}>
                          🇳🇱 NL
                        </span>
                      </div>
                    </td>
                    
                    <td style={{ fontWeight: 700, color: kw.rank !== '-' ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                      {kw.rank}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '24px' }}>{kw.sov}%</span>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.max(kw.sov, 2)}%`,
                            height: '100%',
                            backgroundColor: kw.sov > 0 ? 'var(--brand-accent)' : 'var(--border-medium)',
                            borderRadius: '3px'
                          }}></div>
                        </div>
                      </div>
                    </td>

                    <td style={{ fontWeight: 600 }}>
                      {kw.position}
                    </td>

                    <td style={{ color: 'var(--text-muted)' }}>
                      {kw.volume}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {kw.brands.map(brandKey => {
                          const details = getBrandLogo(brandKey);
                          return (
                            <div
                              key={brandKey}
                              title={brandKey}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: details.color,
                                color: details.text,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '9px',
                                fontWeight: 800,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                            >
                              {details.label}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleArchiveKeyword(kw)}
                          title="Archive Keyword"
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            color: 'var(--text-muted)',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-primary)'; e.currentTarget.style.backgroundColor = 'var(--brand-light)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Archive size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteKeyword(kw.id)}
                          title="Delete Keyword"
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            color: 'var(--text-muted)',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Tabs Detail view matching LLMrefs */}
                  {isExpanded && (
                    <tr style={{ backgroundColor: 'rgba(68, 0, 153, 0.01)' }}>
                      <td colSpan="7" style={{ padding: '0px' }}>
                        
                        {/* Subtabs Header */}
                        <div style={{
                          display: 'flex',
                          borderBottom: '1px solid var(--border-light)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          paddingLeft: '48px'
                        }}>
                          {[
                            { id: 'rankings', label: 'Rankings' },
                            { id: 'prompts', label: `Prompts (${kw.prompts.length})` },
                            { id: 'sources', label: 'Sources' },
                            { id: 'shopping', label: 'Shopping' },
                            { id: 'settings', label: 'Settings' }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setKeywordTab(kw.id, t.id)}
                              style={{
                                padding: '12px 20px',
                                fontSize: '13px',
                                fontWeight: activeTab === t.id ? 700 : 500,
                                color: activeTab === t.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                                borderBottom: activeTab === t.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
                                backgroundColor: 'transparent',
                                borderTop: 'none',
                                borderLeft: 'none',
                                borderRight: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        {/* Subtabs Body panels */}
                        <div style={{ padding: '20px 48px 24px' }}>
                          
                          {/* TAB: RANKINGS */}
                          {activeTab === 'rankings' && (
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <h4 style={{ fontWeight: 800 }}>Keyword Ranking History for '{kw.text}'</h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Historic organic position within traditional search vs AI grounding citations.
                              </p>
                              <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: 'var(--bg-card)' }}>
                                <div><strong>Google Rank:</strong> {kw.rank}</div>
                                <div><strong>Avg AI Position:</strong> {kw.position}</div>
                                <div><strong>Share of Voice:</strong> {kw.sov}%</div>
                              </div>
                            </div>
                          )}

                          {/* TAB: PROMPTS (Explorer with Edit & Add capabilities) */}
                          {activeTab === 'prompts' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              
                              <div className="flex-between">
                                <div>
                                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Prompt explorer</h4>
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Breakdown of AI responses & sources for this keyword</span>
                                </div>
                                <button
                                  onClick={() => toggleEditPromptMode(kw.id)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-medium)',
                                    backgroundColor: isEditMode ? 'var(--brand-light)' : 'transparent',
                                    color: 'var(--brand-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  {isEditMode ? <X size={12} /> : <Edit2 size={12} />}
                                  {isEditMode ? 'Klaar met bewerken' : 'Edit prompts'}
                                </button>
                              </div>

                              {/* Prompts explorer list */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {kw.prompts.map((p, pIdx) => (
                                  <div 
                                    key={pIdx} 
                                    className="card" 
                                    style={{ 
                                      padding: '12px 16px', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between', 
                                      gap: '12px',
                                      backgroundColor: 'var(--bg-card)',
                                      border: '1px solid var(--border-light)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {p.text}
                                      </span>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                                        {p.mentioned && (
                                          <span className="badge badge-positive" style={{ fontSize: '9px', padding: '1px 6px' }}>
                                            ✓ Mentioned
                                          </span>
                                        )}
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                          <span style={{ color: 'var(--brand-accent)' }}>{p.brandsCount || 0}</span> Brands
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                          <span style={{ color: '#eab308' }}>{p.sourcesCount || 0}</span> Sources
                                        </span>
                                        
                                        <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                                          {p.engines.map(eng => (
                                            <span 
                                              key={eng} 
                                              style={{ 
                                                fontSize: '8px', 
                                                fontWeight: 800, 
                                                textTransform: 'uppercase', 
                                                padding: '1px 4px', 
                                                borderRadius: '3px', 
                                                backgroundColor: '#ece0ff', 
                                                color: 'var(--brand-primary)' 
                                              }}
                                            >
                                              {eng === 'chatgpt' ? 'GPT' : eng === 'gemini' ? 'GEM' : eng === 'perplexity' ? 'PPLX' : eng === 'copilot' ? 'COPI' : eng.toUpperCase()}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Action items depending on Edit Mode */}
                                    {isEditMode ? (
                                      <button
                                        onClick={() => handleDeletePrompt(kw.id, p.text)}
                                        title="Verwijder prompt"
                                        style={{
                                          padding: '8px',
                                          borderRadius: '4px',
                                          backgroundColor: 'transparent',
                                          color: '#ef4444'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    ) : (
                                      <button
                                        style={{
                                          padding: '6px 12px',
                                          borderRadius: '4px',
                                          backgroundColor: 'var(--brand-primary)',
                                          color: 'white',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                        onClick={() => alert(`Sandbox query gestart voor: "${p.text}"`)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
                                      >
                                        <Play size={10} />
                                        Test
                                      </button>
                                    )}

                                  </div>
                                ))}
                              </div>

                              {/* Edit Mode Custom Prompts Adder */}
                              {isEditMode && (
                                <div style={{
                                  borderTop: '1px dashed var(--border-medium)',
                                  paddingTop: '12px',
                                  marginTop: '6px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                                    Custom prompt toevoegen:
                                  </span>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                      type="text"
                                      placeholder="e.g. Wat kost een gemiddelde seo optimalisatie bij Saleswizard?"
                                      value={getCustomPromptInput(kw.id)}
                                      onChange={(e) => setCustomPromptInput(kw.id, e.target.value)}
                                      style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                                    />
                                    <button
                                      onClick={() => handleAddCustomPrompt(kw.id)}
                                      style={{
                                        backgroundColor: 'var(--brand-primary)',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        padding: '8px 16px',
                                        borderRadius: 'var(--border-radius-sm)',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Voeg toe
                                    </button>
                                  </div>
                                </div>
                              )}

                            </div>
                          )}

                          {/* TAB: SOURCES */}
                          {activeTab === 'sources' && (
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <h4 style={{ fontWeight: 800 }}>Grounding Sources cited for '{kw.text}'</h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Authority publications and directory portals crawlers use to refer users.
                              </p>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {kw.brands.map(b => (
                                  <span key={b} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                                    {b}.nl
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* TAB: SHOPPING */}
                          {activeTab === 'shopping' && (
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              <h4 style={{ fontWeight: 800 }}>AI Shopping Results</h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Simulated product recommendations and shopping citation summaries generated for this keyword query.
                              </p>
                            </div>
                          )}

                          {/* TAB: SETTINGS */}
                          {activeTab === 'settings' && (
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              <h4 style={{ fontWeight: 800 }}>Keyword Config</h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Change category tag mapping, adjust tracking weights, or alter scan frequency.
                              </p>
                            </div>
                          )}

                        </div>

                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Collapsible Archived Keywords Accordion */}
      <div className="card" style={{ padding: '0' }}>
        <button
          onClick={() => setIsArchivedOpen(!isArchivedOpen)}
          style={{
            width: '100%',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <span>Archived keywords ({archivedKeywords.length})</span>
          {isArchivedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isArchivedOpen && (
          <div style={{ borderTop: '1px solid var(--border-light)', padding: '12px' }}>
            <table className="premium-table" style={{ fontSize: '12px' }}>
              <tbody>
                {archivedKeywords.map(kw => (
                  <tr key={kw.id}>
                    <td><span style={{ textDecoration: 'line-through' }}>{kw.text}</span></td>
                    <td>{kw.rank}</td>
                    <td>{kw.sov}%</td>
                    <td>{kw.volume}</td>
                    <td>
                      <button
                        onClick={() => {
                          setArchivedKeywords(archivedKeywords.filter(k => k.id !== kw.id));
                          setKeywords([kw, ...keywords]);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          backgroundColor: 'var(--brand-light)',
                          color: 'var(--brand-primary)',
                          fontWeight: 700
                        }}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
