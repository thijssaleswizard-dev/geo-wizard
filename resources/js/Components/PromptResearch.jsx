import React, { useState } from 'react';
import { 
  Compass, Play, Sparkles, CheckCircle2, AlertTriangle, 
  HelpCircle, RefreshCw, BarChart2, MessageSquare, ExternalLink, Terminal, ShieldCheck 
} from 'lucide-react';

export default function PromptResearch({ activeWorkspace, enabledEngines }) {
  const targetCompany = (activeWorkspace || 'Saleswizard.nl').replace(/\.(nl|com|eu|de|be|org|net|io|co|info|biz|[a-z]{2,8})$/i, '');
  const [query, setQuery] = useState('Zoek een betrouwbaar online marketing bureau voor mijn webshop');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const [engines, setEngines] = useState({
    chatgpt: true,
    gemini: true,
    perplexity: true,
    copilot: !!enabledEngines?.copilot,
    claude: true,
    aio: true
  });

  const toggleEngine = (key) => {
    setEngines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunTest = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults(null);
    setError('');
    setLogs([
      `[Scraper] Initialiserend live web & AI crawler voor prompt: "${query.trim()}"...`,
      `[Scraper] Target merk: "${targetCompany}"...`,
      `[Scraper] Verbinden met API endpoint /api/scraper/run...`
    ]);

    try {
      const response = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: query.trim(),
          company: targetCompany
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Scraper kon niet worden voltooid.');
        setLoading(false);
        return;
      }

      setLogs(data.logs || []);
      setResults(data);
      setLoading(false);
    } catch (err) {
      console.error('Error running scraper:', err);
      setError('Kan geen verbinding maken met de scraper service.');
      setLoading(false);
    }
  };

  // Rich markdown renderer for images, clickable links, bold text, and brand highlighting
  const renderHighlightedText = (text, companyName, citationsList = []) => {
    if (!text) return null;
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');

    const normalizeUrl = (raw) => {
      if (!raw) return '';
      let u = raw.trim().replace(/^<|>$/g, '');
      const sq = u.search(/\s+["']/);
      if (sq > 0) u = u.slice(0, sq).trim();
      if (u.startsWith('//')) return `https:${u}`;
      if (u.startsWith('/search?') || u.startsWith('/maps')) return `https://www.google.nl${u}`;
      if (u.startsWith('www.')) return `https://${u}`;
      return u;
    };

    const renderInline = (lineStr, lineKey) => {
      const tokenRegex = /(\[!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|\*\*([^*]+)\*\*|(?:https?:\/\/|www\.)[^\s<)\]]+)/gi;
      const out = [];
      let last = 0;
      let m;
      let tIdx = 0;

      const pushHighlighted = (str, k) => {
        if (!str) return;
        const regex = new RegExp(`(${companyName}|Saleswizard|DoubleSmart|Inoma|Aanpoters)`, 'gi');
        const parts = str.split(regex);
        parts.forEach((part, i) => {
          if (!part) return;
          if (part.match(regex)) {
            out.push(
              <strong key={`${k}_${i}`} style={{
                backgroundColor: '#f1f5f9',
                color: '#0f172a',
                padding: '1px 6px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontWeight: 700
              }}>
                {part}
              </strong>
            );
          } else {
            out.push(<React.Fragment key={`${k}_${i}`}>{part}</React.Fragment>);
          }
        });
      };

      while ((m = tokenRegex.exec(lineStr)) !== null) {
        if (m.index > last) {
          pushHighlighted(lineStr.slice(last, m.index), `${lineKey}_p_${tIdx++}`);
        }
        if (m[2] !== undefined && m[3] !== undefined && m[4] !== undefined) {
          const imgSrc = normalizeUrl(m[3]);
          const linkHref = normalizeUrl(m[4]);
          if (imgSrc.startsWith('http') && !imgSrc.includes('R0lGODlhAQAB')) {
            out.push(
              <a key={`${lineKey}_li_${tIdx++}`} href={linkHref} target="_blank" rel="noreferrer" style={{ display: 'inline-block', margin: '6px 6px 6px 0' }}>
                <img src={imgSrc} alt={m[2] || ''} referrerPolicy="no-referrer" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ maxWidth: '180px', maxHeight: '120px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
              </a>
            );
          }
        } else if (m[5] !== undefined && m[6] !== undefined) {
          const imgSrc = normalizeUrl(m[6]);
          if (imgSrc.startsWith('http') && !imgSrc.includes('R0lGODlhAQAB')) {
            out.push(
              <img key={`${lineKey}_im_${tIdx++}`} src={imgSrc} alt={m[5] || ''} referrerPolicy="no-referrer" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ maxWidth: '180px', maxHeight: '120px', borderRadius: '6px', border: '1px solid #e2e8f0', margin: '6px 6px 6px 0', display: 'inline-block' }} />
            );
          }
        } else if (m[7] !== undefined && m[8] !== undefined) {
          const href = normalizeUrl(m[8]);
          const label = m[7].replace(/^\*\*|\*\*$/g, '');
          out.push(
            <a key={`${lineKey}_lk_${tIdx++}`} href={href} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline', margin: '0 2px' }}>
              {label} ↗
            </a>
          );
        } else if (m[9] !== undefined) {
          out.push(<strong key={`${lineKey}_bd_${tIdx++}`} style={{ color: '#0f172a' }}>{m[9]}</strong>);
        } else {
          const href = normalizeUrl(m[0]);
          out.push(
            <a key={`${lineKey}_bu_${tIdx++}`} href={href} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline', margin: '0 2px' }}>
              {href} ↗
            </a>
          );
        }
        last = tokenRegex.lastIndex;
      }
      if (last < lineStr.length) {
        pushHighlighted(lineStr.slice(last), `${lineKey}_e_${tIdx++}`);
      }
      return out;
    };

    return (
      <div style={{ lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {lines.map((ln, idx) => {
          const tr = ln.trim();
          if (!tr) return null;
          return <div key={idx}>{renderInline(tr, `ln_${idx}`)}</div>;
        })}
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
          Live Web & AI Scraper Engine
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
          Voer een willekeurige zoekopdracht of prompt in en laat de scraper live het web & 6 AI-modellen scannen op vermeldingen van <strong>{targetCompany}</strong>.
        </p>
      </div>

      {/* Input query form card */}
      <div className="card">
        <form onSubmit={handleRunTest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Voer een prompt of zoekvraag in:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="bijv. Zoek een betrouwbaar online marketing bureau voor mijn webshop"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, padding: '12px 16px', fontSize: '14px' }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={{
                  backgroundColor: loading || !query.trim() ? 'var(--text-muted)' : 'var(--brand-primary)',
                  color: 'white',
                  fontWeight: 700,
                  padding: '12px 24px',
                  borderRadius: 'var(--border-radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Start Live Scraper
              </button>
            </div>
          </div>

          {/* Preset sample prompts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Probeer voorbeeld:</span>
            {[
              'Zoek een betrouwbaar online marketing bureau voor mijn webshop',
              'Wat is het beste SEO bureau in Arnhem voor MKB?',
              'Welke bureaus zijn gespecialiseerd in AI en GEO optimalisaties?'
            ].map((samplePrompt) => (
              <button
                key={samplePrompt}
                type="button"
                onClick={() => setQuery(samplePrompt)}
                disabled={loading}
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {samplePrompt}
              </button>
            ))}
          </div>

        </form>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--border-radius-sm)',
          padding: '12px 16px',
          color: '#ef4444',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {/* Loading Steps & Real-Time Scraper Logs */}
      {loading && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--brand-primary)' }} />
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Scraper is actief...</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Het web en AI zoekbronnen worden live gescand op vermeldingen van {targetCompany}.</p>
            </div>
          </div>
          
          {/* Terminal log window */}
          <div style={{
            backgroundColor: '#440099',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '16px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #1e293b'
          }}>
            {logs.map((logLine, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={12} style={{ color: '#94a3b8' }} />
                <span>{logLine}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results Output */}
      {results && !loading && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Dashboard Summary Card */}
          <div className="card responsive-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1.8fr',
            gap: '24px',
            alignItems: 'center'
          }}>
            
            {/* Overall Mentions Score */}
            <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-light)', paddingRight: '24px' }} className="no-border-mobile">
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                AI Model Vermeldingen Score
              </h3>
              <div style={{ fontSize: '48px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#0f172a', margin: '8px 0' }}>
                {results.totalMentions}<span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>/{results.totalModels} Modellen</span>
              </div>
              <span className="badge badge-neutral">
                {results.overallScore}% zichtbaarheid in AI antwoorden
              </span>
            </div>

            {/* AI Scraper Summary */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} style={{ color: '#64748b' }} />
                Scraper Conclusie & Database Status
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.5' }}>
                De prompt <strong>"{results.prompt}"</strong> is succesvol gescand. Het merk <strong>{results.company}</strong> wordt door <strong>{results.totalMentions} van de {results.totalModels} AI modellen</strong> aanbevolen. Alle gedetecteerde bronnen en citaties zijn opgeslagen.
              </p>
              
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>
                <ShieldCheck size={14} style={{ color: '#47ca9b' }} />
                Resultaten & {results.citations.length} citaties automatisch opgeslagen
              </div>
            </div>

          </div>

          {/* Model Mentions Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Mentions Breakdown Per AI Model</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {Object.keys(results.modelMentions).map(mKey => {
                const item = results.modelMentions[mKey];
                const isUnavailable = Boolean(
                  item.failed ||
                  item.isSimulated ||
                  item.fallbackUsed ||
                  item.available === false ||
                  String(item.method || '').toLowerCase().includes('simulator')
                );
                return (
                  <div key={mKey} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', opacity: isUnavailable ? 0.72 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.name}</div>
                        {item.method && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                            {item.method}
                          </div>
                        )}
                      </div>
                      {isUnavailable ? (
                        <span className="badge badge-warning">
                          ⚠ Niet gemeten
                        </span>
                      ) : (
                        <span className={item.mentioned ? 'badge badge-positive' : 'badge badge-negative'}>
                          {item.mentioned ? `✓ Vermeld (#${item.position})` : '✗ Niet vermeld'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {isUnavailable
                        ? (item.errorMsg || 'API tijdelijk niet beschikbaar — resultaat telt niet mee in de zichtbaarheidsscore.')
                        : renderHighlightedText(item.summary, targetCompany)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scraped Web Citations */}
          {results.citations && results.citations.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Gescrapte Web Citaties & Bronnen ({results.citations.length})</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {results.citations.map((cit, i) => (
                  <div key={i} style={{
                    padding: '12px',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <a 
                        href={cit.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontWeight: 700, fontSize: '13px', color: 'var(--brand-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {cit.title}
                        <ExternalLink size={12} />
                      </a>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 700 }}>
                        {cit.domain}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{cit.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>

    </div>
  );
}
