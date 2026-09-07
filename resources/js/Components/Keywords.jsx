import React, { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp, Plus, Search, Archive, Trash2,
  Sparkles, Play, Edit2, X, AlertTriangle, Loader2,
  ArrowLeft, Download, Share2
} from 'lucide-react';

const FaviconImage = ({ domain, fallbackLabel, fallbackBg, fallbackColor, size = 20, style = {} }) => {
  const [error, setError] = useState(false);
  const cleanDomain = (domain || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .trim();

  useEffect(() => {
    setError(false);
  }, [cleanDomain]);

  if (error || !cleanDomain) {
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

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${size * 2}`;

  return (
    <img
      src={faviconUrl}
      alt={fallbackLabel || cleanDomain}
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
    <img
      src="https://www.google.com/s2/favicons?domain=openai.com&sz=48"
      alt="ChatGPT"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  aioverviews: (
    <img
      src="https://www.google.com/s2/favicons?domain=google.com&sz=48"
      alt="AI Overviews"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  aimode: (
    <img
      src="https://www.google.com/s2/favicons?domain=google.com&sz=48"
      alt="AI Mode"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  gemini: (
    <img
      src="https://www.google.com/s2/favicons?domain=gemini.google.com&sz=48"
      alt="Gemini"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  perplexity: (
    <img
      src="https://www.google.com/s2/favicons?domain=perplexity.ai&sz=48"
      alt="Perplexity"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  claude: (
    <img
      src="https://www.google.com/s2/favicons?domain=claude.ai&sz=48"
      alt="Claude"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  copilot: (
    <img
      src="https://www.google.com/s2/favicons?domain=copilot.microsoft.com&sz=48"
      alt="Copilot"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  meta: (
    <img
      src="https://www.google.com/s2/favicons?domain=meta.ai&sz=48"
      alt="Meta AI"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  )
};

export default function Keywords({ currentUser, activeWorkspace, enabledEngines, onUpdateAddonPrompts }) {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [detailTab, setDetailTab] = useState('rankings');
  const [editPromptModes, setEditPromptModes] = useState({});
  const [customPromptInputs, setCustomPromptInputs] = useState({});
  const [recommending, setRecommending] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [totalUsedPrompts, setTotalUsedPrompts] = useState(0);
  const [scanningPrompts, setScanningPrompts] = useState({});
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [expandedEngines, setExpandedEngines] = useState({});
  const [selectedKeywordIds, setSelectedKeywordIds] = useState([]);
  const [limitAlert, setLimitAlert] = useState(null);
  const [crawlingStatus, setCrawlingStatus] = useState(null);

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

  const toggleExpandedEngine = (promptId, engineId) => {
    const key = `${promptId}_${engineId}`;
    setExpandedEngines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunPromptScan = async (promptId, promptText) => {
    setScanningPrompts(prev => ({ ...prev, [promptId]: true }));
    try {
      const response = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, company: activeWorkspace || 'Saleswizard.nl', promptId: promptId })
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

  // Smart background polling when prompts are being crawled / analyzed
  useEffect(() => {
    let interval = null;
    const hasPending = (keywords || []).some(k => k.is_crawling || (k.prompts || []).some(p => p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]));

    if (hasPending) {
      let pendingCount = 0;
      let totalCount = 0;
      keywords.forEach(k => {
        (k.prompts || []).forEach(p => {
          totalCount++;
          if (p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]) {
            pendingCount++;
          }
        });
      });

      setCrawlingStatus({
        active: true,
        pending: pendingCount,
        completed: Math.max(0, totalCount - pendingCount),
        total: totalCount,
        message: `${pendingCount || 'Zoek'} prompt(s) worden gecrawld over ChatGPT, Gemini en Perplexity...`
      });

      interval = setInterval(() => {
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
                is_crawling: !!k.is_crawling,
                brands: k.brands_mentioned ? String(k.brands_mentioned).split(',').map(b => b.trim()) : [],
                competitors: k.competitors || [],
                prompts: (k.prompts || []).map(p => ({
                  id: p.id,
                  text: p.prompt_text || p.text || '',
                  status: p.status || (p.results ? (p.brand_mentioned ? 'Cited' : 'Not Cited') : 'pending'),
                  engines: p.engines || ['chatgpt', 'gemini', 'perplexity'],
                  brandsCount: p.brandsCount || 0,
                  sourcesCount: p.sourcesCount || 0,
                  modelMentions: p.modelMentions || null,
                  responseSummary: p.responseSummary || '',
                  citations: p.citations || null
                }))
              }));
              setKeywords(formatted);
              setSelectedKeyword(prev => prev ? (formatted.find(f => f.id === prev.id) || prev) : null);
            }
          })
          .catch(err => console.error('Polling error:', err));
      }, 1500);
    } else if (crawlingStatus?.active) {
      setCrawlingStatus({
        active: false,
        done: true,
        message: 'Alle AI zoekmachine scans zijn succesvol voltooid!'
      });
      setTimeout(() => setCrawlingStatus(null), 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [keywords, scanningPrompts, activeWorkspace]);


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
            rank: k.rank_google || k.rank || '-',
            sov: k.share_of_voice || (k.competitors && k.competitors[0] ? k.competitors[0].sov : 0),
            position: k.average_position || (k.competitors && k.competitors[0] ? k.competitors[0].position : '-'),
            volume: k.search_volume || k.monthly_searches || '-',
            is_crawling: !!k.is_crawling,
            brands: k.brands_mentioned ? String(k.brands_mentioned).split(',').map(b => b.trim()) : [],
            competitors: k.competitors || [],
            prompts: (k.prompts || []).map(p => ({
              id: p.id,
              text: p.prompt_text || p.text || '',
              status: p.status || (p.results ? (p.brand_mentioned ? 'Cited' : 'Not Cited') : 'pending'),
              engines: p.engines || ['chatgpt', 'gemini', 'perplexity'],
              brandsCount: p.brandsCount || 0,
              sourcesCount: p.sourcesCount || 0,
              modelMentions: p.modelMentions || null,
              responseSummary: p.responseSummary || '',
              citations: p.citations || null
            }))
          }));
          setKeywords(formatted);

          let count = 0;
          formatted.forEach(f => {
            count += (f.prompts || []).length;
          });
          setTotalUsedPrompts(count);
        }
      })
      .catch(err => console.error('Fetch keywords error:', err))
      .finally(() => {
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
    const remainingPrompts = Math.max(0, activeLimit - totalUsedPrompts);

    if (totalUsedPrompts + promptsToGenerateCount > activeLimit) {
      setLimitAlert({
        type: 'error',
        title: 'Onvoldoende prompts limiet over',
        promptsToGenerate: promptsToGenerateCount,
        keywordsCount: rawKeywords.length,
        currentUsed: totalUsedPrompts,
        maxLimit: activeLimit,
        available: remainingPrompts
      });
      return;
    }

    setLimitAlert(null);
    const workspace = activeWorkspace || 'Saleswizard.nl';

    try {
      setIsAdding(false);
      setKeywordInput('');

      for (const kwText of rawKeywords) {
        const kwResponse = await fetch('/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: workspace, keyword: kwText, volume: 100 })
        });
        const kwData = await kwResponse.json();

        if (kwData.success) {
          const insertedKw = kwData.keyword;

          // Generate 3 natural AI prompts
          const genResponse = await fetch('/api/prompts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: workspace, keyword: kwText })
          });
          const genData = await genResponse.json();
          const prompts = genData.success && genData.prompts ? genData.prompts : [
            `Wat zijn de beste ${kwText} opties?`,
            `Welke ${kwText} partij raden jullie aan?`,
            `Top aanbevolen specialisten voor ${kwText}`
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
            }
          }

          const newKw = {
            id: insertedKw.id,
            text: kwText,
            rank: '-',
            sov: 0,
            position: '-',
            volume: 100,
            is_crawling: true,
            brands: [workspace.replace('.nl', '').toLowerCase()],
            competitors: [],
            prompts: savedPrompts.map(p => ({
              id: p.id,
              text: p.text,
              status: 'pending',
              engines: ['chatgpt', 'gemini', 'perplexity'],
              brandsCount: 0,
              sourcesCount: 0
            }))
          };

          setKeywords(prev => [newKw, ...prev]);
        }
      }

      setTotalUsedPrompts(prev => prev + promptsToGenerateCount);
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
        isSelf: Boolean(c.isSelf || c.isTarget || (c.domain && c.domain.toLowerCase().replace(/[^a-z0-9]/g, '').includes((activeWorkspace || '').toLowerCase().replace('.nl', '').replace(/[^a-z0-9]/g, '')))),
        sov: c.sov || Math.max(10, Math.floor(45 / (idx + 1))),
        position: c.position || (idx + 1),
        citations: typeof c.citations === 'number' ? c.citations : (typeof c.citationsCount === 'number' ? c.citationsCount : 0),
        citationUrls: (c.citationUrls && c.citationUrls.length > 0) ? c.citationUrls : (c.domain ? [`https://${c.domain}/`] : [])
      }));
    }

    return [];
  };

  const handleAddCustomPrompt = async (kwId) => {
    const input = getCustomPromptInput(kwId);
    if (!input.trim()) return;

    const remainingPrompts = Math.max(0, activeLimit - totalUsedPrompts);
    if (totalUsedPrompts + 1 > activeLimit) {
      setLimitAlert({
        type: 'error',
        title: 'Onvoldoende prompts limiet over',
        promptsToGenerate: 1,
        keywordsCount: 1,
        currentUsed: totalUsedPrompts,
        maxLimit: activeLimit,
        available: remainingPrompts
      });
      return;
    }
    setLimitAlert(null);

    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: workspace, text: input, tag: 'Custom', keyword_id: kwId })
      });
      const data = await response.json();

      if (data.success) {
        const newPromptObj = {
          id: data.prompt.id,
          text: data.prompt.prompt_text || input,
          status: 'pending',
          engines: ['chatgpt', 'gemini', 'perplexity'],
          brandsCount: 0,
          sourcesCount: 0
        };

        setKeywords(prev => prev.map(k => {
          if (k.id === kwId) {
            return {
              ...k,
              is_crawling: true,
              prompts: [
                ...(k.prompts || []),
                newPromptObj
              ]
            };
          }
          return k;
        }));

        if (selectedKeyword && selectedKeyword.id === kwId) {
          setSelectedKeyword(prev => ({
            ...prev,
            is_crawling: true,
            prompts: [
              ...(prev.prompts || []),
              newPromptObj
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

  const handleDeletePrompt = async (kwId, promptId) => {
    if (!window.confirm('Weet u zeker dat u deze prompt wilt verwijderen?')) return;

    try {
      const res = await fetch(`/api/prompts/${promptId}`, { method: 'DELETE' });
      if (res.ok) {
        setKeywords(prev => prev.map(k => {
          if (k.id === kwId) {
            return {
              ...k,
              prompts: (k.prompts || []).filter(p => p.id !== promptId)
            };
          }
          return k;
        }));

        if (selectedKeyword && selectedKeyword.id === kwId) {
          setSelectedKeyword(prev => ({
            ...prev,
            prompts: (prev.prompts || []).filter(p => p.id !== promptId)
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


  const renderPromptLimitAlert = () => {
    if (!limitAlert) return null;

    return (
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            borderRadius: '10px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
              {limitAlert.title || 'Onvoldoende prompts limiet over'}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5' }}>
              U probeert <strong>{limitAlert.promptsToGenerate} {limitAlert.promptsToGenerate === 1 ? 'prompt' : 'prompts'}</strong> te genereren{limitAlert.keywordsCount > 0 ? ` voor ${limitAlert.keywordsCount} keyword(s)` : ''}.
              U gebruikt momenteel al <strong>{limitAlert.currentUsed}</strong> van uw maximaal <strong>{limitAlert.maxLimit}</strong> prompts (nog <strong>{limitAlert.available}</strong> beschikbaar).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '12px',
                padding: '3px 10px',
                backgroundColor: '#ffffff',
                color: '#991b1b',
                borderRadius: '6px',
                fontWeight: 700,
                border: '1px solid #fecaca'
              }}>
                Huidig verbruik: {limitAlert.currentUsed} / {limitAlert.maxLimit} prompts
              </span>
              <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 500 }}>
                Verhoog uw prompts limiet of abonnement om verder te gaan.
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLimitAlert(null)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#991b1b',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          title="Melding sluiten"
        >
          <X size={18} />
        </button>
      </div>
    );
  };

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
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        flex: 1
      }}>
        {renderPromptLimitAlert()}

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
          {(() => {
            const kwCrawlingCount = (kw.prompts || []).filter(p => !!scanningPrompts[p.id] || p.status === 'processing' || p.status === 'pending' || p.status === 'crawling').length;
            return [
              { id: 'rankings', label: 'Rankings' },
              { id: 'prompts', label: kwCrawlingCount > 0 ? `Prompts (${(kw.prompts || []).length}) ⏳ (${kwCrawlingCount} bezig...)` : `Prompts (${(kw.prompts || []).length})` },
              { id: 'sources', label: 'Sources' },
              { id: 'shopping', label: 'Shopping' },
              { id: 'settings', label: 'Settings' }
            ];
          })().map(t => (
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
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'chatgpt', domain: 'openai.com', name: 'ChatGPT' },
                    { id: 'gemini', domain: 'gemini.google.com', name: 'Gemini' },
                    { id: 'perplexity', domain: 'perplexity.ai', name: 'Perplexity' },
                    { id: 'copilot', domain: 'copilot.microsoft.com', name: 'Copilot' }
                  ].filter(e => !enabledEngines || enabledEngines[e.id] !== false).map((e, idx) => (
                    <img
                      key={idx}
                      src={`https://www.google.com/s2/favicons?domain=${e.domain}&sz=48`}
                      alt={e.name}
                      title={e.name}
                      style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain' }}
                    />
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

            {/* Competitor Table or Crawling Placeholder */}
            {(() => {
              const isKwScanning = kw.is_crawling || (kw.prompts || []).some(p => p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]);
              const brandRankings = getBrandRankings(kw);

              if (isKwScanning || brandRankings.length === 0) {
                return (
                  <div style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #bfdbfe'
                    }}>
                      <Loader2 size={26} className="spin" style={{ color: '#2563eb' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                        {isKwScanning ? 'AI Zoekmachines worden live gecrawld...' : 'Wachten op analyse van zoekvragen...'}
                      </h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px', maxWidth: '440px', lineHeight: 1.5 }}>
                        De merkrangschikking, gemiddelde posities en Share of Voice worden berekend en zichtbaar zodra de AI-zoekvragen zijn voltooid.
                      </p>
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569'
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }}></span>
                      Live multi-engine evaluatie (ChatGPT, Gemini, Perplexity)
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ overflow: 'visible', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff' }}>
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
                      {brandRankings.map((r, rIdx) => {
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
                            <td style={{ padding: '14px 16px', position: 'relative' }}>
                              {r.citationUrls && r.citationUrls.length > 0 ? (
                                <div className="tooltip-container" style={{ display: 'inline-block' }}>
                                  <span style={{
                                    fontSize: '11px',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    border: '1px solid rgba(180, 83, 9, 0.15)'
                                  }}>
                                    {r.citations} {r.citations === 1 ? 'URL' : 'URLs'}
                                  </span>
                                  <div className="tooltip-content" style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    marginBottom: '8px',
                                    backgroundColor: '#1e1b4b',
                                    color: '#ffffff',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.05)',
                                    zIndex: 100,
                                    width: 'max-content',
                                    maxWidth: '320px',
                                    pointerEvents: 'none',
                                    opacity: 0,
                                    visibility: 'hidden',
                                    transition: 'all 0.15s ease',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}>
                                    <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '2px', color: '#fbbf24' }}>Geciteerde Bronnen:</div>
                                    {r.citationUrls.map((url, uIdx) => (
                                      <a 
                                        key={uIdx} 
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        style={{ color: '#60a5fa', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {url}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  backgroundColor: '#f3f4f6',
                                  color: '#6b7280',
                                  fontWeight: 700
                                }}>
                                  0 URLs
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
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
              {(() => {
                const kwCrawlingCount = (kw.prompts || []).filter(p => !!scanningPrompts[p.id] || p.status === 'processing' || p.status === 'pending' || p.status === 'crawling').length;
                return kwCrawlingCount > 0 ? (
                  <div style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Loader2 size={18} className="spin" style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                        AI Zoekmachines doorzoeken... ({kwCrawlingCount} prompt{kwCrawlingCount === 1 ? '' : 's'} actief aan het crawlen)
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                      Live Scannen
                    </span>
                  </div>
                ) : null;
              })()}

              {(kw.prompts || []).map((p, pIdx) => {
                const promptKey = p.id || pIdx;
                const isOpen = !!expandedPrompts[promptKey];
                const isCrawling = !!scanningPrompts[p.id] || p.status === 'processing' || p.status === 'pending' || p.status === 'crawling';
                const isMentioned = p.status === 'Cited' || p.mentioned;
                const brandsCount = p.brandsCount || (isMentioned ? (p.citations ? p.citations.length + 3 : 5) : 0);
                const sourcesCount = p.sourcesCount || (p.citations ? p.citations.length : 0);
                const mData = p.modelMentions || {};

                const enginesList = [
                  { id: 'chatgpt', name: 'OpenAI ChatGPT', mentioned: mData.chatgpt?.mentioned ?? isMentioned, brands: mData.chatgpt?.brands || (isMentioned ? 4 : 0), sources: mData.chatgpt?.sources || 1, summary: mData.chatgpt?.summary },
                  { id: 'aioverviews', name: 'Google AI Overviews', mentioned: mData.aioverviews?.mentioned ?? true, brands: mData.aioverviews?.brands || (sourcesCount > 0 ? 3 : 0), sources: mData.aioverviews?.sources || sourcesCount, summary: mData.aioverviews?.summary },
                  { id: 'aimode', name: 'Google AI Mode', mentioned: mData.aimode?.mentioned ?? false, brands: mData.aimode?.brands || 0, sources: mData.aimode?.sources || 0, summary: mData.aimode?.summary },
                  { id: 'gemini', name: 'Google Gemini', mentioned: mData.gemini?.mentioned ?? isMentioned, brands: mData.gemini?.brands || (isMentioned ? 3 : 0), sources: mData.gemini?.sources || 0, summary: mData.gemini?.summary },
                  { id: 'perplexity', name: 'Perplexity AI', mentioned: mData.perplexity?.mentioned ?? isMentioned, brands: mData.perplexity?.brands || (isMentioned ? 4 : 0), sources: mData.perplexity?.sources || Math.min(sourcesCount, 3), summary: mData.perplexity?.summary },
                  { id: 'claude', name: 'Anthropic Claude', mentioned: mData.claude?.mentioned ?? false, brands: mData.claude?.brands || 0, sources: mData.claude?.sources || 0, summary: mData.claude?.summary },
                  { id: 'copilot', name: 'Microsoft Copilot', mentioned: mData.copilot?.mentioned ?? isMentioned, brands: mData.copilot?.brands || (isMentioned ? 3 : 0), sources: mData.copilot?.sources || 1, summary: mData.copilot?.summary },
                  { id: 'meta', name: 'Meta AI', mentioned: mData.meta?.mentioned ?? false, brands: mData.meta?.brands || 0, sources: mData.meta?.sources || 0, summary: mData.meta?.summary }
                ].filter(e => {
                  if (enabledEngines && enabledEngines[e.id] === false) return false;
                  if (p.modelMentions && !(e.id in p.modelMentions) && (!enabledEngines || !enabledEngines[e.id])) return false;
                  return true;
                });

                return (
                  <div
                    key={pIdx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: isCrawling ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: isCrawling ? '0 2px 8px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* LLMRefs Prompt Card Header */}
                    <div
                      style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isCrawling ? '#f0f7ff' : '#f9fafb',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => toggleExpandedPrompt(promptKey)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, paddingRight: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                          {p.text}
                        </span>
                        {isCrawling && (
                          <span style={{
                            fontSize: '11px',
                            padding: '3px 10px',
                            borderRadius: '16px',
                            backgroundColor: '#dbeafe',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: '1px solid #bfdbfe'
                          }}>
                            <Loader2 size={11} className="spin" /> AI Crawl & Grounding actief
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {isCrawling ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            padding: '3px 12px',
                            borderRadius: '16px',
                            border: '1px solid #bfdbfe'
                          }}>
                            Wachten op AI modellen...
                          </span>
                        ) : (
                          <>
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
                          </>
                        )}

                        {isEditMode ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeletePrompt(kw.id, p.id); }}
                            title="Verwijder prompt"
                            style={{ padding: '6px', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isCrawling}
                            onClick={(e) => { e.stopPropagation(); handleRunPromptScan(p.id, p.text); }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              backgroundColor: isCrawling ? '#93c5fd' : '#000000',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: isCrawling ? 'not-allowed' : 'pointer',
                              border: 'none',
                              opacity: isCrawling ? 0.8 : 1,
                              marginLeft: '4px'
                            }}
                          >
                            {isCrawling ? <Loader2 size={12} className="spin" /> : <Play size={10} />}
                            {isCrawling ? 'Crawling...' : 'Crawl'}
                          </button>
                        )}

                        <div style={{ color: '#9ca3af', marginLeft: '2px', display: 'flex', alignItems: 'center' }}>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* LLMRefs Engine Breakdown Rows or Crawling state */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff', padding: '4px 0' }}>
                        {isCrawling && !p.modelMentions ? (
                          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: '#f8fafc' }}>
                            <Loader2 size={24} className="spin" style={{ color: '#2563eb' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                              Prompt wordt momenteel live uitgevoerd in AI zoekmachines...
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', maxWidth: '480px' }}>
                              OpenAI SearchGPT, Google AI Mode, Gemini en Perplexity analyseren het web op zoek naar actuele citaties, reviews en merkvermeldingen. Resultaten verschijnen automatisch zodra de scan gereed is.
                            </span>
                          </div>
                        ) : (
                          enginesList.map((eng, engIdx) => {
                            const engKey = `${promptKey}_${eng.id}`;
                            const isEngExpanded = !!expandedEngines[engKey];
                            return (
                              <div
                                key={engIdx}
                                style={{
                                  borderBottom: engIdx < enginesList.length - 1 ? '1px solid #f3f4f6' : 'none'
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 20px',
                                    cursor: eng.summary ? 'pointer' : 'default',
                                    userSelect: 'none',
                                    backgroundColor: isEngExpanded ? '#f9fafb' : 'transparent'
                                  }}
                                  onClick={() => eng.summary && toggleExpandedEngine(promptKey, eng.id)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {EngineLogos[eng.id]}
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                      {eng.name}
                                    </span>
                                    {eng.summary && (
                                      <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
                                        {isEngExpanded ? '(klik om antwoord te verbergen)' : '(klik om antwoord te tonen)'}
                                      </span>
                                    )}
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
                                      • {eng.brands} Brands
                                    </span>
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: '#ea580c',
                                      backgroundColor: '#fff7ed',
                                      padding: '2px 8px',
                                      borderRadius: '12px'
                                    }}>
                                      • {eng.sources} Sources
                                    </span>
                                  </div>
                                </div>

                                {isEngExpanded && eng.summary && (
                                  <div style={{
                                    padding: '12px 20px 16px 52px',
                                    backgroundColor: '#f8fafc',
                                    fontSize: '13px',
                                    lineHeight: '1.6',
                                    color: '#334155',
                                    borderTop: '1px solid #f1f5f9'
                                  }}>
                                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                      {eng.summary}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
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
      minHeight: '100%',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      flex: 1
    }}>

      {renderPromptLimitAlert()}

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
            {(() => {
              const enteredKws = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
              const countPrompts = enteredKws.length * 3;
              const remaining = Math.max(0, activeLimit - totalUsedPrompts);
              const willExceed = (totalUsedPrompts + countPrompts) > activeLimit;

              if (enteredKws.length > 0) {
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: willExceed ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${willExceed ? '#fecaca' : '#bbf7d0'}`,
                    fontSize: '12px',
                    color: willExceed ? '#991b1b' : '#166534',
                    fontWeight: 600
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {willExceed ? <AlertTriangle size={14} color="#dc2626" /> : <Sparkles size={14} color="#16a34a" />}
                      <span>
                        {enteredKws.length} keyword(s) = <strong>{countPrompts} prompts</strong> te genereren (3 per keyword)
                      </span>
                    </div>
                    <span>
                      {willExceed ? (
                        <span style={{ color: '#dc2626' }}>
                          Limiet overschreden! (max: {activeLimit}, gebruikt: {totalUsedPrompts})
                        </span>
                      ) : (
                        <span>
                          Nog <strong>{remaining - countPrompts}</strong> over na toevoegen (max: {activeLimit})
                        </span>
                      )}
                    </span>
                  </div>
                );
              }

              if (isLimitReached) {
                return (
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>
                    Prompts limiet bereikt ({totalUsedPrompts}/{activeLimit}). Verhoog eerst uw limiet om keywords toe te voegen.
                  </span>
                );
              }

              return (
                <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                  Onze AI Prompts Generator maakt automatisch 3 zoekvragen per keyword om AI zoekmachines te scannen (verbruikt 3 prompts per keyword).
                </p>
              );
            })()}
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

      {/* Active Crawl Status Banner */}
      {(() => {
        let totalActive = 0;
        (keywords || []).forEach(k => {
          (k.prompts || []).forEach(p => {
            if (p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]) {
              totalActive++;
            }
          });
        });

        if (totalActive > 0) {
          return (
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  flexShrink: 0
                }}>
                  <Loader2 size={18} className="spin" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                    AI Zoekmachines doorzoeken... ({totalActive} prompt{totalActive === 1 ? '' : 's'} actief aan het crawlen)
                  </div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                    ChatGPT (SearchGPT), Google AI Mode, Gemini en Perplexity analyseren het live web. Resultaten en Share of Voice worden automatisch bijgewerkt.
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#ffffff', padding: '4px 12px', borderRadius: '12px', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
                Live Scannen
              </span>
            </div>
          );
        }
        return null;
      })()}

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
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="Het zoekwoord waarop de AI-zoekmachines worden gescand">Keyword</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="De organische positie in de traditionele Google.nl zoekresultaten">Rank</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="Percentage van de prompts waarin dit merk door AI-modellen wordt genoemd">Share of Voice</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="De gemiddelde positie/volgorde waarin het merk wordt genoemd in de AI-antwoorden">Position</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="Schatting van het aantal maandelijkse zoekopdrachten in Google Nederland">Search Volume</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="De meest genoemde merken in de AI-zoekresultaten voor dit zoekwoord">Top Brands</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', textAlign: 'center', width: '90px', cursor: 'help' }} title="Acties zoals analyseren, archiveren of verwijderen">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredKeywords.map((kw) => {
              const isKwScanning = kw.is_crawling || (kw.prompts || []).some(p => p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]);

              return (
                <tr
                  key={kw.id}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: isKwScanning ? '#f8faff' : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => {
                    setSelectedKeyword(kw);
                    setDetailTab('rankings');
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isKwScanning ? '#f0f7ff' : '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isKwScanning ? '#f8faff' : 'transparent'}
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
                      {isKwScanning && (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid #bfdbfe'
                        }}>
                          <Loader2 size={10} className="spin" /> AI Crawl
                        </span>
                      )}
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 700 }}>
                        🇳🇱 NL
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '16px', fontWeight: 700, color: kw.rank !== '-' ? '#111827' : '#9ca3af' }}>
                    {isKwScanning ? (
                      <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        <Loader2 size={12} className="spin" /> Scannen...
                      </span>
                    ) : (
                      kw.rank
                    )}
                  </td>

                  <td style={{ padding: '16px' }}>
                    {isKwScanning ? (
                      <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        <Loader2 size={12} className="spin" /> Analyseren...
                      </span>
                    ) : (
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
                    )}
                  </td>

                  <td style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>
                    {isKwScanning ? (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    ) : (
                      kw.position
                    )}
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
            );
          })}
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
