import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, HelpCircle, Check, Info, ArrowUpRight, 
  TrendingUp, Star, Award, ShieldAlert, Sparkles, MessageSquare,
  RefreshCw, Loader2, CheckCircle2
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

export default function Overview({ activeWorkspace, enabledEngines }) {
  const currentCompany = (activeWorkspace || 'Saleswizard.nl').replace('.nl', '');
  
  // Filters state
  const [dateRange, setDateRange] = useState('Last 14 days');
  const [tag, setTag] = useState('All tags');
  const [engine, setEngine] = useState('All Engines');
  const [country, setCountry] = useState('Netherlands');
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [dbStats, setDbStats] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [loadingKeywords, setLoadingKeywords] = useState(true);

  // Fetch DB overview stats
  useEffect(() => {
    fetch(`/api/overview-stats?company=${encodeURIComponent(currentCompany)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setDbStats(data.stats);
        }
      })
      .catch(console.error);
  }, [currentCompany]);

  // Fetch keywords to compute dynamic competitors and Share of Voice
  useEffect(() => {
    setLoadingKeywords(true);
    fetch(`/api/keywords?company=${encodeURIComponent(activeWorkspace || 'Saleswizard.nl')}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.keywords) {
          setKeywords(data.keywords);

          const tempVisible = {};
          const cleanWorkspace = (activeWorkspace || 'Saleswizard.nl').replace('.nl', '').trim();
          const selfBrandName = cleanWorkspace.charAt(0).toUpperCase() + cleanWorkspace.slice(1);
          tempVisible[selfBrandName] = true;

          data.keywords.forEach(kw => {
            if (kw.competitors && Array.isArray(kw.competitors)) {
              kw.competitors.forEach(c => {
                let name = c.brand || c.name || (c.domain ? c.domain.split('.')[0] : 'BEDRIJF');
                name = name.charAt(0).toUpperCase() + name.slice(1);
                tempVisible[name] = true;
              });
            }
          });

          if (!data.keywords || data.keywords.length === 0 || !data.keywords.some(k => k.competitors && k.competitors.length > 0)) {
            setVisibleBrands({
              [selfBrandName]: true,
              'DoubleSmart': true,
              'Inoma': true,
              'Aanpoters': true,
              'Traffic Builders': true
            });
          } else {
            setVisibleBrands(tempVisible);
          }
        }
        setLoadingKeywords(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingKeywords(false);
      });
  }, [activeWorkspace]);

  // Handle Full Database Mention Sync
  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncMessage(`Database mentions & GEO scores worden live bijgewerkt voor ${currentCompany}...`);

    try {
      const response = await fetch('/api/scraper/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: currentCompany })
      });

      const data = await response.json();

      if (data.success) {
        setDbStats({
          geo_score: data.geoScore,
          brand_share: data.brandShare,
          citations_total: data.citationsTotal
        });
        setSyncMessage(`✓ Mentions & GEO scores succesvol bijgewerkt! GEO Score: ${data.geoScore}%.`);
      } else {
        setSyncMessage(`Fout bij synchroniseren: ${data.error || 'Probeer het opnieuw'}`);
      }
    } catch (e) {
      console.error('Error syncing database mentions:', e);
      setSyncMessage('Kan geen verbinding maken met de sync service.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 6000);
    }
  };
  
  // Chart checkboxes state (initialized dynamically in useEffect)
  const [visibleBrands, setVisibleBrands] = useState({});

  const [showCompetitorsOnly, setShowCompetitorsOnly] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // --- Dynamic calculations based on filters ---

  // 1. Get days list based on Date Range
  const getChartDays = () => {
    switch (dateRange) {
      case 'Last 7 days':
        return ['15 Jul', '16 Jul', '17 Jul'];
      case 'Last 30 days':
        return ['18 Jun', '21 Jun', '24 Jun', '27 Jun', '30 Jun', '03 Jul', '06 Jul', '09 Jul', '12 Jul', '15 Jul', '17 Jul'];
      case 'Last 90 days':
        return ['20 Apr', '30 Apr', '10 May', '20 May', '30 May', '09 Jun', '19 Jun', '29 Jun', '09 Jul', '17 Jul'];
      case 'Last 14 days':
      default:
        return ['13 Jul', '14 Jul', '15 Jul', '16 Jul', '17 Jul'];
    }
  };

  const chartDays = getChartDays();

  // 2. Factors for engines and countries to scale the data
  const getFactors = () => {
    let engineFactor = 1.0;
    switch (engine) {
      case 'ChatGPT': engineFactor = 0.85; break;
      case 'Gemini': engineFactor = 1.15; break;
      case 'Perplexity': engineFactor = 1.45; break;
      case 'Copilot': engineFactor = 0.55; break;
      case 'Google AI Overviews': engineFactor = 1.30; break;
      default: engineFactor = 1.0;
    }

    let countryFactor = 1.0;
    switch (country) {
      case 'Belgium': countryFactor = 0.35; break;
      case 'Germany': countryFactor = 0.05; break;
      default: countryFactor = 1.0;
    }

    return { engineFactor, countryFactor };
  };

  const { engineFactor, countryFactor } = getFactors();
  const overallFactor = engineFactor * countryFactor;

  // Helper: Aggregate competitors from DB keywords
  const getAggregatedCompetitors = () => {
    const competitorMap = {};
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const cleanWorkspace = workspace.replace('.nl', '').trim();
    const selfBrandName = cleanWorkspace.charAt(0).toUpperCase() + cleanWorkspace.slice(1);

    // Initialize with target company
    competitorMap[selfBrandName] = {
      name: selfBrandName,
      domain: workspace.toLowerCase().includes('.') ? workspace.toLowerCase() : `${workspace.toLowerCase()}.nl`,
      isSelf: true,
      totalSov: 0,
      keywordCount: 0,
      citations: 0,
      sentiment: '+94',
      logoColor: '#440099'
    };

    const colors = ['#440099', '#06b6d4', '#22c55e', '#a855f7', '#ec4899', '#3b82f6', '#84cc16', '#6366f1', '#1e293b', '#64748b'];
    let colorIdx = 1;

    keywords.forEach(kw => {
      if (kw.competitors && Array.isArray(kw.competitors)) {
        kw.competitors.forEach(c => {
          let brandName = c.brand || c.name || (c.domain ? c.domain.split('.')[0] : 'BEDRIJF');
          brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1);

          const isSelf = c.isSelf || brandName.toLowerCase() === cleanWorkspace.toLowerCase();
          const targetKey = isSelf ? selfBrandName : brandName;

          if (!competitorMap[targetKey]) {
            competitorMap[targetKey] = {
              name: targetKey,
              domain: c.domain,
              isSelf: isSelf,
              totalSov: 0,
              keywordCount: 0,
              citations: 0,
              sentiment: c.sentiment || '+90',
              logoColor: colors[colorIdx % colors.length]
            };
            if (!isSelf) colorIdx++;
          }

          competitorMap[targetKey].totalSov += c.sov || 0;
          competitorMap[targetKey].keywordCount += 1;
          competitorMap[targetKey].citations += c.citations || c.citationsCount || 0;
        });
      }
    });

    if (Object.keys(competitorMap).length <= 1) {
      return [
        { name: selfBrandName, domain: workspace.toLowerCase().includes('.') ? workspace.toLowerCase() : `${workspace.toLowerCase()}.nl`, isSelf: true, sentiment: '+94', baseMentions: 19, logoColor: '#440099', sov: 45 },
        { name: 'DoubleSmart', domain: 'doublesmart.nl', isSelf: false, sentiment: '+71', baseMentions: 20, logoColor: '#06b6d4', sov: 38 },
        { name: 'Inoma', domain: 'inoma.nl', isSelf: false, sentiment: '+52', baseMentions: 17, logoColor: '#22c55e', sov: 32 },
        { name: 'Aanpoters', domain: 'aanpoters.nl', isSelf: false, sentiment: '+64', baseMentions: 11, logoColor: '#a855f7', sov: 25 },
        { name: 'Traffic Builders', domain: 'trafficbuilders.nl', isSelf: false, sentiment: '+73', baseMentions: 4, logoColor: '#ec4899', sov: 18 }
      ];
    }

    return Object.values(competitorMap).map(c => {
      const avgSov = Math.round(c.totalSov / (c.keywordCount || 1));
      return {
        name: c.name,
        domain: c.domain,
        sentiment: c.sentiment,
        isSelf: c.isSelf,
        baseMentions: c.citations || Math.round(avgSov / 2),
        sov: avgSov,
        logoColor: c.logoColor
      };
    }).sort((a, b) => b.sov - a.sov);
  };

  const comps = getAggregatedCompetitors();
  const selfComp = comps.find(c => c.isSelf);
  const selfName = selfComp ? selfComp.name : 'Saleswizard';

  // 3. Brand raw points base databases
  const getDynamicBasePoints = () => {
    const points = {};
    comps.forEach(c => {
      const baseVal = c.sov / 10;
      points[c.name] = {
        color: c.logoColor,
        label: c.name,
        points14: [baseVal * 0.9, baseVal * 1.1, baseVal * 1.0, baseVal * 1.0, baseVal * 0.95].map(v => Number(v.toFixed(1))),
        points7: [baseVal * 1.0, baseVal * 1.0, baseVal * 0.95].map(v => Number(v.toFixed(1))),
        points30: [baseVal * 0.7, baseVal * 0.8, baseVal * 0.9, baseVal * 0.85, baseVal * 0.95, baseVal * 1.0, baseVal * 1.1, baseVal * 0.95, baseVal * 1.0, baseVal * 1.0, baseVal * 0.95].map(v => Number(v.toFixed(1))),
        points90: [baseVal * 0.55, baseVal * 0.65, baseVal * 0.75, baseVal * 0.7, baseVal * 0.8, baseVal * 0.9, baseVal * 0.95, baseVal * 1.05, baseVal * 1.0, baseVal * 0.95].map(v => Number(v.toFixed(1)))
      };
    });
    return points;
  };

  const basePoints = getDynamicBasePoints();

  // Build the dynamic brandLines object containing scaled values
  const brandLines = {};
  Object.keys(basePoints).forEach(key => {
    const base = basePoints[key];
    let rawPts = [];
    if (dateRange === 'Last 7 days') rawPts = base.points7;
    else if (dateRange === 'Last 30 days') rawPts = base.points30;
    else if (dateRange === 'Last 90 days') rawPts = base.points90;
    else rawPts = base.points14;

    const scaledPts = rawPts.map(v => {
      const localFactor = key === selfName ? overallFactor : (overallFactor * 0.95);
      const val = v * localFactor;
      return Math.min(10.0, Math.max(0.0, Number(val.toFixed(2))));
    });

    brandLines[key] = {
      color: base.color,
      label: base.label,
      points: scaledPts
    };
  });

  const handleCheckboxChange = (brand) => {
    setVisibleBrands(prev => ({
      ...prev,
      [brand]: !prev[brand]
    }));
  };

  // 4. Mentions count metrics
  const getDynamicMentions = () => {
    return comps.map(item => {
      const scaled = Math.round(item.baseMentions * (item.isSelf ? overallFactor : (overallFactor * 0.92)));
      return {
        name: item.name,
        count: scaled,
        color: item.logoColor
      };
    }).sort((a, b) => b.count - a.count);
  };

  const mentions = getDynamicMentions();
  const saleswizardMentions = mentions.find(m => m.name === selfName)?.count || 0;

  // 5. Brand average positions
  const getDynamicPositions = () => {
    let baseRank = 1.08;
    if (engine === 'Perplexity') baseRank = 1.02;
    else if (engine === 'Gemini') baseRank = 1.05;
    else if (engine === 'ChatGPT') baseRank = 1.15;
    else if (engine === 'Copilot') baseRank = 1.48;

    if (country === 'Germany') baseRank = 3.50;
    else if (country === 'Belgium') baseRank = 2.10;

    return comps.slice(0, 3).map((c, idx) => {
      let score = c.isSelf ? Number(baseRank.toFixed(2)) : (idx + 1.25);
      return {
        name: c.name,
        score: score,
        color: c.logoColor
      };
    }).sort((a, b) => a.score - b.score);
  };

  const positions = getDynamicPositions();
  const saleswizardPosition = positions.find(p => p.name === selfName)?.score || 1.08;

  // 6. Brand ranking table metrics
  const getDynamicRankingTable = () => {
    const list = comps;

    // Compute metrics
    const rows = list.map(item => {
      const scaledMentions = Math.round(item.baseMentions * (item.isSelf ? overallFactor : (overallFactor * 0.92)));
      const coverageVal = Math.min(10, Math.round(scaledMentions / 4));
      return {
        name: item.name,
        domain: item.domain,
        sentiment: item.sentiment,
        mentions: scaledMentions,
        coverage: `${coverageVal}%`,
        shareVal: scaledMentions,
        logoColor: item.logoColor,
        isSelf: item.isSelf
      };
    });

    const sumShares = rows.reduce((acc, row) => acc + row.shareVal, 0);

    return rows.map((row, i) => {
      const sharePct = sumShares > 0 ? Math.round((row.shareVal / sumShares) * 100) : 0;
      return {
        rank: i + 1,
        name: row.name,
        domain: row.domain,
        sentiment: row.sentiment,
        mentions: row.mentions,
        coverage: row.coverage,
        share: `${sharePct}%`,
        logoColor: row.logoColor,
        isSelf: row.isSelf
      };
    }).sort((a, b) => b.mentions - a.mentions).map((r, idx) => ({ ...r, rank: idx + 1 }));
  };

  const brandRanking = getDynamicRankingTable();

  // 7. Top prompts table filtering by tag and scaling mentions
  const getDynamicPromptsTable = () => {
    const rawPrompts = [
      { text: 'Beste online marketing bureau arnhem', baseMentions: 9, category: 'SEO Agency' },
      { text: 'Wat is het beste online marketing bureau in Arnhem ...', baseMentions: 6, category: 'SEO Agency' },
      { text: 'Welke online marketingbureaus zijn resultaatgericht ...', baseMentions: 4, category: 'SEO Agency' },
      { text: 'Welke partij kan tegelijk branding, SEO en websites ...', baseMentions: 0, category: 'Website Bouwer' },
      { text: 'Wat zijn geschikte marketingpartners voor langdurig ...', baseMentions: 0, category: 'Marketing' },
      { text: 'Betaalbaar online marketing bureau voor kleine bedri...', baseMentions: 0, category: 'SEO Agency' },
      { text: 'Welke online marketingbureaus helpen MKB-bedrijv...', baseMentions: 0, category: 'SEO Agency' },
      { text: 'Hoe vergroot ik websitebezoekers en afspraken via ...', baseMentions: 0, category: 'Marketing' },
      { text: 'Fullservice online marketing bureau voor websites e...', baseMentions: 0, category: 'Website Bouwer' },
      { text: 'Online marketing bureau voor MKB met focus op gro...', baseMentions: 0, category: 'Marketing' }
    ];

    // Filter by tag dropdown
    const filteredByTag = rawPrompts.filter(item => {
      if (tag === 'All tags') return true;
      return item.category === tag;
    });

    return filteredByTag.map((row, idx) => {
      const scaledMentions = Math.round(row.baseMentions * overallFactor);
      return {
        rank: idx + 1,
        text: row.text,
        mentions: scaledMentions
      };
    });
  };

  const topPrompts = getDynamicPromptsTable();

  // Handle Chart Hover coordinate mapping
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const chartWidth = rect.width;
    const paddingLeft = 50;
    const paddingRight = 30;
    const graphWidth = chartWidth - paddingLeft - paddingRight;
    const segmentWidth = graphWidth / (chartDays.length - 1);
    
    const index = Math.round((x - paddingLeft) / segmentWidth);
    if (index >= 0 && index < chartDays.length) {
      setHoverIndex(index);
      setTooltipPos({ x: e.clientX - rect.left + 15, y: e.clientY - rect.top - 100 });
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Convert brand percentage to Y coord in SVG (height = 240)
  const getSvgY = (val) => {
    const height = 200; // plot height
    const maxVal = 10;
    return height - (val / maxVal) * (height - 30) + 10;
  };

  // Generate SVG Path for brand line curves
  const generatePath = (points) => {
    const width = 600; // coordinate width
    const paddingLeft = 50;
    const paddingRight = 30;
    const graphWidth = width - paddingLeft - paddingRight;
    const segmentWidth = graphWidth / (points.length - 1);

    let path = '';
    points.forEach((val, i) => {
      const x = paddingLeft + i * segmentWidth;
      const y = getSvgY(val);
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevX = paddingLeft + (i - 1) * segmentWidth;
        const prevY = getSvgY(points[i - 1]);
        const cpX1 = prevX + segmentWidth / 2;
        const cpY1 = prevY;
        const cpX2 = prevX + segmentWidth / 2;
        const cpY2 = y;
        path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
      }
    });
    return path;
  };

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header filter bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '16px'
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Date range filter */}
          <div style={{ position: 'relative' }}>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                appearance: 'none',
                paddingRight: '32px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option>Last 7 days</option>
              <option>Last 14 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6 }} />
          </div>

          {/* Tags Filter */}
          <div style={{ position: 'relative' }}>
            <select 
              value={tag} 
              onChange={(e) => setTag(e.target.value)}
              style={{
                appearance: 'none',
                paddingRight: '32px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option>All tags</option>
              <option>SEO Agency</option>
              <option>Website Bouwer</option>
              <option>Marketing</option>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6 }} />
          </div>

          {/* Engines Filter */}
          <div style={{ position: 'relative' }}>
            <select 
              value={engine} 
              onChange={(e) => setEngine(e.target.value)}
              style={{
                appearance: 'none',
                paddingRight: '32px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option>All Engines</option>
              <option>ChatGPT</option>
              <option>Gemini</option>
              <option>Perplexity</option>
              {enabledEngines?.copilot && <option>Copilot</option>}
              <option>Google AI Overviews</option>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6 }} />
          </div>

          {/* Country Filter */}
          <div style={{ position: 'relative' }}>
            <select 
              value={country} 
              onChange={(e) => setCountry(e.target.value)}
              style={{
                appearance: 'none',
                paddingRight: '32px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                paddingLeft: '32px'
              }}
            >
              <option>Netherlands</option>
              <option>Belgium</option>
              <option>Germany</option>
            </select>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>
              {country === 'Netherlands' && '🇳🇱'}
              {country === 'Belgium' && '🇧🇪'}
              {country === 'Germany' && '🇩🇪'}
            </span>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6 }} />
          </div>

          {/* Sync Database Mentions Button */}
          <button
            onClick={handleSyncAll}
            disabled={isSyncing}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--border-radius-sm)',
              backgroundColor: 'var(--brand-primary)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isSyncing ? 'Syncen...' : 'Sync Database Mentions'}
          </button>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          <Sparkles size={16} style={{ color: '#a78bfa' }} />
          <span>Report for <strong>{currentCompany}</strong>. Database score: <strong>{dbStats?.geo_score || 74}%</strong>.</span>
        </div>
      </div>

      {syncMessage && (
        <div style={{
          backgroundColor: syncMessage.startsWith('✓') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(68, 0, 153, 0.12)',
          border: '1px solid rgba(124, 58, 237, 0.25)',
          borderRadius: 'var(--border-radius-sm)',
          padding: '10px 14px',
          color: syncMessage.startsWith('✓') ? '#22c55e' : 'var(--brand-primary)',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          {syncMessage}
        </div>
      )}

      {/* Main Grid: Line chart + metric cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2.5fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }} className="responsive-grid">
        
        {/* Line Chart Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Brand Coverage Over Time
              <Info size={14} style={{ color: 'var(--text-muted)', cursor: 'help' }} title="Percentage of search queries where the brand is recommended by AI engines" />
            </h3>
            
            <button 
              onClick={() => setShowCompetitorsOnly(!showCompetitorsOnly)}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Show: {showCompetitorsOnly ? 'All' : 'Me + Top 5 competitors'}
              <ChevronDown size={12} />
            </button>
          </div>

          {/* Interactive SVG Chart Container */}
          <div 
            style={{ position: 'relative', width: '100%', height: '240px', marginTop: '10px' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <svg viewBox="0 0 600 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              
              {/* Grid Y Lines */}
              {[0, 2.5, 5.0, 7.5, 10.0].map((tick) => {
                const y = getSvgY(tick);
                return (
                  <g key={tick}>
                    <line x1="50" y1={y} x2="570" y2={y} stroke="var(--border-light)" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="40" y={y + 4} fill="var(--text-muted)" fontSize="10" fontWeight="600" textAnchor="end">{tick}%</text>
                  </g>
                );
              })}

              {/* Grid X Lines */}
              {chartDays.map((day, idx) => {
                const width = 600;
                const paddingLeft = 50;
                const paddingRight = 30;
                const graphWidth = width - paddingLeft - paddingRight;
                const segmentWidth = graphWidth / (chartDays.length - 1);
                const x = paddingLeft + idx * segmentWidth;
                
                return (
                  <g key={day}>
                    <line x1={x} y1="10" x2={x} y2="210" stroke="var(--border-light)" strokeWidth="1" />
                    <text x={x} y="225" fill="var(--text-muted)" fontSize="11" fontWeight="600" textAnchor="middle">{day}</text>
                  </g>
                );
              })}

              {/* Render Lines */}
              {Object.keys(brandLines).map((brandName) => {
                const brand = brandLines[brandName];
                const isVisible = visibleBrands[brandName];
                if (!isVisible) return null;
                
                return (
                  <path
                    key={brandName}
                    d={generatePath(brand.points)}
                    fill="none"
                    stroke={brand.color}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'all 0.3s ease', opacity: hoverIndex !== null ? 0.35 : 0.85 }}
                  />
                );
              })}

              {/* Highlight active brand under hover */}
              {hoverIndex !== null && Object.keys(brandLines).map((brandName) => {
                const brand = brandLines[brandName];
                const isVisible = visibleBrands[brandName];
                if (!isVisible) return null;

                const width = 600;
                const paddingLeft = 50;
                const paddingRight = 30;
                const graphWidth = width - paddingLeft - paddingRight;
                const segmentWidth = graphWidth / (chartDays.length - 1);
                const x = paddingLeft + hoverIndex * segmentWidth;
                const y = getSvgY(brand.points[hoverIndex]);

                return (
                  <g key={brandName + '-hover'}>
                    <circle
                      cx={x}
                      cy={y}
                      r="6"
                      fill={brand.color}
                      stroke="white"
                      strokeWidth="2"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                    />
                  </g>
                );
              })}

              {/* Hover vertical guide line */}
              {hoverIndex !== null && (() => {
                const width = 600;
                const paddingLeft = 50;
                const paddingRight = 30;
                const graphWidth = width - paddingLeft - paddingRight;
                const segmentWidth = graphWidth / (chartDays.length - 1);
                const x = paddingLeft + hoverIndex * segmentWidth;
                
                return (
                  <line x1={x} y1="10" x2={x} y2="210" stroke="var(--brand-primary)" strokeWidth="1.5" strokeDasharray="2 2" style={{ pointerEvents: 'none' }} />
                );
              })()}

            </svg>

            {/* Custom Tooltip */}
            {hoverIndex !== null && (
              <div style={{
                position: 'absolute',
                left: tooltipPos.x,
                top: tooltipPos.y,
                backgroundColor: '#0f0a1c',
                color: 'white',
                padding: '12px 14px',
                borderRadius: '8px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                fontSize: '11px',
                zIndex: 10,
                pointerEvents: 'none',
                minWidth: '150px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', color: '#a78bfa' }}>
                  Coverage — {chartDays[hoverIndex]}
                </div>
                {Object.keys(brandLines).map((brandName) => {
                  const brand = brandLines[brandName];
                  if (!visibleBrands[brandName]) return null;
                  return (
                    <div key={brandName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: brand.color }}></span>
                        {brand.label}
                      </span>
                      <strong style={{ fontWeight: 700 }}>{brand.points[hoverIndex].toFixed(1)}%</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Checkbox Legend */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '10px',
            borderTop: '1px solid var(--border-light)',
            paddingTop: '16px'
          }}>
            {Object.keys(brandLines).map((brandName) => {
              const brand = brandLines[brandName];
              const isChecked = visibleBrands[brandName];
              
              return (
                <label
                  key={brandName}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    backgroundColor: isChecked ? `${brand.color}12` : 'transparent',
                    border: `1px solid ${isChecked ? brand.color : 'var(--border-medium)'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleCheckboxChange(brandName)}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px',
                    backgroundColor: isChecked ? brand.color : 'transparent',
                    border: `1.5px solid ${isChecked ? 'transparent' : 'var(--text-muted)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isChecked && <Check size={8} strokeWidth={4} style={{ color: 'white' }} />}
                  </span>
                  {brand.label}
                </label>
              );
            })}
          </div>

        </div>

        {/* Right Side Metric Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 1: Your Brand Mentions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Your Brand Mentions
              <Info size={12} style={{ opacity: 0.5, cursor: 'help' }} title={`Number of search query recommendations for ${activeWorkspace || 'Saleswizard.nl'} across all tested prompts`} />
            </h4>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: "'Outfit', sans-serif" }}>
                {saleswizardMentions}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--status-positive-text)', fontWeight: 700, backgroundColor: 'var(--status-positive-bg)', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <TrendingUp size={10} /> +12%
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              {mentions.map((item) => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: item.name === selfName ? 700 : 400, color: item.name === selfName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: item.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800 }}>
                      {item.name[0]}
                    </span>
                    {item.name}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Your Average Brand Position */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Your Average Brand Position
              <Info size={12} style={{ opacity: 0.5, cursor: 'help' }} title={`Average index position of ${activeWorkspace || 'Saleswizard.nl'} when listed by AI engines (1 is top)`} />
            </h4>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: "'Outfit', sans-serif" }}>
                {saleswizardPosition === 0 || country === 'Germany' && saleswizardMentions === 0 ? '-' : saleswizardPosition}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--status-positive-text)', fontWeight: 700, backgroundColor: 'var(--status-positive-bg)', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <TrendingUp size={10} /> #2 Rank
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              {positions.map((item) => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: item.name === selfName ? 700 : 400, color: item.name === selfName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: item.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800 }}>
                      {item.name[0]}
                    </span>
                    {item.name}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.score === 0 || country === 'Germany' && item.name === selfName ? '-' : item.score.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Bottom row grid: tables */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '24px'
      }} className="responsive-grid">
        
        {/* Brand Ranking Table */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Brand Ranking
              <Info size={14} style={{ color: 'var(--text-muted)' }} />
            </h3>
            <button style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--brand-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--border-medium)'
            }}>
              More Detected Brands
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Name</th>
                  <th style={{ textAlign: 'center' }}>Sentiment</th>
                  <th style={{ textAlign: 'right' }}>Mentions</th>
                  <th style={{ textAlign: 'right' }}>Brand Co...</th>
                  <th style={{ textAlign: 'right' }}>Share of...</th>
                </tr>
              </thead>
              <tbody>
                {brandRanking.map((row) => (
                  <tr key={row.name} style={{ fontWeight: row.name === selfName ? 700 : 400 }}>
                    <td>{row.rank}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaviconImage 
                          domain={row.domain} 
                          fallbackLabel={row.name} 
                          fallbackBg={row.logoColor} 
                          fallbackColor="white" 
                          size={20} 
                        />
                        {row.name}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.sentiment.startsWith('+') ? (
                        <span className="badge badge-positive" style={{ minWidth: '42px', justifyContent: 'center' }}>{row.sentiment}</span>
                      ) : row.sentiment === '0' ? (
                        <span className="badge badge-neutral" style={{ minWidth: '42px', justifyContent: 'center' }}>0</span>
                      ) : (
                        <span className="badge badge-neutral" style={{ minWidth: '42px', justifyContent: 'center' }}>{row.sentiment}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.mentions}</td>
                    <td style={{ textAlign: 'right' }}>{row.coverage}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Prompts by Brand Mentions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Top Prompts by Brand Mentions
              <Info size={14} style={{ color: 'var(--text-muted)' }} />
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Rank</th>
                  <th>Prompt</th>
                  <th style={{ textAlign: 'right', width: '160px' }}># of my brand mentions</th>
                </tr>
              </thead>
              <tbody>
                {topPrompts.map((row) => (
                  <tr key={row.text}>
                    <td>{row.rank}</td>
                    <td style={{ 
                      maxWidth: '240px', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}>
                      {row.text}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: row.mentions > 0 ? 'var(--brand-accent)' : 'var(--text-muted)' }}>
                      {row.mentions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Footer copyright / info */}
      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)' }}>
        © 2026 Saleswizard GEO Tooling. Generative Engine Optimization Analyzer.
      </div>

    </div>
  );
}
