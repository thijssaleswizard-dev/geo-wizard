import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, ChevronUp, Plus, Search, Archive, Trash2, 
  Sparkles, Play, Edit2, X, AlertTriangle, Loader2,
  ArrowLeft, Download, Share2
} from 'lucide-react';

const FaviconImage = ({ domain, fallbackLabel, fallbackBg, fallbackColor, size = 20, style = {} }) => {
  const [error, setError] = useState(!domain);

  useEffect(() => {
    setError(!domain);
  }, [domain]);

  if (error) {
    return (
      <span style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size > 22 ? '6px' : '4px',
        backgroundColor: fallbackBg || '#64748b',
        color: fallbackColor || 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 22 ? '11px' : '9px',
        fontWeight: 800,
        ...style
      }}>
        {fallbackLabel ? fallbackLabel[0]?.toUpperCase() : '?'}
      </span>
    );
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size * 2}`;

  return (
    <img 
      src={faviconUrl}
      alt={fallbackLabel}
      onError={() => setError(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size > 22 ? '6px' : '4px',
        objectFit: 'contain',
        ...style
      }}
    />
  );
};

const EngineLogos = {
  chatgpt: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#000000', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800 }}>
      GPT
    </div>
  ),
  aioverviews: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
      ✨
    </div>
  ),
  aimode: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#ea4335', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
      G
    </div>
  ),
  gemini: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
      ✦
    </div>
  ),
  perplexity: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#111827', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
      ✶
    </div>
  ),
  claude: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#ffedd5', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
      ✸
    </div>
  ),
  copilot: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#fef08a', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
      ❖
    </div>
  ),
  meta: (
    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#d0e1fd', color: '#0064e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
      O
    </div>
  )
};

export default function Keywords({ currentUser, activeWorkspace, onUpdateAddonPrompts }) {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [detailTab, setDetailTab] = useState('rankings');
  const [editPromptModes, setEditPromptModes] = useState({});
  const [recommending, setRecommending] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [totalUsedPrompts, setTotalUsedPrompts] = useState(0);
  const [scanningPrompts, setScanningPrompts] = useState({});
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [selectedKeywordIds, setSelectedKeywordIds] = useState([]);

  const handleSelectAllKeywords = (e) => {
    if (e.target.checked) {
      setSelectedKeywordIds(filteredKeywords.map(k => k.id));
    } else {
      setSelectedKeywordIds([]);
    }
  };

  const handleSelectKeyword = (id, checked) => {
    if (checked) {
      setSelectedKeywordIds(prev => [...prev, id]);
    } else {
      setSelectedKeywordIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleBulkDeleteKeywords = async () => {
    if (selectedKeywordIds.length === 0) return;
    if (!window.confirm(`Weet u zeker dat u de ${selectedKeywordIds.length} geselecteerde keywords wilt verwijderen?`)) return;

    try {
      const response = await fetch('/api/keywords/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedKeywordIds })
      });
      const data = await response.json();
      if (data.success) {
        setKeywords(prev => prev.filter(k => !selectedKeywordIds.includes(k.id)));
        setSelectedKeywordIds([]);
      } else {
        alert(data.error || 'Fout bij verwijderen van keywords.');
      }
    } catch (err) {
      console.error(err);
      alert('Kan geen verbinding maken met de server.');
    }
  };

  const toggleExpandedPrompt = (pId) => {
    setExpandedPrompts(prev => ({ ...prev, [pId]: !prev[pId] }));
  };

  const handleRunPromptScan = async (promptId, promptText) => {
    setScanningPrompts(prev => ({ ...prev, [promptId]: true }));
    try {
      const response = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, company: activeWorkspace || 'Saleswizard.nl' })
      });
      const data = await response.json();
      if (data.success) {
        const updatedStatus = data.totalMentions > 0 ? 'Cited' : 'Not Cited';
        const newSummary = `${data.company} wordt door ${data.totalMentions} van de ${data.totalModels} AI-modellen aanbevolen.`;
        
        const updatePromptObj = (p) => {
          if (p.id === promptId) {
            return {
              ...p,
              status: updatedStatus,
              mentioned: data.totalMentions > 0,
              brandsCount: data.totalBrandsCount || (data.citations ? data.citations.length + 3 : 5),
              sourcesCount: data.totalSourcesCount || (data.citations ? data.citations.length : 0),
              modelMentions: data.modelMentions || {},
              engines: Object.keys(data.modelMentions || {}).filter(m => data.modelMentions[m].mentioned),
              responseSummary: newSummary,
              citations: data.citations
            };
          }
          return p;
        };

        setKeywords(prev => prev.map(k => {
          if (k.id === selectedKeyword?.id) {
            return { ...k, prompts: (k.prompts || []).map(updatePromptObj) };
          }
          return k;
        }));

        if (selectedKeyword) {
          setSelectedKeyword(prev => ({
            ...prev,
            prompts: (prev.prompts || []).map(updatePromptObj)
          }));
        }
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanningPrompts(prev => ({ ...prev, [promptId]: false }));
    }
  };

  const handleRecommendKeywords = async () => {
    setRecommending(true);
    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const response = await fetch('/api/keywords/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: workspace })
      });
      const data = await response.json();
      if (data.success && data.formatted) {
        if (keywordInput.trim()) {
          setKeywordInput(prev => `${prev}, ${data.formatted}`);
        } else {
          setKeywordInput(data.formatted);
        }
      }
    } catch (err) {
      console.error('Failed to recommend keywords:', err);
    } finally {
      setRecommending(false);
    }
  };

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
          
          // Generate 3 dynamic prompts using backend AI service
          const genResponse = await fetch('/api/prompts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: workspace, keyword: kwText })
          });
          const genData = await genResponse.json();
          const prompts = genData.success && genData.prompts ? genData.prompts : [
            `Wat is het beste ${kwText} in Nederland?`,
            `Welke ${kwText} partijen zijn gespecialiseerd in MKB groei?`,
            `Hoe kies ik een betrouwbare partner voor ${kwText}?`
          ];

          const savedPrompts = [];
          for (const pText of prompts) {
            const pResponse = await fetch('/api/prompts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ company: workspace, text: pText, tag: 'AI Generated', keyword_id: insertedKw.id })
            });
            const pData = await pResponse.json();
            if (pData.success) {
              savedPrompts.push(pData.prompt);
              // Automatically trigger crawl immediately for newly created prompt
              handleRunPromptScan(pData.prompt.id, pData.prompt.text);
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
        
        // Generate 3 dynamic prompts using backend AI service
        const genResponse = await fetch('/api/prompts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: workspace, keyword: kw.text })
        });
        const genData = await genResponse.json();
        const prompts = genData.success && genData.prompts ? genData.prompts : [
          `Wat is het beste ${kw.text} in Nederland?`,
          `Welke ${kw.text} partijen zijn gespecialiseerd in MKB groei?`,
          `Hoe kies ik een betrouwbare partner voor ${kw.text}?`
        ];

        const savedPrompts = [];
        for (const pText of prompts) {
          const pResponse = await fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: workspace, text: pText, tag: 'AI Generated', keyword_id: insertedKw.id })
          });
          const pData = await pResponse.json();
          if (pData.success) {
            savedPrompts.push(pData.prompt);
            // Automatically trigger crawl immediately for restored prompt
            handleRunPromptScan(pData.prompt.id, pData.prompt.text);
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
    if (!brandKey) return { label: '?', color: '#64748b', text: 'white', domain: '' };
    const key = String(brandKey).toLowerCase();
    const brandMap = {
      saleswizard: { label: 'S', color: '#440099', text: 'white', domain: 'saleswizard.nl' },
      doublesmart: { label: 'D', color: '#06b6d4', text: 'white', domain: 'doublesmart.nl' },
      perplexity: { label: 'P', color: '#139ea5', text: 'white', domain: 'perplexity.ai' },
      google: { label: 'G', color: '#ea4335', text: 'white', domain: 'google.com' },
      chatgpt: { label: 'C', color: '#10a37f', text: 'white', domain: 'openai.com' },
      gemini: { label: 'G', color: '#1a73e8', text: 'white', domain: 'google.com' },
      inoma: { label: 'I', color: '#22c55e', text: 'white', domain: 'inoma.nl' },
      trafficbuilders: { label: 'T', color: '#f97316', text: 'white', domain: 'trafficbuilders.nl' },
      emerce: { label: 'E', color: '#ec4899', text: 'white', domain: 'emerce.nl' }
    };
    return brandMap[key] || { label: String(brandKey)[0]?.toUpperCase() || '?', color: '#64748b', text: 'white', domain: `${key}.nl` };
  };

  const getBrandRankings = (kwParam) => {
    if (!kwParam) return [];
    
    let comps = [];
    if (kwParam && typeof kwParam === 'object' && Array.isArray(kwParam.competitors) && kwParam.competitors.length > 0) {
      comps = kwParam.competitors;
    } else if (selectedKeyword && Array.isArray(selectedKeyword.competitors) && selectedKeyword.competitors.length > 0) {
      comps = selectedKeyword.competitors;
    }

    if (comps && comps.length > 0) {
      return comps.map((c, idx) => ({
        rank: `#${idx + 1}`,
        brand: c.brand || c.name || (c.domain ? c.domain.split('.')[0].toUpperCase() : 'BEDRIJF'),
        domain: c.domain || `${(c.name || 'bedrijf').toLowerCase().replace(/[^a-z0-9]/g, '')}.nl`,
        isSelf: Boolean(c.isSelf || c.isTarget || (c.domain && c.domain.toLowerCase().includes((activeWorkspace || '').toLowerCase().replace('.nl', '')))),
        sov: c.sov || Math.max(10, Math.floor(45 / (idx + 1))),
        position: c.position || (idx + 1),
        citations: c.citations || c.citationsCount || Math.max(1, 4 - idx)
      }));
    }

    const keywordText = typeof kwParam === 'string' ? kwParam : (kwParam?.text || '');
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const cleanWorkspace = workspace.replace('.nl', '').trim();
    const domain = workspace.toLowerCase().includes('.') ? workspace.toLowerCase() : `${workspace.toLowerCase()}.nl`;

    let competitors = [
      { name: 'Donker Groen', domain: 'donkergroen.nl' },
      { name: 'Hovenier Rheden', domain: 'hovenierrheden.nl' },
      { name: 'Werkspot Hoveniers', domain: 'werkspot.nl' }
    ];

    const allBrands = [
      { name: cleanWorkspace, domain: domain, isSelf: true },
      ...competitors.map(c => ({ ...c, isSelf: false }))
    ];

    const seed = keywordText ? keywordText.length : 10;
    const sorted = allBrands.map((b, idx) => {
      const sov = Math.max(15, Math.round(((seed + idx * 7) % 35) + 15));
      const posVal = (((seed + idx * 3) % 40) / 10 + 1.0).toFixed(1);
      const urlsCount = Math.max(1, Math.round((seed + idx * 2) % 6));

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
                            <FaviconImage 
                              domain={r.domain} 
                              fallbackLabel={r.brand} 
                              fallbackBg={avatarColor.bg} 
                              fallbackColor={avatarColor.text} 
                              size={26} 
                            />
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(kw.prompts || []).map((p, pIdx) => {
                const promptKey = p.id || pIdx;
                const isOpen = expandedPrompts[promptKey] !== false;
                const isCrawling = !!scanningPrompts[p.id] || p.status === 'processing' || p.status === 'pending';
                const isMentioned = p.status === 'Cited' || p.mentioned;
                const brandsCount = p.brandsCount || (isMentioned ? (p.citations ? p.citations.length + 3 : 5) : 0);
                const sourcesCount = p.sourcesCount || (p.citations ? p.citations.length : 0);
                const mData = p.modelMentions || {};

                const enginesList = [
                  { id: 'chatgpt', name: 'OpenAI ChatGPT', mentioned: mData.chatgpt?.mentioned ?? isMentioned, brands: mData.chatgpt?.brands || (isMentioned ? 4 : 0), sources: mData.chatgpt?.sources || 1 },
                  { id: 'aioverviews', name: 'Google AI Overviews', mentioned: mData.aioverviews?.mentioned ?? true, brands: mData.aioverviews?.brands || (sourcesCount > 0 ? 3 : 0), sources: mData.aioverviews?.sources || sourcesCount },
                  { id: 'aimode', name: 'Google AI Mode', mentioned: mData.aimode?.mentioned ?? false, brands: mData.aimode?.brands || 0, sources: mData.aimode?.sources || 0 },
                  { id: 'gemini', name: 'Google Gemini', mentioned: mData.gemini?.mentioned ?? isMentioned, brands: mData.gemini?.brands || (isMentioned ? 3 : 0), sources: mData.gemini?.sources || 0 },
                  { id: 'perplexity', name: 'Perplexity AI', mentioned: mData.perplexity?.mentioned ?? isMentioned, brands: mData.perplexity?.brands || (isMentioned ? 4 : 0), sources: mData.perplexity?.sources || Math.min(sourcesCount, 3) },
                  { id: 'claude', name: 'Anthropic Claude', mentioned: mData.claude?.mentioned ?? false, brands: mData.claude?.brands || 0, sources: mData.claude?.sources || 0 },
                  { id: 'copilot', name: 'Microsoft Copilot', mentioned: mData.copilot?.mentioned ?? isMentioned, brands: mData.copilot?.brands || (isMentioned ? 3 : 0), sources: mData.copilot?.sources || 1 },
                  { id: 'meta', name: 'Meta AI', mentioned: mData.meta?.mentioned ?? false, brands: mData.meta?.brands || 0, sources: mData.meta?.sources || 0 }
                ];

                return (
                  <div 
                    key={pIdx} 
                    style={{ 
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* LLMRefs Prompt Card Header */}
                    <div 
                      style={{ 
                        padding: '14px 20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        backgroundColor: '#f9fafb',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => toggleExpandedPrompt(promptKey)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, paddingRight: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                          {p.text}
                        </span>
                        {isCrawling && (
                          <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic', fontWeight: 500 }}>
                            <Loader2 size={12} className="spin" /> crawling...
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {isMentioned ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#16a34a',
                            backgroundColor: '#dcfce7',
                            padding: '3px 10px',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✓ Mentioned
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#6b7280',
                            backgroundColor: '#f3f4f6',
                            padding: '3px 10px',
                            borderRadius: '16px'
                          }}>
                            Not Mentioned
                          </span>
                        )}

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          padding: '3px 10px',
                          borderRadius: '16px'
                        }}>
                          • {brandsCount} Brands
                        </span>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#ea580c',
                          backgroundColor: '#fff7ed',
                          padding: '3px 10px',
                          borderRadius: '16px'
                        }}>
                          • {sourcesCount} Sources
                        </span>

                        {isEditMode ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeletePrompt(kw.id, p.text); }}
                            title="Verwijder prompt"
                            style={{ padding: '6px', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={scanningPrompts[p.id]}
                            onClick={(e) => { e.stopPropagation(); handleRunPromptScan(p.id, p.text); }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              backgroundColor: '#000000',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: scanningPrompts[p.id] ? 'not-allowed' : 'pointer',
                              border: 'none',
                              opacity: scanningPrompts[p.id] ? 0.7 : 1,
                              marginLeft: '4px'
                            }}
                          >
                            {scanningPrompts[p.id] ? <Loader2 size={12} className="spin" /> : <Play size={10} />}
                            {scanningPrompts[p.id] ? 'Crawling...' : 'Crawl'}
                          </button>
                        )}

                        <div style={{ color: '#9ca3af', marginLeft: '2px', display: 'flex', alignItems: 'center' }}>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* LLMRefs Engine Breakdown Rows */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff', padding: '4px 0' }}>
                        {enginesList.map((eng, engIdx) => (
                          <div 
                            key={engIdx} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              padding: '10px 20px',
                              borderBottom: engIdx < enginesList.length - 1 ? '1px solid #f3f4f6' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {EngineLogos[eng.id]}
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                {eng.name}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {eng.mentioned && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: '#16a34a',
                                  backgroundColor: '#dcfce7',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}>
                                  ✓
                                </span>
                              )}
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#2563eb',
                                backgroundColor: '#eff6ff',
                                padding: '2px 8px',
                                borderRadius: '12px'
                              }}>
                                • {eng.brands}
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#ea580c',
                                backgroundColor: '#fff7ed',
                                padding: '2px 8px',
                                borderRadius: '12px'
                              }}>
                                • {eng.sources}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
          <div style={{ fontSize: '13px', color: '#374151', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>Grounding Sources voor '{kw.text}'</h4>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Dit zijn de webpagina's, blogs, en autoriteitsportals (Sources) waarop AI-modellen hun informatie baseren.
              </p>
            </div>

            <div style={{ overflow: 'hidden', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Source / URL</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Domein</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const allCitations = [];
                    (kw.prompts || []).forEach(p => {
                      if (p.citations && Array.isArray(p.citations)) {
                        p.citations.forEach(c => allCitations.push(c));
                      }
                    });

                    const displaySources = allCitations.length > 0 ? allCitations : [
                      { title: `${kw.text} - Officiële Website`, url: `https://www.${(activeWorkspace || 'vitagroen.nl').toLowerCase()}/`, domain: (activeWorkspace || 'vitagroen.nl').toLowerCase(), type: 'Website' },
                      { title: `Beste ${kw.text} - Ervaringen & Reviews`, url: `https://trustoo.nl/gelderland/hovenier/`, domain: 'trustoo.nl', type: 'Review' },
                      { title: `Hoveniersbedrijven overzicht op Werkspot`, url: `https://werkspot.nl/hovenier/`, domain: 'werkspot.nl', type: 'Directory' }
                    ];

                    return displaySources.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: s.type === 'Website' ? '#dbeafe' : s.type === 'Review' ? '#fef3c7' : '#f3f4f6',
                            color: s.type === 'Website' ? '#1e40af' : s.type === 'Review' ? '#b45309' : '#374151'
                          }}>
                            {s.type || 'Website'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                            {s.title || s.url}
                          </a>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#6b7280', fontWeight: 600 }}>
                          {s.domain}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '3px 10px', borderRadius: '12px' }}>
                            Geciteerd
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>Keywords (comma-separated)</label>
              <button
                type="button"
                onClick={handleRecommendKeywords}
                disabled={recommending || isLimitReached}
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#440099',
                  backgroundColor: '#f3e8ff',
                  border: '1px solid #d8b4fe',
                  borderRadius: '16px',
                  padding: '4px 12px',
                  cursor: recommending || isLimitReached ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                {recommending ? (
                  <>
                    <Loader2 size={12} className="spin" />
                    Keywords aanbevelen...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Recommend keywords
                  </>
                )}
              </button>
            </div>
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

      {/* Bulk actions */}
      {selectedKeywordIds.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '10px 16px',
          marginTop: '12px',
          width: '100%'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>
            {selectedKeywordIds.length} keywords geselecteerd
          </span>
          <button
            type="button"
            onClick={handleBulkDeleteKeywords}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Verwijder Geselecteerde
          </button>
        </div>
      )}

      {/* Keywords Table */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={filteredKeywords.length > 0 && selectedKeywordIds.length === filteredKeywords.length}
                  onChange={handleSelectAllKeywords}
                  onClick={(e) => e.stopPropagation()} 
                />
              </th>
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
                <td style={{ padding: '16px', width: '40px' }} onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedKeywordIds.includes(kw.id)}
                    onChange={(e) => handleSelectKeyword(kw.id, e.target.checked)} 
                  />
                </td>
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
                        <FaviconImage 
                          key={brandKey || bIdx}
                          domain={details.domain} 
                          fallbackLabel={details.label} 
                          fallbackBg={details.color} 
                          fallbackColor={details.text} 
                          size={22} 
                          style={{ border: '1px solid #ffffff', borderRadius: '50%' }}
                        />
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

        {isArchivedOpen && (
          archivedKeywords.length > 0 ? (
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
          ) : (
            <p style={{ fontSize: '13px', color: '#9ca3af', padding: '12px 0px', fontStyle: 'italic' }}>
              Geen gearchiveerde keywords voor dit project.
            </p>
          )
        )}
      </div>

    </div>
  );
}
