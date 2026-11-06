import React, { useState, useEffect } from 'react';
import {
  Coins, Receipt, Cpu, Activity, TrendingUp, RefreshCw,
  Download, Search, CheckCircle2, Layers, Plus, X, CreditCard
} from 'lucide-react';

export default function LlmCosts({
  activeWorkspace,
  clients = [],
  currentUser,
  enabledEngines,
  onSelectWorkspace
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('all');
  const [selectedProject, setSelectedProject] = useState(activeWorkspace || 'all');
  const [selectedEngineFilter, setSelectedEngineFilter] = useState('all');
  const [searchLogQuery, setSearchLogQuery] = useState('');

  // Synchronize when activeWorkspace changes externally
  useEffect(() => {
    setSelectedProject(activeWorkspace || 'all');
  }, [activeWorkspace]);

  // Modal state for manual invoice / payment entry
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [syncingStudio, setSyncingStudio] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    engine: 'gemini',
    amount_eur: '25.00',
    description: 'Automatische betaling Google AI Studio (Mastercard ••••3171)',
    invoice_ref: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const formatEur = (val) => {
    const num = typeof val === 'number' ? val : parseFloat(val || 0);
    return '€ ' + num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUsd = (val) => {
    const num = typeof val === 'number' ? val : parseFloat(val || 0);
    return '$ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fetchCostData = async (selectedPeriod = period, projectToFetch = selectedProject) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period', selectedPeriod);
      if (projectToFetch && projectToFetch !== 'all') {
        params.append('company', projectToFetch);
      }
      if (currentUser?.role) {
        params.append('role', currentUser.role);
      }
      if (currentUser?.id) {
        params.append('userId', currentUser.id);
      }

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
    fetchCostData(period, selectedProject);
  }, [period, selectedProject]);

  const handleProjectFilterChange = (newProject) => {
    setSelectedProject(newProject);
    if (onSelectWorkspace) {
      onSelectWorkspace(newProject === 'all' ? null : newProject);
    }
  };

  const handleSyncAiStudio = async () => {
    setSyncingStudio(true);
    try {
      const res = await fetch('/api/llm-costs/sync-ai-studio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
      const json = await res.json();
      if (json.success) {
        await fetchCostData(period);
      }
    } catch (err) {
      console.error('Fout bij synchroniseren Google AI Studio:', err);
    } finally {
      setSyncingStudio(false);
    }
  };

  const handleStoreInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceForm.amount_eur || parseFloat(invoiceForm.amount_eur) <= 0) return;

    setInvoiceSubmitting(true);
    try {
      const res = await fetch('/api/llm-costs/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          engine: invoiceForm.engine,
          amount_eur: parseFloat(invoiceForm.amount_eur),
          description: invoiceForm.description,
          invoice_ref: invoiceForm.invoice_ref || null,
          date: invoiceForm.date || null,
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowInvoiceModal(false);
        setInvoiceForm({
          engine: 'gemini',
          amount_eur: '25.00',
          description: 'Automatische betaling Google AI Studio (Mastercard ••••3171)',
          invoice_ref: '',
          date: new Date().toISOString().slice(0, 10),
        });
        await fetchCostData(period);
      }
    } catch (err) {
      console.error('Fout bij toevoegen factuur:', err);
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    if (!data?.recentLogs || data.recentLogs.length === 0) return;

    const headers = ['ID', 'Tijdstip', 'Engine', 'Model', 'Project', 'Operatie', 'Factuur Referentie', 'Input Tokens', 'Output Tokens', 'Totaal Tokens', 'Kosten EUR', 'Kosten USD', 'Latency', 'Status'];
    const rows = data.recentLogs.map(l => [
      l.id,
      `"${l.timestamp || ''}"`,
      `"${l.engineLabel || l.engine}"`,
      `"${l.model}"`,
      `"${l.projectName || ''}"`,
      `"${l.operation}"`,
      `"${l.invoiceRef || ''}"`,
      l.inputTokens,
      l.outputTokens,
      l.totalTokens,
      Number(l.costEur).toFixed(2),
      Number(l.costUsd).toFixed(2),
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
    avgCostPerRequestEur: 0,
  };

  const byEngine = data?.byEngine || [];
  const byProject = data?.byProject || [];
  const recentLogs = data?.recentLogs || [];

  const filteredLogs = recentLogs.filter(log => {
    const matchesEngine = selectedEngineFilter === 'all' ||
      log.engine === selectedEngineFilter ||
      (selectedEngineFilter === 'gemini' && (log.engine === 'gemini' || log.engineLabel === 'Google AI Studio'));

    const matchesSearch = !searchLogQuery ||
      log.engine.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      (log.engineLabel && log.engineLabel.toLowerCase().includes(searchLogQuery.toLowerCase())) ||
      log.model.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      (log.projectName && log.projectName.toLowerCase().includes(searchLogQuery.toLowerCase())) ||
      (log.invoiceRef && log.invoiceRef.toLowerCase().includes(searchLogQuery.toLowerCase())) ||
      log.operation.toLowerCase().includes(searchLogQuery.toLowerCase());
    return matchesEngine && matchesSearch;
  });

  const clientOptions = React.useMemo(() => {
    const map = new Map();
    (clients || []).forEach(c => {
      const name = c.company || c.name;
      if (name) map.set(name.toLowerCase(), name);
    });
    (byProject || []).forEach(p => {
      if (p.company && p.company !== 'Algemeen / Systeem' && !map.has(p.company.toLowerCase())) {
        map.set(p.company.toLowerCase(), p.company);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [clients, byProject]);

  if (currentUser?.role === 'klant') {
    return (
      <div style={{
        padding: '60px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '12px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <X size={24} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
          Geen toegang
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary, #475569)', maxWidth: '420px', lineHeight: 1.5 }}>
          Inkoop- en LLM-kosten zijn vertrouwelijk en uitsluitend inzichtelijk voor medewerkers en beheerders.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: '#ffffff', minHeight: '100%' }}>

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
            <h2 style={{ fontSize: '24px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              LLM Kosten & Verbruik
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '12px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🔒 Alleen Admin
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary, #475569)', fontSize: '13px', marginTop: '4px', margin: 0 }}>
            {selectedProject === 'all'
              ? 'Totaaloverzicht van alle API-inkoopkosten, tokenverbruik en facturen over alle projecten heen.'
              : `Gefilterd overzicht van API-kosten en tokenverbruik voor project "${selectedProject}".`}
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

          {/* Project Filter Select */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-app, #f8fafc)',
            padding: '3px 8px',
            borderRadius: '8px',
            border: '1px solid var(--border-medium, #e2e8f0)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Project:
            </span>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-medium, #e2e8f0)',
                backgroundColor: selectedProject === 'all' ? 'var(--brand-primary, #440099)' : '#ffffff',
                color: selectedProject === 'all' ? '#ffffff' : 'var(--text-primary, #0f172a)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                🌐 Alle Projecten (Totale Kosten)
              </option>
              {clientOptions.map((comp) => (
                <option key={comp} value={comp} style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                  📁 {comp}
                </option>
              ))}
            </select>
          </div>

          {/* Period selector */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-app, #f8fafc)',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid var(--border-medium, #e2e8f0)'
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
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: period === item.id ? 700 : 500,
                  backgroundColor: period === item.id ? '#ffffff' : 'transparent',
                  color: period === item.id ? 'var(--brand-primary, #440099)' : 'var(--text-secondary, #475569)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: period === item.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSyncAiStudio}
            disabled={syncingStudio}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-medium, #e2e8f0)',
              color: 'var(--text-primary, #0f172a)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: syncingStudio ? 'wait' : 'pointer'
            }}
          >
            <RefreshCw size={13} className={syncingStudio ? 'animate-spin' : ''} />
            {syncingStudio ? 'Syncing...' : 'AI Studio Sync'}
          </button>

          <button
            onClick={() => setShowInvoiceModal(true)}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--brand-light-border, #e8d9ff)',
              color: 'var(--brand-primary, #440099)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Plus size={13} />
            Factuur
          </button>

          <button
            onClick={handleExportCsv}
            disabled={recentLogs.length === 0}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-medium, #e2e8f0)',
              color: 'var(--text-primary, #0f172a)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: recentLogs.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={13} />
            CSV
          </button>

          <button
            onClick={() => fetchCostData(period, selectedProject)}
            disabled={loading}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--brand-primary, #440099)',
              border: 'none',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'wait' : 'pointer'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Laden...' : 'Verversen'}
          </button>
        </div>
      </div>

      {/* Active Scope Banner */}
      <div style={{
        padding: '12px 18px',
        borderRadius: '10px',
        backgroundColor: selectedProject === 'all' ? '#f5f0ff' : '#eff6ff',
        border: selectedProject === 'all' ? '1px solid #d8b4fe' : '1px solid #bfdbfe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: selectedProject === 'all' ? 'var(--brand-primary, #440099)' : '#2563eb',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 800
          }}>
            {selectedProject === 'all' ? 'Σ' : '📁'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: selectedProject === 'all' ? 'var(--brand-primary, #440099)' : '#1e40af' }}>
              {selectedProject === 'all'
                ? 'Totale LLM Inkoopkosten — Alle projecten gecombineerd'
                : `Gefilterd op project: ${selectedProject}`}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #475569)' }}>
              {selectedProject === 'all'
                ? `Inclusief alle ${clientOptions.length} projecten, directe facturen en live API-scans.`
                : 'U bekijkt uitsluitend de API-aanroepen en tokens voor dit specifieke project.'}
            </div>
          </div>
        </div>

        {selectedProject !== 'all' ? (
          <button
            onClick={() => handleProjectFilterChange('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #93c5fd',
              backgroundColor: '#ffffff',
              color: '#1d4ed8',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Bekijk Totale Kosten (Alle Projecten)
          </button>
        ) : (
          <span style={{ fontSize: '11px', color: '#6b21a8', fontWeight: 600 }}>
            Tip: Klik in de tabel "Kosten per Project" op een project om direct in te zoomen.
          </span>
        )}
      </div>

      {/* KPI Cards Grid (Eenvoudig, wit, zonder felle gradiënten) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>

        {/* Card 1: Total Cost */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: 'var(--border-radius-md, 10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
            {selectedProject === 'all' ? 'Totale LLM Kosten (Alle Projecten)' : `LLM Kosten (${selectedProject})`}
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)' }}>
            {formatEur(summary.totalCostEur)}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            ≈ {formatUsd(summary.totalCostUsd)}
          </span>
        </div>

        {/* Card 2: Total Tokens */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: 'var(--border-radius-md, 10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
            Totaal Tokens
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)' }}>
            {Number(summary.totalTokens).toLocaleString('nl-NL')}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            {Number(summary.totalInputTokens).toLocaleString('nl-NL')} in / {Number(summary.totalOutputTokens).toLocaleString('nl-NL')} uit
          </span>
        </div>

        {/* Card 3: Total Requests */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: 'var(--border-radius-md, 10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
            Transacties / Aanroepen
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)' }}>
            {summary.totalRequests}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            {summary.successfulRequests} succesvol verwerkt
          </span>
        </div>

        {/* Card 4: Average Cost */}
        <div style={{
          padding: '18px 20px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: 'var(--border-radius-md, 10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
            Gem. per Post
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)' }}>
            {formatEur(summary.avgCostPerRequestEur)}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            Automatische drempelbedragen (€ 25,00)
          </span>
        </div>

      </div>

      {/* Rustige uitsplitsing: Provider Verdeling & Projecten */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>

        {/* Providers Overzicht */}
        <div style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: 'var(--border-radius-md, 10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #0f172a)', fontFamily: "'Outfit', sans-serif" }}>
              Kosten per Provider
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {byEngine.map(eng => {
              const isStudio = eng.isAiStudio || eng.engine === 'gemini';
              return (
                <div key={eng.engine} style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  backgroundColor: 'var(--bg-app, #f8fafc)',
                  border: '1px solid var(--border-light, #f1f5f9)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                      {eng.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                      {Number(eng.totalTokens).toLocaleString('nl-NL')} tokens • {eng.requests} posten
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                      {formatEur(eng.costEur)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                      {eng.percentage}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Projecten Overzicht */}
        <div style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: 'var(--border-radius-md, 10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #0f172a)', fontFamily: "'Outfit', sans-serif" }}>
              Kosten per Project
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
              Klik op een project om in te zoomen
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium, #e2e8f0)', color: 'var(--text-muted, #94a3b8)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Project</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600 }}>Posten</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>Tokens</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>Kosten</th>
                </tr>
              </thead>
              <tbody>
                {byProject.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                      Geen project-gebonden kosten geregistreerd.
                    </td>
                  </tr>
                ) : (
                  byProject.map((proj, idx) => {
                    const isSelected = selectedProject.toLowerCase() === (proj.company || '').toLowerCase();
                    return (
                      <tr
                        key={idx}
                        onClick={() => handleProjectFilterChange(proj.company)}
                        style={{
                          borderBottom: '1px solid var(--border-light, #f1f5f9)',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(68, 0, 153, 0.05)' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-app, #f8fafc)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title={`Filter alle weergaven op ${proj.company}`}
                      >
                        <td style={{ padding: '10px 4px', fontWeight: 600, color: isSelected ? 'var(--brand-primary, #440099)' : 'var(--text-primary, #0f172a)' }}>
                          {isSelected ? '▶ ' : ''}📁 {proj.company}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', color: 'var(--text-secondary, #475569)' }}>
                          {proj.requests}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--text-secondary, #475569)', fontFamily: 'monospace' }}>
                          {Number(proj.tokens).toLocaleString('nl-NL')}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                          {formatEur(proj.costEur)}
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

      {/* Logboek Tabel (Strak, overzichtelijk) */}
      <div style={{
        padding: '20px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-medium, #e2e8f0)',
        borderRadius: 'var(--border-radius-md, 10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary, #0f172a)', fontFamily: "'Outfit', sans-serif" }}>
              Transactielogboek
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', margin: '2px 0 0 0' }}>
              Overzicht van afschrijvingen en API-calls
            </p>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'all', label: 'Alle' },
                { id: 'gemini', label: 'Google AI Studio' },
                { id: 'openai', label: 'ChatGPT' },
                { id: 'perplexity', label: 'Perplexity' }
              ].map(eng => (
                <button
                  key={eng.id}
                  onClick={() => setSelectedEngineFilter(eng.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: selectedEngineFilter === eng.id ? 700 : 500,
                    backgroundColor: selectedEngineFilter === eng.id ? 'var(--brand-primary, #440099)' : 'var(--bg-app, #f8fafc)',
                    color: selectedEngineFilter === eng.id ? '#ffffff' : 'var(--text-secondary, #475569)',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    cursor: 'pointer'
                  }}
                >
                  {eng.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted, #94a3b8)' }} />
              <input
                type="text"
                placeholder="Zoeken..."
                value={searchLogQuery}
                onChange={e => setSearchLogQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 28px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--border-medium, #e2e8f0)', color: 'var(--text-muted, #94a3b8)', textAlign: 'left' }}>
                <th style={{ padding: '8px', fontWeight: 600 }}>Datum</th>
                <th style={{ padding: '8px', fontWeight: 600 }}>Provider</th>
                <th style={{ padding: '8px', fontWeight: 600 }}>Referentie</th>
                <th style={{ padding: '8px', fontWeight: 600 }}>Project</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>Tokens</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>Bedrag</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                    Geen logs gevonden.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isAiStudio = log.engine === 'gemini' || log.engineLabel === 'Google AI Studio';

                  return (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}
                    >
                      <td style={{ padding: '9px 8px', color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                        {log.timestamp ? log.timestamp.slice(0, 10) : ''}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                        {log.engineLabel || (isAiStudio ? 'Google AI Studio' : log.engine)}
                      </td>
                      <td style={{ padding: '9px 8px', color: 'var(--text-secondary, #475569)', fontFamily: 'monospace', fontSize: '11px' }}>
                        {log.invoiceRef || log.operation}
                      </td>
                      <td style={{ padding: '9px 8px', color: 'var(--text-secondary, #475569)' }}>
                        {log.projectName || '-'}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary, #475569)' }}>
                        {Number(log.totalTokens).toLocaleString('nl-NL')}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                        {formatEur(log.costEur)}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'var(--bg-app, #f8fafc)',
                          color: 'var(--text-secondary, #475569)',
                          border: '1px solid var(--border-medium, #e2e8f0)'
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

      {/* Manual Invoice Entry Modal */}
      {showInvoiceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 10, 28, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--border-radius-md, 10px)',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 20px 30px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            border: '1px solid var(--border-medium, #e2e8f0)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-light, #f1f5f9)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                Factuur of Betaling Registreren
              </h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleStoreInvoice} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '4px' }}>
                  Provider / LLM Dienst
                </label>
                <select
                  value={invoiceForm.engine}
                  onChange={e => setInvoiceForm({ ...invoiceForm, engine: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="gemini">Google AI Studio (Gemini Flash & Grounding)</option>
                  <option value="openai">OpenAI (ChatGPT 4o)</option>
                  <option value="perplexity">Perplexity AI</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '4px' }}>
                  Bedrag in EUR (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="25.00"
                  value={invoiceForm.amount_eur}
                  onChange={e => setInvoiceForm({ ...invoiceForm, amount_eur: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '4px' }}>
                  Referentie (Optioneel)
                </label>
                <input
                  type="text"
                  placeholder="bv. CLOUD PQQ8PX"
                  value={invoiceForm.invoice_ref}
                  onChange={e => setInvoiceForm({ ...invoiceForm, invoice_ref: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '4px' }}>
                  Omschrijving
                </label>
                <input
                  type="text"
                  required
                  value={invoiceForm.description}
                  onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '4px' }}>
                  Factuurdatum
                </label>
                <input
                  type="date"
                  value={invoiceForm.date}
                  onChange={e => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-secondary, #475569)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={invoiceSubmitting}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--brand-primary, #440099)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: invoiceSubmitting ? 'wait' : 'pointer'
                  }}
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
