import React, { useState } from 'react';
import { 
  Award, CheckSquare, Square, RefreshCw, 
  HelpCircle, Sparkles, Zap, Play 
} from 'lucide-react';

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState([
    {
      id: 1,
      title: 'Voeg gestructureerde Schema.org LocalBusiness data toe',
      desc: 'Implementeer JSON-LD gestructureerde data op de contact- en homepagina om LLM crawler bots direct te voorzien van correcte bedrijfsgegevens (naam, adres, telefoon, openingstijden).',
      difficulty: 'Easy',
      impact: 'High',
      done: true,
      category: 'Technical'
    },
    {
      id: 2,
      title: 'Verhoog autoriteit via externe vermeldingen',
      desc: 'Zorg voor citations op hoogwaardige marketingblogs en directories zoals Frankwatching, Emerce en Telefoonboek. LLMs scannen deze sites om autoriteit te bepalen.',
      difficulty: 'Medium',
      impact: 'High',
      done: false,
      category: 'PR & Citations'
    },
    {
      id: 3,
      title: 'Optimaliseer H1/H2 titels voor vragende zoekopdrachten',
      desc: 'Pas koppen aan om directe antwoorden te geven op vragen als "Wat is het beste online marketing bureau in Arnhem?". LLMs pakken deze structuur snel op.',
      difficulty: 'Easy',
      impact: 'Medium',
      done: false,
      category: 'On-Page Content'
    },
    {
      id: 4,
      title: 'Publiceer diepgaande casestudies met resultaten',
      desc: 'Schrijf projectcases waarin concrete stijgingen in leads, conversie en posities worden genoemd. LLM-modellen geven de voorkeur aan feitelijke, data-driven inhoud.',
      difficulty: 'Medium',
      impact: 'High',
      done: false,
      category: 'On-Page Content'
    },
    {
      id: 5,
      title: 'Verzamel actieve Google Reviews',
      desc: 'LLMs zoals Gemini en ChatGPT browsen live op Google Maps om lokale aanbevelingen te onderbouwen. Meer positieve reviews verhogen je GEO aanbevelingsfactor.',
      difficulty: 'Easy',
      impact: 'High',
      done: false,
      category: 'Reviews'
    },
    {
      id: 6,
      title: 'Genereer AI-vriendelijke XML sitemap',
      desc: 'Zorg dat er een aparte geoptimaliseerde XML sitemap is waarin de belangrijkste antwoord-pagina\'s en kennishub-artikelen direct gelinkt staan voor snelle indexatie.',
      difficulty: 'Easy',
      impact: 'Low',
      done: true,
      category: 'Technical'
    }
  ]);

  const handleToggle = (id) => {
    setRecommendations(recommendations.map(rec => {
      if (rec.id === id) {
        return { ...rec, done: !rec.done };
      }
      return rec;
    }));
  };

  const doneCount = recommendations.filter(r => r.done).length;
  const progressPct = Math.round((doneCount / recommendations.length) * 100);

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return <span className="badge badge-positive" style={{ fontSize: '10px' }}>EASY</span>;
      case 'Medium': return <span className="badge badge-warning" style={{ fontSize: '10px' }}>MEDIUM</span>;
      case 'Hard': return <span className="badge badge-negative" style={{ fontSize: '10px' }}>HARD</span>;
      default: return null;
    }
  };

  const getImpactBadge = (impact) => {
    switch (impact) {
      case 'High': return <span className="badge badge-negative" style={{ fontSize: '10px', backgroundColor: '#fee2e2', color: '#991b1b' }}>HIGH IMPACT</span>;
      case 'Medium': return <span className="badge badge-warning" style={{ fontSize: '10px', backgroundColor: '#ffedd5', color: '#c2410c' }}>MID IMPACT</span>;
      case 'Low': return <span className="badge badge-positive" style={{ fontSize: '10px', backgroundColor: '#ecfdf5', color: '#065f46' }}>LOW IMPACT</span>;
      default: return null;
    }
  };

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>GEO Recommendations</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Actionable optimization recommendations for Saleswizard.nl to rank higher in ChatGPT, Gemini and Perplexity search answers.
          </p>
        </div>
      </div>

      {/* Checklist Progress Header Card */}
      <div className="card" style={{
        background: 'linear-gradient(145deg, #1f143a, #0f0a1c)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        border: 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} style={{ color: '#a78bfa' }} />
              GEO Implementation Score
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '4px' }}>
              Completed <strong>{doneCount}</strong> of <strong>{recommendations.length}</strong> core AI search recommendations.
            </p>
          </div>
          <span style={{ fontSize: '32px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#a78bfa' }}>
            {progressPct}%
          </span>
        </div>

        <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(to right, #8b5cf6, #c084fc)', transition: 'width 0.4s ease' }}></div>
        </div>
      </div>

      {/* Recommendations Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            onClick={() => handleToggle(rec.id)}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'start',
              gap: '16px',
              cursor: 'pointer',
              borderColor: rec.done ? 'var(--status-positive-bg)' : 'var(--border-light)',
              backgroundColor: rec.done ? 'rgba(236, 253, 245, 0.15)' : 'var(--bg-card)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Checkbox Icon */}
            <div style={{ marginTop: '2px', color: rec.done ? 'var(--status-positive-text)' : 'var(--text-muted)' }}>
              {rec.done ? (
                <CheckSquare size={22} style={{ fill: '#dcfce7' }} />
              ) : (
                <Square size={22} />
              )}
            </div>

            {/* Content Details */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  textDecoration: rec.done ? 'line-through' : 'none',
                  color: rec.done ? 'var(--text-muted)' : 'var(--text-primary)'
                }}>
                  {rec.title}
                </h4>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{rec.category}</span>
                  {getDifficultyBadge(rec.difficulty)}
                  {getImpactBadge(rec.impact)}
                </div>
              </div>

              <p style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: '1.5',
                textDecoration: rec.done ? 'line-through' : 'none',
                opacity: rec.done ? 0.6 : 1
              }}>
                {rec.desc}
              </p>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
