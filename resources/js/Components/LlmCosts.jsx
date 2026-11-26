import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Download, Search, CheckCircle2, Plus, X,
  ShieldCheck, Wallet, AlertTriangle, Layers, Building2
} from 'lucide-react';

export default function LlmCosts({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [searchLogQuery, setSearchLogQuery] = useState('');

  // Modal state for optional DataForSEO top-up / invoice note
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    amount_eur: '50.00',
    description: 'DataForSEO tegoed opwaardering',
    invoice_ref: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const formatEur = (val, decimals = 2) => {
    const num = typeof val === 'number' ? val : parseFloat(val || 0);
    return '€ ' + num.toLocaleString('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatUsd = (val, decimals = 2) => {
    const num = typeof val === 'number' ? val : parseFloat(val || 0);
    return '$ ' + num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fetchCostData = async (selectedPeriod = period, forceRefresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period', selectedPeriod);
      if (forceRefresh) params.append('refresh', '1');
      if (currentUser?.role) params.append('role', currentUser.role);
      if (currentUser?.id) params.append('userId', String(currentUser.id));

      const res = await fetch(`/api/llm-costs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Fout bij ophalen DataForSEO kosten:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostData(period);
  }, [period]);

  const handleStoreInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceForm.amount_eur || parseFloat(invoiceForm.amount_eur) <= 0) return;

    setInvoiceSubmitting(true);
    try {
      const res = await fetch('/api/llm-costs/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          amount_eur: parseFloat(invoiceForm.amount_eur),
          description: invoiceForm.description,
          invoice_ref: invoiceForm.invoice_ref || null,
          date: invoiceForm.date || null,
          userId: currentUser?.id,
          role: currentUser?.role
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowInvoiceModal(false);
        setInvoiceForm({
          amount_eur: '50.00',
          description: 'DataForSEO tegoed opwaardering',
          invoice_ref: '',
          date: new Date().toISOString().slice(0, 10),
        });
        await fetchCostData(period, true);
      }
    } catch (err) {
      console.error('Fout bij toevoegen DataForSEO factuur:', err);
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    if (!data?.recentLogs || data.recentLogs.length === 0) return;

    const headers = ['ID', 'Tijdstip', 'DataForSEO Kanaal', 'Endpoint', 'Project', 'Latency', 'Kosten EUR', 'Kosten USD', 'Status'];
    const rows = data.recentLogs.map(l => [
      l.id,
      `"${l.timestamp || ''}"`,
      `"${l.engineLabel || l.engine}"`,
      `"${l.endpoint || l.operation}"`,
      `"${l.projectName || 'Algemeen'}"`,
      `"${l.latency || ''}"`,
      Number(l.costEur).toFixed(4),
      Number(l.costUsd).toFixed(4),
      `"${l.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dataforseo_kosten_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (currentUser?.role === 'klant') {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: '#475569' }}>
        Geen toegang. DataForSEO inkoopkosten zijn uitsluitend inzichtelijk voor medewerkers en beheerders.
      </div>
    );
  }

  const summary = data?.summary || {
    totalCostEur: 0,
    totalCostUsd: 0,
    topupCostEur: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgCostPerRequestEur: 0,
    estimatedCostPerPromptEur: 0,
    dataforseo: null,
  };

  const dfsAccount = summary.dataforseo || {};
  const byEngine = data?.byEngine || [];
  const byProject = data?.byProject || [];
  const recentLogs = data?.recentLogs || [];

  const filteredLogs = recentLogs.filter(log => {
    const matchesChannel = selectedChannel === 'all' ||
      log.channel === selectedChannel ||
      (selectedChannel === 'google_aio' && (log.channel === 'aimode' || log.channel === 'aioverviews'));

    const q = searchLogQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      (log.engineLabel || '').toLowerCase().includes(q) ||
      (log.endpoint || '').toLowerCase().includes(q) ||
      (log.projectName || '').toLowerCase().includes(q) ||
      (log.operation || '').toLowerCase().includes(q) ||
      (log.invoiceRef || '').toLowerCase().includes(q);

    return matchesChannel && matchesSearch;
  });

  return (
    <div className="fade-in" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: '#ffffff', minHeight: '100%' }}>

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#0f172a', margin: 0 }}>
              DataForSEO Kosten & Verbruik
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '6px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={13} /> Intern overzicht
            </span>
          </div>
          <p style={{ color: '#475569', fontSize: '13px', margin: '4px 0 0 0' }}>
            Overzicht van het actuele DataForSEO tegoed en exacte kosten per AI-kanaal (ChatGPT, Gemini, AI Mode, AI Overviews, Perplexity, Claude & Google.nl SERP) en per klantproject.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            backgroundColor: '#f8fafc',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            {[
              { id: 'all', label: 'Alles' },
              { id: 'month', label: 'Deze maand' },
              { id: '30d', label: '30 dagen' },
              { id: '7d', label: '7 dagen' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: period === item.id ? 600 : 500,
                  backgroundColor: period === item.id ? '#ffffff' : 'transparent',
                  color: period === item.id ? '#0f172a' : '#64748b',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: period === item.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            style={{
              padding: '7px 13px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            Opwaardering noteren
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={recentLogs.length === 0}
            style={{
              padding: '7px 13px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: recentLogs.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={14} />
            CSV
          </button>

          <button
            type="button"
            onClick={() => fetchCostData(period, true)}
            disabled={loading}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#440099',
              border: 'none',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'wait' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Laden...' : 'Verversen'}
          </button>
        </div>
      </div>

      {dfsAccount?.error && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '13px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          <span>DataForSEO melding: {dfsAccount.error}</span>
        </div>
      )}

      {/* 4 Clean DataForSEO KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Live DataForSEO Prepaid Balance */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              Actueel DataForSEO saldo
            </span>
            <Wallet size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>
            {dfsAccount?.balanceEur != null ? formatEur(dfsAccount.balanceEur) : 'Niet verbonden'}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {dfsAccount?.balanceUsd != null
              ? `${formatUsd(dfsAccount.balanceUsd)} USD · Account: ${dfsAccount.login || 'Actief'}`
              : 'Controleer DATAFORSEO_LOGIN in .env'}
          </span>
        </div>

        {/* Card 2: Total DataForSEO Scan Spend */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            Verbruikte DataForSEO Scan-kosten
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>
            {formatEur(summary.totalCostEur)}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {formatUsd(summary.totalCostUsd)} USD (koers {summary.rateUsdToEur || 0.92})
            {(summary.topupCostEur || 0) > 0 ? ` · Opgewaardeerd: ${formatEur(summary.topupCostEur)}` : ''}
          </span>
        </div>

        {/* Card 3: API Requests & Reliability */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            DataForSEO API-aanroepen
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>
            {Number(summary.totalRequests || 0).toLocaleString('nl-NL')}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            <strong style={{ color: '#16a34a' }}>{summary.successfulRequests || 0} geslaagd</strong>
            {' · '}
            {summary.failedRequests || 0} mislukt (onbelast)
          </span>
        </div>

        {/* Card 4: Avg Cost per Call & Full 6-Engine Prompt */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            Gem. Kosten per Volledige Prompt
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>
            {formatEur(summary.estimatedCostPerPromptEur || 0, 4)}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Gem. {formatEur(summary.avgCostPerRequestEur || 0, 4)} per losse engine-call (6 engines/prompt)
          </span>
        </div>
      </div>

      {/* Side-by-Side Breakdown: 1. Per DataForSEO Channel | 2. Per Client Project */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>

        {/* Panel 1: Per DataForSEO Channel */}
        <div style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Layers size={16} color="#64748b" />
              Kosten per DataForSEO kanaal
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
              Pay-per-request
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {byEngine.map(eng => (
              <div key={eng.engine} style={{
                padding: '11px 14px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #f1f5f9',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                      {eng.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {eng.successRequests} OK{eng.failedRequests > 0 ? ` · ${eng.failedRequests} fout` : ''}
                      {eng.avgCostEur > 0 ? ` · gem. ${formatEur(eng.avgCostEur, 4)}/call` : ''}
                      {eng.avgLatencyMs > 0 ? ` · ${(eng.avgLatencyMs / 1000).toFixed(1)}s` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      {formatEur(eng.costEurExact ?? eng.costEur, (eng.costEurExact && eng.costEurExact < 0.1 && eng.costEurExact > 0) ? 4 : 2)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                      {eng.percentage}%
                    </div>
                  </div>
                </div>
                <div style={{ width: '100%', height: '3px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, eng.percentage || 0)}%`, height: '100%', backgroundColor: '#475569' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Per Client Project */}
        <div style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Building2 size={16} color="#64748b" />
              Verbruik per klantproject
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
              Afgeschermd voor klanten
            </span>
          </div>

          {byProject.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Nog geen DataForSEO scans geregistreerd in deze periode.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
              {byProject.map((proj, idx) => (
                <div key={proj.projectId || `gen_${idx}`} style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {proj.company}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {proj.successRequests} geslaagde engine-calls
                      {proj.promptsScanned > 0 ? ` · ${proj.promptsScanned} unieke prompt(s)` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      {formatEur(proj.costEurExact ?? proj.costEur, (proj.costEurExact && proj.costEurExact < 0.1 && proj.costEurExact > 0) ? 4 : 2)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      {proj.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DataForSEO Transaction Log Table */}
      <div style={{
        padding: '20px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
              DataForSEO Transactielogboek
            </span>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Exacte afschrijvingen per DataForSEO API-call (laatste 100 aanroepen)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'Alle' },
                { id: 'chatgpt', label: 'ChatGPT Web' },
                { id: 'gemini', label: 'Gemini Web' },
                { id: 'google_aio', label: 'AI Mode & AIO' },
                { id: 'perplexity', label: 'Perplexity' },
                { id: 'claude', label: 'Claude' },
                { id: 'serp', label: 'Google SERP' }
              ].map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChannel(ch.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: selectedChannel === ch.id ? 600 : 500,
                    backgroundColor: selectedChannel === ch.id ? '#0f172a' : '#f8fafc',
                    color: selectedChannel === ch.id ? '#ffffff' : '#475569',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer'
                  }}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '210px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Filter project of endpoint..."
                value={searchLogQuery}
                onChange={e => setSearchLogQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 28px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '8px', fontWeight: 700 }}>Datum & Tijd</th>
                <th style={{ padding: '8px', fontWeight: 700 }}>DataForSEO Kanaal</th>
                <th style={{ padding: '8px', fontWeight: 700 }}>Endpoint / Operatie</th>
                <th style={{ padding: '8px', fontWeight: 700 }}>Project</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>Duur</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>Kosten</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '28px', textAlign: 'center', color: '#94a3b8' }}>
                    Geen DataForSEO transacties gevonden voor deze selectie.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isSuccess = log.status === 'SUCCESS';
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 8px', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {log.timestamp ? log.timestamp.slice(0, 16) : ''}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: '#0f172a' }}>
                        {log.engineLabel}
                      </td>
                      <td style={{ padding: '9px 8px', color: '#475569', fontFamily: 'monospace', fontSize: '11px' }} title={log.error || ''}>
                        {log.invoiceRef ? `${log.invoiceRef} · ${log.endpoint}` : log.endpoint}
                      </td>
                      <td style={{ padding: '9px 8px', color: '#334155', fontWeight: 600 }}>
                        {log.projectName}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                        {log.latency}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {formatEur(log.costEur, 4)}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          color: isSuccess ? '#334155' : '#b91c1c'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isSuccess ? '#47ca9b' : '#ef4444'
                          }} />
                          {isSuccess ? 'OK' : 'Fout'}
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

      {/* DataForSEO Top-up / Invoice Modal */}
      {showInvoiceModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 20px 30px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                DataForSEO Opwaardering / Factuur Noteren
              </h3>
              <button type="button" onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleStoreInvoice} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Bedrag in EUR (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="50.00"
                  value={invoiceForm.amount_eur}
                  onChange={e => setInvoiceForm({ ...invoiceForm, amount_eur: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Factuurnummer / Referentie (optioneel)
                </label>
                <input
                  type="text"
                  placeholder="bijv. DFS-2026-11"
                  value={invoiceForm.invoice_ref}
                  onChange={e => setInvoiceForm({ ...invoiceForm, invoice_ref: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Omschrijving
                </label>
                <input
                  type="text"
                  required
                  placeholder="DataForSEO tegoed opwaardering"
                  value={invoiceForm.description}
                  onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Datum
                </label>
                <input
                  type="date"
                  value={invoiceForm.date}
                  onChange={e => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={invoiceSubmitting}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#440099', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: invoiceSubmitting ? 'wait' : 'pointer' }}
                >
                  {invoiceSubmitting ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
