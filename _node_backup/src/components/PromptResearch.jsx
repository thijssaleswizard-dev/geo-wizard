import React, { useState } from 'react';
import { 
  Compass, Play, Sparkles, CheckCircle2, AlertTriangle, 
  HelpCircle, RefreshCw, BarChart2, MessageSquare, ExternalLink, Terminal, ShieldCheck 
} from 'lucide-react';

export default function PromptResearch({ activeWorkspace }) {
  const targetCompany = (activeWorkspace || 'Saleswizard.nl').replace('.nl', '');
  const [query, setQuery] = useState('Zoek een betrouwbaar online marketing bureau voor mijn webshop');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const [engines, setEngines] = useState({
    chatgpt: true,
    gemini: true,
    perplexity: true,
    copilot: true,
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

  // Helper function to highlight the target company in the answer text
  const renderHighlightedText = (text, companyName) => {
    if (!text) return null;
    const regex = new RegExp(`(${companyName}|Saleswizard|DoubleSmart|Inoma|Aanpoters)`, 'gi');
    const parts = text.split(regex);
    return (
      <span style={{ lineHeight: '1.6' }}>
        {parts.map((part, i) => 
          part.match(regex) ? (
            <strong key={i} style={{
              backgroundColor: 'rgba(68, 0, 153, 0.12)',
              color: 'var(--brand-primary)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(68, 0, 153, 0.25)',
              fontWeight: 800
            }}>
              {part}
            </strong>
          ) : part
        )}
      </span>
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
            backgroundColor: '#0f172a',
            color: '#38bdf8',
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
          <div className="card" style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1.8fr',
            gap: '24px',
            alignItems: 'center'
          }} className="responsive-grid">
            
            {/* Overall Mentions Score */}
            <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-light)', paddingRight: '24px' }} className="no-border-mobile">
              <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                AI Model Vermeldingen Score
              </h3>
              <div style={{ fontSize: '52px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: results.overallScore >= 50 ? 'var(--status-positive-text)' : 'var(--status-warning-text)', margin: '8px 0' }}>
                {results.totalMentions}<span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>/{results.totalModels} Modellen</span>
              </div>
              <span className={results.overallScore >= 50 ? 'badge badge-positive' : 'badge badge-warning'}>
                {results.overallScore}% Zichtbaarheid in AI antwoorden
              </span>
            </div>

            {/* AI Scraper Summary */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} style={{ color: '#a78bfa' }} />
                Scraper Conclusie & Database Status
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.5' }}>
                De prompt <strong>"{results.prompt}"</strong> is succesvol gescand. Het merk <strong>{results.company}</strong> wordt door <strong>{results.totalMentions} van de {results.totalModels} AI modellen</strong> aanbevolen. Alle gedetecteerde bronnen en citaties zijn opgeslagen in SQLite.
              </p>
              
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>
                <ShieldCheck size={14} />
                Resultaten & {results.citations.length} citaties automatisch opgeslagen in SQLite database!
              </div>
            </div>

          </div>

          {/* Model Mentions Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Mentions Breakdown Per AI Model</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {Object.keys(results.modelMentions).map(mKey => {
                const item = results.modelMentions[mKey];
                return (
                  <div key={mKey} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.name}</div>
                        {item.method && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                            {item.method}
                          </div>
                        )}
                      </div>
                      <span className={item.mentioned ? 'badge badge-positive' : 'badge badge-negative'}>
                        {item.mentioned ? `✓ Vermeld (#${item.position})` : '✗ Niet vermeld'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {renderHighlightedText(item.summary, targetCompany)}
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
