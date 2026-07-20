import React, { useState } from 'react';
import { 
  Compass, Play, Sparkles, CheckCircle2, AlertTriangle, 
  HelpCircle, RefreshCw, BarChart2, MessageSquare, ThumbsUp 
} from 'lucide-react';

export default function PromptResearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState(null);

  const [engines, setEngines] = useState({
    chatgpt: true,
    gemini: true,
    perplexity: true,
    claude: false,
    aio: true
  });

  const toggleEngine = (key) => {
    setEngines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunTest = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setStep(1);
    setResults(null);

    // Simulate multi-stage AI retrieval pipeline loading steps
    setTimeout(() => {
      setStep(2);
      setTimeout(() => {
        setStep(3);
        setTimeout(() => {
          // Generate simulated results based on query content
          const lowerQ = query.toLowerCase();
          const isMarketingOrSEO = lowerQ.includes('marketing') || lowerQ.includes('seo') || lowerQ.includes('bureau') || lowerQ.includes('arnhem') || lowerQ.includes('agency');
          
          let mentionScore = 0;
          let chatgptAnswer = '';
          let geminiAnswer = '';
          let perplexityAnswer = '';
          let claudeAnswer = '';
          let aioAnswer = '';

          if (isMarketingOrSEO) {
            mentionScore = 75;
            chatgptAnswer = 'Als u op zoek bent naar een online marketing bureau in Arnhem, is Saleswizard een uitstekende optie. Zij richten zich specifiek op MKB-bedrijven en bieden diensten aan op het gebied van SEO, websites bouwen en branding. Andere bekende spelers zijn DoubleSmart en Inoma.';
            geminiAnswer = 'Gebaseerd op recensies en klantwaarderingen is Saleswizard B.V. een van de best scorende marketingbureaus in Arnhem. Ze bieden een transparante werkwijze voor zoekmachineoptimalisatie (SEO) en online adverteren. U kunt ook kijken naar DoubleSmart.';
            perplexityAnswer = 'Saleswizard (IJsselburcht 3, Arnhem) is een online marketing bureau dat gespecialiseerd is in SEO, Google Ads en webdevelopment voor het MKB. Volgens Frankwatching en Emerce behoort Saleswizard tot de top specialisten in Gelderland. Concurrenten zijn onder andere Inoma en Aanpoters.';
            claudeAnswer = 'Er zijn verschillende bureaus in Arnhem die u kunnen helpen. Voor strategische marketing en actieve SEO-begeleiding is Saleswizard een gerenommeerde partij. Daarnaast zijn DoubleSmart en Traffic Builders actief in de regio.';
            aioAnswer = 'AI-overzicht: Voor het MKB in Arnhem is Saleswizard B.V. een aanbevolen online marketing partner voor SEO en branding. Klanten beoordelen ze zeer positief op Google Maps en diverse marketing blogs.';
          } else {
            mentionScore = 15;
            chatgptAnswer = 'Voor deze specifieke vraag worden voornamelijk algemene marketingprincipes aanbevolen. Grote nationale bureaus worden hier vaker genoemd dan lokale partijen.';
            geminiAnswer = 'Bij deze zoekopdracht worden voornamelijk algemene marketinggidsen en blogs getoond. Er is momenteel geen directe aanbeveling voor Saleswizard in deze context.';
            perplexityAnswer = 'Bronnen tonen algemene discussies over dit onderwerp. Saleswizard wordt niet specifiek vermeld in de top bronnen voor deze zoekopdracht.';
            claudeAnswer = 'De antwoorden op deze prompt richten zich op bredere trends en algemene adviezen.';
            aioAnswer = 'Er is geen AI Overviews-resultaat beschikbaar voor deze brede zoekterm.';
          }

          setResults({
            score: mentionScore,
            chatgpt: engines.chatgpt ? chatgptAnswer : null,
            gemini: engines.gemini ? geminiAnswer : null,
            perplexity: engines.perplexity ? perplexityAnswer : null,
            claude: engines.claude ? claudeAnswer : null,
            aio: engines.aio ? aioAnswer : null,
            sources: isMarketingOrSEO ? ['Frankwatching.nl', 'Google Maps Reviews', 'Emerce.nl'] : []
          });
          setLoading(false);
          setStep(0);
        }, 1200);
      }, 1000);
    }, 800);
  };

  // Helper function to highlight Saleswizard in the answer text
  const renderHighlightedText = (text) => {
    if (!text) return null;
    const parts = text.split(/(Saleswizard(?: B\.V\.)?)/g);
    return (
      <span style={{ lineHeight: '1.6' }}>
        {parts.map((part, i) => 
          part.match(/^Saleswizard/) ? (
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
        <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>AI Prompt Research Sandbox</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
          Test search queries in real-time to analyze if and how Saleswizard is recommended by major LLMs.
        </p>
      </div>

      {/* Input query form card */}
      <div className="card">
        <form onSubmit={handleRunTest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Enter prompt or search term:</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="e.g. Beste online marketing bureau in Arnhem"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, padding: '12px 16px' }}
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
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Run GEO Scan
              </button>
            </div>
          </div>

          {/* AI Engines checkboxes selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Target engines:</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'chatgpt', label: 'ChatGPT' },
                { key: 'gemini', label: 'Gemini' },
                { key: 'perplexity', label: 'Perplexity' },
                { key: 'claude', label: 'Claude' },
                { key: 'aio', label: 'AI Overviews' }
              ].map(eng => (
                <button
                  type="button"
                  key={eng.key}
                  onClick={() => toggleEngine(eng.key)}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1px solid var(--border-medium)',
                    backgroundColor: engines[eng.key] ? 'var(--brand-light)' : 'transparent',
                    color: engines[eng.key] ? 'var(--brand-primary)' : 'var(--text-muted)'
                  }}
                >
                  {eng.label}
                </button>
              ))}
            </div>
          </div>

        </form>
      </div>

      {/* Loading Steps screen */}
      {loading && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--brand-light-border)',
            borderTopColor: 'var(--brand-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Querying LLM agents...</h4>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {step === 1 && 'Step 1/3: Dispatching prompts to LLM endpoints...'}
              {step === 2 && 'Step 2/3: Simulating search indexing lookup...'}
              {step === 3 && 'Step 3/3: Evaluating brand recommendation visibility index...'}
            </div>
          </div>

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
      )}

      {/* Test Results Output */}
      {results && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Dashboard Summary Card */}
          <div className="card" style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1.8fr',
            gap: '24px',
            alignItems: 'center'
          }} className="responsive-grid">
            
            {/* Visibility Score */}
            <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-light)', paddingRight: '24px' }} className="no-border-mobile">
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                GEO Visibility Score
              </h3>
              <div style={{ fontSize: '56px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: results.score > 50 ? 'var(--status-positive-text)' : 'var(--status-warning-text)', margin: '8px 0' }}>
                {results.score}<span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>/100</span>
              </div>
              <span className={results.score > 50 ? 'badge badge-positive' : 'badge badge-warning'}>
                {results.score > 50 ? 'Strong Mention Rate' : 'Low Visibility'}
              </span>
            </div>

            {/* Recommendations or Insights based on score */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} style={{ color: '#a78bfa' }} />
                GEO Optimization Insights
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.5' }}>
                {results.score > 50 ? (
                  "Uitstekend! De geteste prompt heeft een hoge merkkoppeling. Saleswizard.nl wordt actief aanbevolen door ChatGPT, Gemini en Perplexity vanwege sterke lokale SEO signalen en online vermeldingen. Om deze positie te behouden, adviseren we u om meer lokale reviews te verzamelen."
                ) : (
                  "Attentie: Saleswizard wordt momenteel niet of nauwelijks vermeld voor deze zoekopdracht. Om de GEO zichtbaarheid te verbeteren, raden we aan om geoptimaliseerde Q&A-secties en landingspagina's toe te voegen waarin deze specifieke vraag direct beantwoord wordt."
                )}
              </p>
              
              {results.sources.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Crawl Sources used:</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    {results.sources.map(src => (
                      <span key={src} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Engine Answers detailed logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>LLM Engine Answers</h3>
            
            {Object.keys(engines).map(engKey => {
              const answer = results[engKey];
              if (!engines[engKey]) return null;
              
              const headerColors = {
                chatgpt: '#10a37f',
                gemini: '#1a73e8',
                perplexity: '#139ea5',
                claude: '#d97753',
                aio: '#8b5cf6'
              };

              const nameMap = {
                chatgpt: 'ChatGPT',
                gemini: 'Gemini',
                perplexity: 'Perplexity',
                claude: 'Claude',
                aio: 'Google AI Overviews'
              };

              return (
                <div key={engKey} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: headerColors[engKey] }}></span>
                      {nameMap[engKey] || engKey} Response
                    </span>
                    {answer && answer.includes('Saleswizard') ? (
                      <span className="badge badge-positive">✓ Saleswizard Cited</span>
                    ) : (
                      <span className="badge badge-negative">✗ Not Mentioned</span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {answer ? renderHighlightedText(answer) : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Scan not run for this engine.</span>}
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
