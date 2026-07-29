import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, Plus, Search, Archive, Trash2, 
  Sparkles, Play, Edit2, X, AlertTriangle, Loader2,
  ArrowLeft, Download, Share2
} from 'lucide-react';

export default function Keywords({ currentUser, activeWorkspace, onUpdateAddonPrompts }) {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [detailTab, setDetailTab] = useState('rankings');
  const [editPromptModes, setEditPromptModes] = useState({});
  const [customPromptInputs, setCustomPromptInputs] = useState({});
  const [keywordInput, setKeywordInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [totalUsedPrompts, setTotalUsedPrompts] = useState(0);

  // Sync archived keywords with localStorage per workspace
  const [archivedKeywords, setArchivedKeywords] = useState(() => {
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const saved = localStorage.getItem(`archived_keywords_${workspace}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const workspace = activeWorkspace || 'Saleswizard.nl';
    localStorage.setItem(`archived_keywords_${workspace}`, JSON.stringify(archivedKeywords));
  }, [archivedKeywords, activeWorkspace]);

  // Fetch active keywords from DB
  useEffect(() => {
    setLoading(true);
    setSelectedKeyword(null);
    const workspace = activeWorkspace || 'Saleswizard.nl';
    fetch(`/api/keywords?company=${encodeURIComponent(workspace)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const formatted = (data.keywords || []).map(k => ({
            id: k.id,
            text: k.keyword_text || k.keyword || '',
            rank: k.rank_google || '-',
            sov: k.share_of_voice || (k.competitors && k.competitors[0] ? k.competitors[0].sov : 0),
            position: k.average_position || (k.competitors && k.competitors[0] ? k.competitors[0].position : '-'),
            volume: k.search_volume || k.monthly_searches || '-',
            brands: k.brands_mentioned ? String(k.brands_mentioned).split(',').map(b => b.trim()) : [],
            competitors: k.competitors || [],
            prompts: (k.prompts || []).map(p => ({
              id: p.id,
              text: p.prompt_text || p.text || '',
              status: p.brand_mentioned ? 'Cited' : 'Not Cited',
              engines: ['chatgpt', 'gemini', 'perplexity'],
              brandsCount: p.brand_mentioned ? 1 : 0,
              sourcesCount: p.citations_count || 0
            }))
          }));
          setKeywords(formatted);
          
          let count = 0;
          formatted.forEach(f => {
            count += (f.prompts || []).length;
          });
          setTotalUsedPrompts(count);
        }
        setLoading(false);
      });
  }, [activeWorkspace]);

  const getPlanLimit = () => {
    const sub = currentUser?.subscription || 'AI Pro';
    const addon = currentUser?.addonPrompts || 0;
    let base = 15;
    if (sub === 'AI Pro') base = 30;
    if (sub === 'AI Enterprise') base = 60;
    return base + addon;
  };

  const activeLimit = getPlanLimit();
  const isLimitReached = totalUsedPrompts >= activeLimit;

  const getEditPromptMode = (kwId) => !!editPromptModes[kwId];
  const toggleEditPromptMode = (kwId) => {
    setEditPromptModes(prev => ({ ...prev, [kwId]: !prev[kwId] }));
  };

  const getCustomPromptInput = (kwId) => customPromptInputs[kwId] || '';
  const setCustomPromptInput = (kwId, val) => {
    setCustomPromptInputs(prev => ({ ...prev, [kwId]: val }));
  };

  const handleAddKeywords = async (e) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;

    const rawKeywords = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
    const promptsToGenerateCount = rawKeywords.length * 3;

    if (totalUsedPrompts + promptsToGenerateCount > activeLimit) {
      alert('U heeft onvoldoende prompts limiet over. Verhoog uw limiet.');
      return;
    }

    const workspace = activeWorkspace || 'Saleswizard.nl';

    try {
      for (const kwText of rawKeywords) {
        const kwResponse = await fetch('/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: workspace, keyword: kwText, volume: 100 })
        });
        const kwData = await kwResponse.json();

        if (kwData.success) {
          const insertedKw = kwData.keyword;
          
          const prompts = [
            `Wat is het beste ${kwText} in Nederland?`,
            `Welke ${kwText} partijen zijn gespecialiseerd in MKB groei?`,
            `Hoe kies ik een betrouwbare partner voor ${kwText}?`
          ];

          const savedPrompts = [];
          for (const pText of prompts) {
            const pResponse = await fetch('/api/prompts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ company: workspace, text: pText, tag: 'AI Generated' })
            });
            const pData = await pResponse.json();
            if (pData.success) {
              savedPrompts.push(pData.prompt);
            }
          }

          const newKw = {
            id: insertedKw.id,
            text: kwText,
            rank: '-',
            sov: 0,
            position: '-',
            volume: 100,
            brands: [workspace.replace('.nl', '').toLowerCase()],
            prompts: savedPrompts.map(p => ({
              id: p.id,
              text: p.text,
              status: 'Not Cited',
              engines: ['chatgpt', 'gemini', 'perplexity'],
              brandsCount: 0,
              sourcesCount: 0
            }))
          };

          setKeywords(prev => [newKw, ...prev]);
        }
      }

      setKeywordInput('');
      setTotalUsedPrompts(prev => prev + promptsToGenerateCount);
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to add keywords and prompts:', err);
    }
  };

  const handleDeleteKeyword = async (id) => {
    const kw = keywords.find(k => k.id === id);
    if (kw && kw.prompts) {
      for (const p of kw.prompts) {
        if (p.id) {
          try {
            await fetch(`/api/prompts/${p.id}`, { method: 'DELETE' });
          } catch (err) {
            console.error('Failed to delete prompt:', err);
          }
        }
      }
    }

    try {
      const response = await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setKeywords(keywords.filter(kw => kw.id !== id));
        setTotalUsedPrompts(prev => Math.max(0, prev - (kw ? kw.prompts.length : 0)));
        if (selectedKeyword && selectedKeyword.id === id) {
          setSelectedKeyword(null);
        }
      } else {
        alert('Fout bij verwijderen van keyword.');
      }
    } catch (err) {
      console.error('Failed to delete keyword:', err);
    }
  };

  const handleArchiveKeyword = async (kw) => {
    if (kw.prompts) {
      for (const p of kw.prompts) {
        if (p.id) {
          try {
            await fetch(`/api/prompts/${p.id}`, { method: 'DELETE' });
          } catch (err) {
            console.error('Failed to delete associated prompt:', err);
          }
        }
      }
    }

    try {
      const response = await fetch(`/api/keywords/${kw.id}`, { method: 'DELETE' });
      if (response.ok) {
        setKeywords(keywords.filter(k => k.id !== kw.id));
        setArchivedKeywords(prev => [kw, ...prev]);
        setTotalUsedPrompts(prev => Math.max(0, prev - (kw.prompts ? kw.prompts.length : 0)));
        if (selectedKeyword && selectedKeyword.id === kw.id) {
          setSelectedKeyword(null);
        }
      } else {
        alert('Fout bij archiveren van keyword.');
      }
    } catch (err) {
      console.error('Failed to archive keyword:', err);
    }
  };

  const handleRestoreKeyword = async (kw) => {
    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const kwResponse = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: workspace, keyword: kw.text, volume: kw.volume })
      });
      const kwData = await kwResponse.json();

      if (kwData.success) {
        const insertedKw = kwData.keyword;
        const prompts = [
          `Wat is het beste ${kw.text} in Nederland?`,
          `Welke ${kw.text} partijen zijn gespecialiseerd in MKB groei?`,
          `Hoe kies ik een betrouwbare partner voor ${kw.text}?`
        ];

        const savedPrompts = [];
        for (const pText of prompts) {
          const pResponse = await fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: workspace, text: pText, tag: 'AI Generated' })
          });
          const pData = await pResponse.json();
          if (pData.success) {
            savedPrompts.push(pData.prompt);
          }
        }

        const restoredKw = {
          ...kw,
          id: insertedKw.id,
          prompts: savedPrompts.map(p => ({
            id: p.id,
            text: p.text,
            status: 'Not Cited',
            engines: ['chatgpt', 'gemini', 'perplexity'],
            brandsCount: 0,
            sourcesCount: 0
          }))
        };

        setKeywords(prev => [restoredKw, ...prev]);
        setArchivedKeywords(prev => prev.filter(k => k.id !== kw.id));
        setTotalUsedPrompts(prev => prev + prompts.length);
      }
    } catch (err) {
      console.error('Failed to restore keyword:', err);
    }
  };

  const getBrandLogo = (brandKey) => {
    if (!brandKey) return { label: '?', color: '#64748b', text: 'white' };
    const key = String(brandKey).toLowerCase();
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
    return brandMap[key] || { label: String(brandKey)[0]?.toUpperCase() || '?', color: '#64748b', text: 'white' };
  };

  const getBrandRankings = (kwParam) => {
    let comps = [];
    if (kwParam && typeof kwParam === 'object' && Array.isArray(kwParam.competitors) && kwParam.competitors.length > 0) {
      comps = kwParam.competitors;
    } else if (typeof kwParam === 'string' && selectedKeyword && selectedKeyword.text === kwParam && Array.isArray(selectedKeyword.competitors) && selectedKeyword.competitors.length > 0) {
      comps = selectedKeyword.competitors;
    }

    if (comps && comps.length > 0) {
      return comps.map((item, idx) => ({
        rank: `#${idx + 1}`,
        brand: item.brand,
        domain: item.domain,
        isSelf: !!item.isSelf,
        sov: item.sov || 0,
        position: item.position || '-',
        citations: item.citations || 0
      }));
    }

    const keywordText = typeof kwParam === 'string' ? kwParam : (kwParam?.text || '');
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const cleanWorkspace = workspace.replace('.nl', '').trim();
    const domain = workspace.toLowerCase().includes('.') ? workspace.toLowerCase() : `${workspace.toLowerCase()}.nl`;

    let competitors = [
      { name: 'DoubleSmart', domain: 'doublesmart.nl' },
      { name: 'Inoma ICT', domain: 'inoma.nl' },
      { name: 'Traffic Builders', domain: 'trafficbuilders.nl' }
    ];

    const allBrands = [
      { name: cleanWorkspace, domain: domain, isSelf: true },
      ...competitors.map(c => ({ ...c, isSelf: false }))
    ];

    const seed = keywordText ? keywordText.length : 10;
    const sorted = allBrands.map((b, idx) => {
      const sov = Math.max(5, Math.round(((seed + idx * 7) % 35) + 5));
      const posVal = (((seed + idx * 3) % 40) / 10 + 1.5).toFixed(1);
      const urlsCount = Math.max(0, Math.round((seed + idx * 2) % 6));

      return {
        brand: b.name,
        domain: b.domain,
        isSelf: b.isSelf,
        sov,
        position: posVal,
        citations: urlsCount
      };
    }).sort((a, b) => b.sov - a.sov);

    return sorted.map((item, idx) => ({
      rank: `#${idx + 1}`,
      ...item
    }));
  };

  const handleAddCustomPrompt = async (kwId) => {
    const input = getCustomPromptInput(kwId);
    if (!input.trim()) return;

    if (isLimitReached) {
      alert('Limiet bereikt. Verhoog uw abonnement of koop extra prompts.');
      return;
    }

    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: workspace, text: input, tag: 'Custom' })
      });
      const data = await response.json();

      if (data.success) {
        setKeywords(prev => prev.map(k => {
          if (k.id === kwId) {
            return {
              ...k,
              prompts: [
                ...(k.prompts || []),
                {
                  id: data.prompt.id,
                  text: data.prompt.prompt_text,
                  status: 'Not Cited',
                  engines: ['chatgpt', 'gemini', 'perplexity'],
                  brandsCount: 0,
                  sourcesCount: 0
                }
              ]
            };
          }
          return k;
        }));

        if (selectedKeyword && selectedKeyword.id === kwId) {
          setSelectedKeyword(prev => ({
            ...prev,
            prompts: [
              ...(prev.prompts || []),
              {
                id: data.prompt.id,
                text: data.prompt.prompt_text,
                status: 'Not Cited',
                engines: ['chatgpt', 'gemini', 'perplexity'],
                brandsCount: 0,
                sourcesCount: 0
              }
            ]
          }));
        }

        setCustomPromptInput(kwId, '');
        setTotalUsedPrompts(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePrompt = async (kwId, promptText) => {
    const kw = keywords.find(k => k.id === kwId);
    if (!kw) return;
    const target = (kw.prompts || []).find(p => p.text === promptText);
    if (!target || !target.id) return;

    try {
      const res = await fetch(`/api/prompts/${target.id}`, { method: 'DELETE' });
      if (res.ok) {
        setKeywords(prev => prev.map(k => {
          if (k.id === kwId) {
            return {
              ...k,
              prompts: (k.prompts || []).filter(p => p.text !== promptText)
            };
          }
          return k;
        }));

        if (selectedKeyword && selectedKeyword.id === kwId) {
          setSelectedKeyword(prev => ({
            ...prev,
            prompts: (prev.prompts || []).filter(p => p.text !== promptText)
          }));
        }

        setTotalUsedPrompts(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredKeywords = keywords.filter(kw => 
    kw && kw.text ? String(kw.text).toLowerCase().includes((searchQuery || '').toLowerCase()) : false
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <Loader2 className="spin" size={32} style={{ color: 'var(--brand-primary)' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>Keywords en prompts laden...</span>
      </div>
    );
  }

  // --- DEDICATED KEYWORD DETAIL PAGE VIEW ---
  if (selectedKeyword) {
    const kw = selectedKeyword;
    const isEditMode = getEditPromptMode(kw.id);

    return (
      <div className="fade-in" style={{
        padding: '40px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        width: '100%',
        overflowY: 'auto'
      }}>
        {/* Detail Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSelectedKeyword(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                background: 'none',
                fontSize: '20px',
                fontWeight: 800,
                color: '#111827',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              <ArrowLeft size={20} />
              Keyword: {kw.text}
            </button>
            <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Last updated: 29 Jul 2026</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '20px', border: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>
              🇳🇱 Netherlands
            </span>
            <button
              type="button"
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: '#374151'
              }}
              onClick={() => alert('Exporting CSV...')}
            >
              <Download size={12} />
              Export CSV
            </button>
            <button
              type="button"
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                backgroundColor: '#000000',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                border: 'none'
              }}
              onClick={() => alert('Share link copied!')}
            >
              <Share2 size={12} />
              Share
            </button>
          </div>
        </div>

        {/* Subtabs Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', gap: '8px' }}>
          {[
            { id: 'rankings', label: 'Rankings' },
            { id: 'prompts', label: `Prompts (${(kw.prompts || []).length})` },
            { id: 'sources', label: 'Sources' },
            { id: 'shopping', label: 'Shopping' },
            { id: 'settings', label: 'Settings' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setDetailTab(t.id)}
              style={{
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: detailTab === t.id ? 700 : 500,
                color: detailTab === t.id ? '#111827' : '#6b7280',
                borderBottom: detailTab === t.id ? '2px solid #000000' : '2px solid transparent',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: RANKINGS */}
        {detailTab === 'rankings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>Brand rankings</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  Overview of all brands & visibility for this keyword
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#6b7280' }}>
                <span>AI Search Engines</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['C', 'G', 'P', 'B'].map((e, idx) => (
                    <span key={idx} style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800 }}>{e}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Position History Bar */}
            <div style={{ padding: '24px', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
                <span>Position History</span>
                <span>Rank 1 (Top) to 20</span>
              </div>
              <div style={{ height: '80px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                {[
                  { date: '17 Jul 2026', val: 30 },
                  { date: '18 Jul 2026', val: 45 },
                  { date: '19 Jul 2026', val: 60 },
                  { date: '20 Jul 2026', val: 75 },
                  { date: '21 Jul 2026', val: 90 }
                ].map((item, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '100%', backgroundColor: 'var(--brand-primary)', height: `${item.val}%`, borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>{item.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitor Table */}
            <div style={{ overflow: 'hidden', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Rank</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Brand</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Share of Voice</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Position</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Citations</th>
                  </tr>
                </thead>
                <tbody>
                  {getBrandRankings(kw).map((r, rIdx) => {
                    const colors = [
                      { bg: '#fee2e2', text: '#ef4444' },
                      { bg: '#e0e7ff', text: '#6366f1' },
                      { bg: '#dcfce7', text: '#22c55e' },
                      { bg: '#fef9c3', text: '#eab308' },
                      { bg: '#f3e8ff', text: '#a855f7' }
                    ];
                    const avatarColor = colors[r.brand.charCodeAt(0) % colors.length];

                    return (
                      <tr 
                        key={rIdx} 
                        style={{ 
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: r.isSelf ? '#fffbebf0' : 'transparent',
                          fontWeight: r.isSelf ? 700 : 400
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#111827' }}>{r.rank}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              backgroundColor: avatarColor.bg,
                              color: avatarColor.text,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '11px'
                            }}>
                              {r.brand[0].toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: '#111827', fontWeight: 600 }}>{r.brand}</span>
                              <span style={{ fontSize: '11px', color: '#6b7280' }}>{r.domain}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontWeight: 700, color: '#111827' }}>{r.sov}%</span>
                            <div style={{ width: '100px', height: '4px', borderRadius: '2px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                              <div style={{ width: `${r.sov}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '2px' }}></div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#374151' }}>{r.position}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: r.citations > 0 ? '#fef3c7' : '#f3f4f6',
                            color: r.citations > 0 ? '#b45309' : '#6b7280',
                            fontWeight: 700
                          }}>
                            {r.citations} {r.citations === 1 ? 'URL' : 'URLs'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: PROMPTS */}
        {detailTab === 'prompts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Prompt explorer</h4>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Breakdown of AI responses & sources for this keyword</span>
              </div>
              <button
                type="button"
                onClick={() => toggleEditPromptMode(kw.id)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: isEditMode ? '#f3f4f6' : 'transparent',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                {isEditMode ? <X size={14} /> : <Edit2 size={14} />}
                {isEditMode ? 'Klaar met bewerken' : 'Edit prompts'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(kw.prompts || []).map((p, pIdx) => (
                <div 
                  key={pIdx} 
                  style={{ 
                    padding: '14px 20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{p.text}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: p.status === 'Cited' ? '#dcfce7' : '#f3f4f6',
                        color: p.status === 'Cited' ? '#16a34a' : '#6b7280',
                        fontWeight: 700
                      }}>
                        {p.status}
                      </span>
                    </div>
                  </div>

                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => handleDeletePrompt(kw.id, p.text)}
                      title="Verwijder prompt"
                      style={{ padding: '8px', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#000000',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        border: 'none'
                      }}
                      onClick={() => alert(`Sandbox query gestart voor: "${p.text}"`)}
                    >
                      <Play size={10} />
                      Test
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isEditMode && (
              <div style={{
                borderTop: '1px dashed #e5e7eb',
                paddingTop: '16px',
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>
                  Custom prompt toevoegen:
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Wat kost een gemiddelde seo optimalisatie bij Saleswizard?"
                    value={getCustomPromptInput(kw.id)}
                    onChange={(e) => setCustomPromptInput(kw.id, e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomPrompt(kw.id)}
                    style={{
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: 'none'
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
        {detailTab === 'sources' && (
          <div style={{ fontSize: '13px', color: '#374151', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontWeight: 700, color: '#111827' }}>Grounding Sources cited for '{kw.text}'</h4>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              Authority publications and directory portals crawlers use to refer users.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              {(kw.brands || []).map(b => (
                <span key={b} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827', fontWeight: 600 }}>
                  {b}.nl
                </span>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SHOPPING */}
        {detailTab === 'shopping' && (
          <div style={{ fontSize: '13px', color: '#374151' }}>
            <h4 style={{ fontWeight: 700, color: '#111827' }}>AI Shopping Results</h4>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Simulated product recommendations and shopping citation summaries generated for this keyword query.
            </p>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {detailTab === 'settings' && (
          <div style={{ fontSize: '13px', color: '#374151' }}>
            <h4 style={{ fontWeight: 700, color: '#111827' }}>Keyword Config</h4>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Change category tag mapping, adjust tracking weights, or alter scan frequency.
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN KEYWORDS LIST VIEW ---
  return (
    <div className="fade-in" style={{
      padding: '40px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      backgroundColor: '#ffffff',
      minHeight: '100vh',
      width: '100%',
      overflowY: 'auto'
    }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#111827',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.5px'
          }}>
            Keywords
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>
            Setup your keywords for {activeWorkspace ? activeWorkspace.replace('.nl', '') : 'Saleswizard'} brand visibility tracking.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
            Prompts: {totalUsedPrompts} / {activeLimit}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsAdding(!isAdding);
            }}
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
            Add Keywords
          </button>
        </div>
      </div>

      {/* Add Keywords Form */}
      {isAdding && (
        <form onSubmit={handleAddKeywords} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          backgroundColor: '#f9fafb'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#111827' }}>
            <Sparkles size={16} style={{ color: 'var(--brand-primary)' }} />
            Add Keywords & Generate Prompts
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>Keywords (comma-separated)</label>
            <textarea
              rows={2}
              placeholder="e.g. seo arnhem, online marketing bureau, ads uitbesteden"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              required
              disabled={isLimitReached}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13px'
              }}
            />
            {isLimitReached ? (
              <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>
                Verhoog eerst uw prompts limiet om keywords toe te voegen.
              </span>
            ) : (
              <p style={{ fontSize: '11px', color: '#6b7280' }}>
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
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: '#ffffff'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLimitReached}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: isLimitReached ? '#e5e7eb' : 'var(--brand-primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                cursor: isLimitReached ? 'not-allowed' : 'pointer'
              }}
            >
              Genereer Prompts & Voeg Toe
            </button>
          </div>
        </form>
      )}

      {/* Filter box */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Filter keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px 10px 42px',
            borderRadius: '24px',
            border: '1px solid #e5e7eb',
            fontSize: '14px',
            backgroundColor: '#ffffff',
            color: '#1f2937',
            outline: 'none',
            transition: 'border-color 0.15s ease'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
        />
      </div>

      {/* Keywords Table */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Keyword</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Rank</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Share of Voice</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Position</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Search Volume</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Top Brands</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', textAlign: 'center', width: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredKeywords.map((kw) => (
              <tr 
                key={kw.id}
                style={{
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background-color 0.15s ease'
                }}
                onClick={() => {
                  setSelectedKeyword(kw);
                  setDetailTab('rankings');
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>{kw.text}</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 700 }}>
                      🇳🇱 NL
                    </span>
                  </div>
                </td>
                
                <td style={{ padding: '16px', fontWeight: 700, color: kw.rank !== '-' ? '#111827' : '#9ca3af' }}>
                  {kw.rank}
                </td>

                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '32px', color: '#111827' }}>{kw.sov}%</span>
                    <div style={{ width: '80px', height: '4px', borderRadius: '2px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{
                        width: `${kw.sov}%`,
                        height: '100%',
                        backgroundColor: '#f59e0b',
                        borderRadius: '2px'
                      }}></div>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>
                  {kw.position}
                </td>

                <td style={{ padding: '16px', color: '#6b7280' }}>
                  {kw.volume}
                </td>

                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(kw.brands || []).slice(0, 5).map((brandKey, bIdx) => {
                      const details = getBrandLogo(brandKey);
                      return (
                        <div 
                          key={brandKey || bIdx}
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
                            border: '1px solid #ffffff'
                          }}
                        >
                          {details.label}
                        </div>
                      );
                    })}
                  </div>
                </td>

                <td style={{ padding: '16px' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleArchiveKeyword(kw)}
                      title="Archive Keyword"
                      style={{ padding: '6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteKeyword(kw.id)}
                      title="Delete Keyword"
                      style={{ padding: '6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Collapsible Archived Keywords Accordion */}
      <div style={{ marginTop: '16px' }}>
        <button
          type="button"
          onClick={() => setIsArchivedOpen(!isArchivedOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '14px',
            color: '#4b5563',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '8px 0px'
          }}
        >
          <span>Archived keywords ({archivedKeywords.length})</span>
          {isArchivedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isArchivedOpen && archivedKeywords.length > 0 && (
          <div style={{ marginTop: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <tbody>
                {archivedKeywords.map(kw => (
                  <tr key={kw.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px' }}><span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>{kw.text}</span></td>
                    <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{kw.rank}</td>
                    <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{kw.sov}%</td>
                    <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{kw.volume}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        type="button"
                        onClick={() => handleRestoreKeyword(kw)}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#f3f4f6',
                          color: '#111827',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none'
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
