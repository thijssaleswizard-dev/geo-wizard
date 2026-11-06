import React, { useState, useEffect } from 'react';
import {
  Coins, Receipt, Cpu, Activity, TrendingUp, RefreshCw,
  Download, Search, CheckCircle2, Layers, Plus, X, CreditCard, ShieldCheck
} from 'lucide-react';

export default function LlmCosts({ currentUser, enabledEngines }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('all');
  const [selectedEngineFilter, setSelectedEngineFilter] = useState('all');
  const [searchLogQuery, setSearchLogQuery] = useState('');

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

  // Always fetch generic tool-wide costs
  const fetchCostData = async (selectedPeriod = period) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period', selectedPeriod);
      if (currentUser?.role) params.append('role', currentUser.role);
      if (currentUser?.id) params.append('userId', currentUser.id);

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
  }, [period]);

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

    const headers = ['ID', 'Tijdstip', 'Engine', 'Model', 'Bron / Project', 'Operatie', 'Factuur Referentie', 'Input Tokens', 'Output Tokens', 'Totaal Tokens', 'Kosten EUR', 'Kosten USD', 'Latency', 'Status'];
    const rows = data.recentLogs.map(l => [
      l.id,
      `"${l.timestamp || ''}"`,
      `"${l.engineLabel || l.engine}"`,
      `"${l.model}"`,
      `"${l.projectName || 'Generiek / Tool'}"`,
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
    link.setAttribute('download', `llm_kosten_generiek_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restrict access for client accounts
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
              🔒 Generiek Tool Overzicht
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary, #475569)', fontSize: '13px', marginTop: '4px', margin: 0 }}>
            Centraal overzicht van alle API-kosten, tokenverbruik en facturen voor het draaien van de GEO Wizard.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

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
            onClick={() => fetchCostData(period)}
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

      {/* Generic Info Banner */}
      <div style={{
        padding: '14px 20px',
        borderRadius: '10px',
        backgroundColor: '#f5f0ff',
        border: '1px solid #d8b4fe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'var(--brand-primary, #440099)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: 800
          }}>
            Σ
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--brand-primary, #440099)' }}>
              Generiek Tool Kostenoverzicht
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #475569)', marginTop: '2px' }}>
              Dit overzicht toont wat Saleswizard in totaal uitgeeft aan LLM API's en AI platforms voor alle actieve scans. Klanten hebben geen inzage in deze pagina.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-positive" style={{ gap: '4px', fontSize: '11px' }}>
            <ShieldCheck size={12} /> Afgeschermd voor klanten
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
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
            Totale Tool LLM Kosten
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
            Totaal Tokens Verbruikt
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)' }}>
            {Number(summary.totalTokens).toLocaleString('nl-NL')}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            {Number(summary.totalInputTokens).toLocaleString('nl-NL')} in · {Number(summary.totalOutputTokens).toLocaleString('nl-NL')} out
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
            Aanroepen & Transacties
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)' }}>
            {summary.totalRequests}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            {summary.successfulRequests} geslaagd ({summary.totalRequests > 0 ? Math.round((summary.successfulRequests / summary.totalRequests) * 100) : 100}%)
          </span>
        </div>

        {/* Card 4: Avg Cost */}
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
            Gem. Kosten per Scan
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary, #0f172a)' }}>
            {formatEur(summary.avgCostPerRequestEur)}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
            Op basis van {summary.totalRequests} transacties
          </span>
        </div>

      </div>

      {/* Provider Verdeling & Facturatie Status */}
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
              Kosten per AI Provider / Engine
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {byEngine.map(eng => {
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

        {/* Facturatie & Platformstatus Card */}
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
              Facturatie & Platformstatus
            </span>
            <span className="badge badge-positive" style={{ gap: '4px', fontSize: '11px' }}>
              <CheckCircle2 size={12} /> Actief
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--border-radius-sm, 6px)',
              backgroundColor: 'var(--bg-app, #f8fafc)',
              border: '1px solid var(--border-light, #f1f5f9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                  Google AI Studio Billing
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a' }}>
                  Gesynchroniseerd
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #475569)' }}>
                Mastercard ••••3171 — Automatische synchronisatie van creditcard declaraties en facturen.
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--border-radius-sm, 6px)',
              backgroundColor: 'var(--bg-app, #f8fafc)',
              border: '1px solid var(--border-light, #f1f5f9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                  Live API Verbruik
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-primary, #440099)' }}>
                  Pay-as-you-go
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #475569)' }}>
                Directe afrekening op tokenbasis voor OpenAI (gpt-4o), Perplexity (sonar) en Anthropic (claude-sonnet-5-5).
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--border-radius-sm, 6px)',
              backgroundColor: 'rgba(68, 0, 153, 0.03)',
              border: '1px solid var(--brand-light-border, #e8d9ff)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--brand-primary, #440099)', fontWeight: 600 }}>
                Handmatige declaratie of factuur toevoegen?
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--brand-primary, #440099)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                + Factuur invoeren
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Logboek Tabel */}
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
              Overzicht van afschrijvingen en API-aanroepen over de gehele applicatie
            </p>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'all', label: 'Alle' },
                { id: 'gemini', label: 'Google AI Studio' },
                { id: 'openai', label: 'ChatGPT' },
                { id: 'perplexity', label: 'Perplexity' },
                { id: 'anthropic', label: 'Claude' }
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
                <th style={{ padding: '8px', fontWeight: 600 }}>Referentie / Operatie</th>
                <th style={{ padding: '8px', fontWeight: 600 }}>Bron</th>
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
                        {log.projectName || 'Generiek / Tool'}
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
                  placeholder="bijv. Factuur GOOG-2026-09"
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
                  placeholder="bijv. Afschrijving Mastercard Google AI Studio"
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
                  Datum
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-secondary, #475569)',
                    fontSize: '13px',
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
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--brand-primary, #440099)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: invoiceSubmitting ? 'wait' : 'pointer'
                  }}
                >
                  {invoiceSubmitting ? 'Opslaan...' : 'Factuur Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
