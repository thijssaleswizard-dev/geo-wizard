import React, { useState } from 'react';
import { 
  BarChart2, Info, MessageSquare, Sparkles, TrendingUp, 
  CheckCircle, ArrowUpRight, Zap, RefreshCw 
} from 'lucide-react';

export default function AgentsAnalytics() {
  const [activeEngine, setActiveEngine] = useState('All');

  // Engines database
  const enginesData = {
    chatgpt: {
      name: 'ChatGPT (OpenAI)',
      visibility: 25,
      mentions: 5,
      sentiment: '+78',
      crawlFreq: 'Daily',
      status: 'Indexed',
      color: '#10a37f', // ChatGPT Green
      topCitations: ['Frankwatching.nl', 'Google Reviews']
    },
    gemini: {
      name: 'Gemini (Google)',
      visibility: 30,
      mentions: 6,
      sentiment: '+88',
      crawlFreq: 'Hourly',
      status: 'Real-time Search',
      color: '#1a73e8', // Gemini Blue
      topCitations: ['Google Reviews', 'Emerce.nl']
    },
    perplexity: {
      name: 'Perplexity AI',
      visibility: 45,
      mentions: 9,
      sentiment: '+68',
      crawlFreq: 'Real-time',
      status: 'Fully Crawled',
      color: '#139ea5', // Perplexity Teal
      topCitations: ['Frankwatching.nl', 'MarketingTribune.nl', 'Emerce.nl']
    },
    copilot: {
      name: 'Copilot (Microsoft)',
      visibility: 15,
      mentions: 3,
      sentiment: '+45',
      crawlFreq: 'Daily',
      status: 'Partial Index',
      color: '#0078d4', // Microsoft Blue
      topCitations: ['Telefoonboek.nl', 'Google Reviews']
    },
    claude: {
      name: 'Claude (Anthropic)',
      visibility: 10,
      mentions: 2,
      sentiment: '+92',
      crawlFreq: 'Weekly',
      status: 'Cached Knowledge',
      color: '#d97753', // Anthropic Orange
      topCitations: ['Frankwatching.nl', 'Emerce.nl']
    },
    ai_overviews: {
      name: 'Google AI Overviews',
      visibility: 35,
      mentions: 7,
      sentiment: '+84',
      crawlFreq: 'Hourly',
      status: 'Real-time Search',
      color: '#8b5cf6', // Indigo/Purple
      topCitations: ['Google Reviews', 'Frankwatching.nl', 'Emerce.nl']
    }
  };

  const getEnginesToRender = () => {
    if (activeEngine === 'All') {
      return Object.keys(enginesData);
    }
    if (activeEngine === 'Google AI Overviews') return ['ai_overviews'];
    const key = activeEngine.toLowerCase()
      .replace(' (openai)', '')
      .replace(' (google)', '')
      .replace(' ai', '')
      .replace(' (microsoft)', '')
      .replace(' (anthropic)', '');
    return [key];
  };

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Agents Analytics</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Detailed breakdown of Saleswizard.nl visibility metrics inside individual AI engines.
          </p>
        </div>
      </div>

      {/* Engine filter selectors */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter Engine:</span>
        <button
          onClick={() => setActiveEngine('All')}
          style={{
            padding: '6px 14px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: activeEngine === 'All' ? 'var(--brand-primary)' : 'transparent',
            color: activeEngine === 'All' ? 'white' : 'var(--text-secondary)',
            border: activeEngine === 'All' ? 'none' : '1px solid var(--border-medium)'
          }}
        >
          All Engines
        </button>
        {Object.keys(enginesData).map(key => {
          const name = enginesData[key].name;
          const isActive = activeEngine === name;
          return (
            <button
              key={key}
              onClick={() => setActiveEngine(name)}
              style={{
                padding: '6px 14px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent',
                color: isActive ? 'white' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border-medium)'
              }}
            >
              {name === 'Google AI Overviews' ? 'AI Overviews' : name.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Overview Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }} className="responsive-grid">
        
        {/* Main share bar card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            Brand Recommendation Index Share
            <Info size={14} style={{ color: 'var(--text-muted)' }} title="AI search engine visibility rating based on prompt indexing scan." />
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '10px' }}>
            {getEnginesToRender().map(key => {
              const eng = enginesData[key];
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: eng.color }}></span>
                      {eng.name}
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{eng.visibility}% visibility</strong>
                  </div>
                  
                  {/* Progress Line */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${eng.visibility}%`, height: '100%', backgroundColor: eng.color, borderRadius: '4px' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Highlight Insights Card */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, #150f24, #0b0717)',
          color: 'white',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <span style={{
              fontSize: '9px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '20px',
              backgroundColor: '#a78bfa',
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              AI Performance Insight
            </span>
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>
              Perplexity leads recommendations
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '8px', lineHeight: '1.5' }}>
              Saleswizard B.V. has the strongest indexation rate in Perplexity AI (45%). This is caused by strong, recent press citation crawl matching and rich Google Maps review indexing schemas.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              <span>Strongest Engine:</span>
              <strong style={{ color: 'white' }}>Perplexity AI</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              <span>Weakest Engine:</span>
              <strong style={{ color: 'white' }}>Claude (Anthropic)</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Grid: detailed metrics list */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {getEnginesToRender().map(key => {
          const eng = enginesData[key];
          return (
            <div key={key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: `4px solid ${eng.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{eng.name}</h4>
                <span className="badge badge-positive" style={{ backgroundColor: `${eng.color}15`, color: eng.color }}>
                  {eng.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Mentions</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{eng.mentions}</div>
                </div>
                
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Sentiment</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--status-positive-text)' }}>{eng.sentiment}</div>
                </div>

                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Crawl Freq</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{eng.crawlFreq}</div>
                </div>

                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Visibility</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{eng.visibility}%</div>
                </div>
              </div>

              {/* Citations references */}
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Top citation sources:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {eng.topCitations.map(source => (
                    <span key={source} style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-light)'
                    }}>
                      {source}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
