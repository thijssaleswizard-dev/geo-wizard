import React, { useState, useEffect } from 'react';
import { 
  Coins, Receipt, Cpu, Activity, TrendingUp, RefreshCw, 
  Download, Filter, Search, CheckCircle2, AlertTriangle, 
  Calendar, Layers, ArrowUpRight, ChevronRight, Info, ExternalLink,
  ShieldCheck, HelpCircle
} from 'lucide-react';

export default function LlmCosts({ activeWorkspace, currentUser, enabledEngines }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('all');
  const [selectedEngineFilter, setSelectedEngineFilter] = useState('all');
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  const fetchCostData = async (selectedPeriod = period) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period', selectedPeriod);
      if (activeWorkspace) params.append('company', activeWorkspace);

      const res = await fetch(`/api/llm-costs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Fout bij ophalen LLM kosten:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostData(period);
  }, [period, activeWorkspace]);

  // Export CSV helper
  const handleExportCsv = () => {
    if (!data?.recentLogs || data.recentLogs.length === 0) return;

    const headers = ['ID', 'Tijdstip', 'Engine', 'Model', 'Project', 'Operatie', 'Input Tokens', 'Output Tokens', 'Totaal Tokens', 'Kosten EUR', 'Kosten USD', 'Latency', 'Status'];
    const rows = data.recentLogs.map(l => [
      l.id,
      `"${l.timestamp || ''}"`,
      `"${l.engine}"`,
      `"${l.model}"`,
      `"${l.projectName || ''}"`,
      `"${l.operation}"`,
      l.inputTokens,
      l.outputTokens,
      l.totalTokens,
      l.costEur,
      l.costUsd,
      `"${l.latency}"`,
      `"${l.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `llm_kosten_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = data?.summary || {
    totalCostEur: 0,
    totalCostUsd: 0,
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalRequests: 0,
    successfulRequests: 0,
    fallbackRequests: 0,
    failedRequests: 0,
    avgCostPerRequestEur: 0,
  };

  const byEngine = data?.byEngine || [];
  const byProject = data?.byProject || [];
  const dailyTrends = data?.dailyTrends || [];
  const recentLogs = data?.recentLogs || [];

  const filteredLogs = recentLogs.filter(log => {
    const matchesEngine = selectedEngineFilter === 'all' || log.engine === selectedEngineFilter;
    const matchesSearch = !searchLogQuery || 
      log.engine.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      log.model.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      (log.projectName && log.projectName.toLowerCase().includes(searchLogQuery.toLowerCase())) ||
      log.operation.toLowerCase().includes(searchLogQuery.toLowerCase());
    return matchesEngine && matchesSearch;
  });

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #440099 0%, #7e22ce 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(68, 0, 153, 0.25)'
            }}>
              <Coins size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827', margin: 0 }}>
                LLM Kosten & Verbruik
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px', margin: 0 }}>
                Volledig realtime inzicht in tokenverbruik, API-kosten en efficiëntie per individuele LLM engine.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Period selector */}
          <div style={{
            display: 'flex',
            backgroundColor: '#f3f4f6',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid #e5e7eb'
          }}>
            {[
              { id: 'all', label: 'Alles' },
              { id: 'month', label: 'Deze maand' },
              { id: '30d', label: '30 dagen' },
              { id: '7d', label: '7 dagen' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setPeriod(item.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: period === item.id ? 700 : 500,
                  backgroundColor: period === item.id ? '#ffffff' : 'transparent',
                  color: period === item.id ? 'var(--brand-primary)' : '#4b5563',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: period === item.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={recentLogs.length === 0}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              color: '#374151',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: recentLogs.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={14} />
            CSV Export
          </button>

          {/* Refresh button */}
          <button
            onClick={() => fetchCostData()}
            disabled={loading}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--brand-primary)',
              border: 'none',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 2px 4px rgba(68, 0, 153, 0.2)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Laden...' : 'Verversen'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        
        {/* Card 1: Total Cost */}
        <div className="card" style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
          border: '1px solid #f3e8ff',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Totale LLM Kosten
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(68, 0, 153, 0.1)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Coins size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827' }}>
              € {Number(summary.totalCostEur).toLocaleString('nl-NL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              ≈ ${Number(summary.totalCostUsd).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} USD (wisselkoers 0.92)
            </div>
          </div>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#15803d',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '4px'
          }}>
            <CheckCircle2 size={13} />
            Actief bijgehouden via live model pricing
          </div>
        </div>

        {/* Card 2: Total Tokens */}
        <div className="card" style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
          border: '1px solid #dbeafe',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Totaal Tokens Verbruikt
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Cpu size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827' }}>
              {Number(summary.totalTokens).toLocaleString('nl-NL')}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'flex', gap: '8px' }}>
              <span>In: <strong>{Number(summary.totalInputTokens).toLocaleString('nl-NL')}</strong></span>
              <span>•</span>
              <span>Uit: <strong>{Number(summary.totalOutputTokens).toLocaleString('nl-NL')}</strong></span>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>
            Gem. input/output verhouding: {(summary.totalOutputTokens > 0 ? (summary.totalInputTokens / summary.totalOutputTokens).toFixed(1) : 1)}:1
          </div>
        </div>

        {/* Card 3: Total Requests */}
        <div className="card" style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
          border: '1px solid #dcfce7',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              API Verzoeken
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827' }}>
              {summary.totalRequests}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {summary.successfulRequests} succesvol • {summary.fallbackRequests} fallback • {summary.failedRequests} fout
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
            {summary.totalRequests > 0 ? Math.round((summary.successfulRequests / summary.totalRequests) * 100) : 100}% succesratio
          </div>
        </div>

        {/* Card 4: Average Cost per Request */}
        <div className="card" style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
          border: '1px solid #fef3c7',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Gem. per Aanroep
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827' }}>
              € {Number(summary.avgCostPerRequestEur).toLocaleString('nl-NL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              Kosten per individuele prompt scan
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
            ⚡ Lage kosten door RAG & Gemini Flash integratie
          </div>
        </div>

      </div>

      {/* Section: Breakdown per LLM Engine */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827', margin: 0 }}>
              Kosten per LLM Engine
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, marginTop: '2px' }}>
              Overzicht van kosten, verbruikte tokens en officiële tarieven per aangesloten AI model.
            </p>
          </div>
        </div>

        {/* Engine Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {byEngine.map(eng => {
            const isTopSpender = eng.percentage >= 30;

            return (
              <div key={eng.engine} className="card" style={{
                padding: '20px',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                position: 'relative',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}>
                {/* Engine Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: eng.color
                    }} />
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                        {eng.name}
                      </h4>
                      <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {eng.models.join(', ')}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: eng.isActive ? '#dcfce7' : '#f3f4f6',
                    color: eng.isActive ? '#15803d' : '#6b7280'
                  }}>
                    {eng.isActive ? 'Actief' : 'Stand-by'}
                  </span>
                </div>

                {/* Cost Amount */}
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>Totale Kosten</span>
                    <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827' }}>
                      € {Number(eng.costEur).toLocaleString('nl-NL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: eng.color }}>
                      {eng.percentage}%
                    </span>
                    <span style={{ fontSize: '10px', color: '#9ca3af', display: 'block' }}>van totaal</span>
                  </div>
                </div>

                {/* Progress bar share */}
                <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(0, eng.percentage))}%`,
                    height: '100%',
                    backgroundColor: eng.color,
                    borderRadius: '3px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>

                {/* Stats breakdown */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  fontSize: '11px',
                  color: '#4b5563',
                  paddingTop: '4px'
                }}>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block' }}>Verzoeken:</span>
                    <strong>{eng.requests} calls</strong>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block' }}>Tokens Totaal:</span>
                    <strong>{Number(eng.totalTokens).toLocaleString('nl-NL')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block' }}>Prompt Tokens:</span>
                    <span>{Number(eng.inputTokens).toLocaleString('nl-NL')}</span>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block' }}>Output Tokens:</span>
                    <span>{Number(eng.outputTokens).toLocaleString('nl-NL')}</span>
                  </div>
                </div>

                {/* Pricing label */}
                <div style={{
                  borderTop: '1px solid #f3f4f6',
                  paddingTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '10px',
                  color: '#6b7280'
                }}>
                  <span>Tarief:</span>
                  <span style={{ fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>
                    {eng.pricingLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Cost Distribution & Trends Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px'
      }}>
        
        {/* Cost Distribution Bar */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--brand-primary)' }} />
            Budget Verdeling per Model
          </h4>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
            Proportionele verdeling van het totale LLM budget over de verschillende providers.
          </p>

          {/* Stacked bar */}
          <div style={{
            width: '100%',
            height: '24px',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            backgroundColor: '#f3f4f6',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {byEngine.filter(e => e.costEur > 0).map(e => (
              <div
                key={e.engine}
                title={`${e.name}: €${e.costEur} (${e.percentage}%)`}
                style={{
                  width: `${e.percentage}%`,
                  height: '100%',
                  backgroundColor: e.color,
                  transition: 'width 0.4s ease'
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
            {byEngine.map(e => (
              <div key={e.engine} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#4b5563' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: e.color }} />
                <span>{e.shortName}: <strong>{e.percentage}%</strong> (€{Number(e.costEur).toFixed(3)})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Project Breakdown */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExternalLink size={16} style={{ color: 'var(--brand-primary)' }} />
            Kosten per Project / Workspace
          </h4>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
            Inzicht in welke klantomgeving of project de meeste AI aanroepen genereert.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px' }}>Project / Bedrijf</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Aanroepen</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Tokens</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Kosten (€)</th>
                </tr>
              </thead>
              <tbody>
                {byProject.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>
                      Nog geen project-gebonden kosten geregistreerd.
                    </td>
                  </tr>
                ) : (
                  byProject.map((proj, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 700, color: '#111827' }}>
                        {proj.company}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', color: '#4b5563' }}>
                        {proj.requests}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', color: '#4b5563', fontFamily: 'monospace' }}>
                        {Number(proj.tokens).toLocaleString('nl-NL')}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--brand-primary)' }}>
                        € {Number(proj.costEur).toFixed(4)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Daily Trends 14-day Chart */}
      {dailyTrends.length > 0 && (
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Kostenverloop (Afgelopen 14 Dagen)
              </h4>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, marginTop: '2px' }}>
                Dagelijkse uitgaven per LLM provider in Euro's.
              </p>
            </div>
          </div>

          {/* Timeline Bar Chart */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            height: '140px',
            paddingTop: '20px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            {dailyTrends.map((day, idx) => {
              const maxCost = Math.max(...dailyTrends.map(d => d.costEur), 0.05);
              const heightPct = Math.min(100, Math.max(6, (day.costEur / maxCost) * 100));

              return (
                <div key={idx} style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end'
                }}>
                  {day.costEur > 0 && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '4px' }}>
                      €{day.costEur.toFixed(3)}
                    </span>
                  )}
                  <div
                    title={`${day.label}: €${day.costEur} (${day.requests} calls)`}
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${heightPct}%`,
                      backgroundColor: day.costEur > 0 ? 'var(--brand-primary)' : '#e5e7eb',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '6px', whiteSpace: 'nowrap' }}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Transaction / API Usage Log Table */}
      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
              Live API Transacties & Kostenlogboek
            </h4>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, marginTop: '2px' }}>
              Volledig audittrail van individuele model calls, tokenaantallen en berekende kosten.
            </p>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Engine filter pills */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {['all', 'openai', 'gemini', 'perplexity', 'anthropic'].map(engKey => (
                <button
                  key={engKey}
                  onClick={() => setSelectedEngineFilter(engKey)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: selectedEngineFilter === engKey ? 700 : 500,
                    backgroundColor: selectedEngineFilter === engKey ? 'var(--brand-primary)' : '#f3f4f6',
                    color: selectedEngineFilter === engKey ? 'white' : '#4b5563',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {engKey === 'all' ? 'Alle' : engKey.charAt(0).toUpperCase() + engKey.slice(1)}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Zoeken in logs..."
                value={searchLogQuery}
                onChange={e => setSearchLogQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 1 }}>
              <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px' }}>Tijdstip</th>
                <th style={{ padding: '10px 8px' }}>Engine / Model</th>
                <th style={{ padding: '10px 8px' }}>Project</th>
                <th style={{ padding: '10px 8px' }}>Operatie</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Tokens (In / Uit)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Kosten (€)</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Latency</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                    Geen logs gevonden die overeenkomen met de filtercriteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  let badgeBg = '#dcfce7';
                  let badgeColor = '#15803d';
                  if (log.status === 'ERROR') {
                    badgeBg = '#fee2e2';
                    badgeColor = '#dc2626';
                  } else if (log.status === 'FALLBACK') {
                    badgeBg = '#fef9c3';
                    badgeColor = '#ca8a04';
                  }

                  return (
                    <tr 
                      key={log.id} 
                      style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '8px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {log.timeAgo}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>
                          {log.engine}
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                          {log.model}
                        </div>
                      </td>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#374151' }}>
                        {log.projectName || '-'}
                      </td>
                      <td style={{ padding: '8px', color: '#4b5563', fontSize: '11px' }}>
                        {log.operation}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        <span style={{ color: '#111827', fontWeight: 700 }}>{Number(log.totalTokens).toLocaleString('nl-NL')}</span>
                        <span style={{ fontSize: '10px', color: '#9ca3af', display: 'block' }}>
                          ({log.inputTokens} in / {log.outputTokens} uit)
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: log.costEur > 0 ? 'var(--brand-primary)' : '#9ca3af' }}>
                        € {Number(log.costEur).toFixed(5)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#6b7280', fontSize: '11px' }}>
                        {log.latency}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: badgeBg,
                          color: badgeColor
                        }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
