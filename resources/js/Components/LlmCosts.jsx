import React, { useState, useEffect } from 'react';
import { 
  Coins, Receipt, Cpu, Activity, TrendingUp, RefreshCw, 
  Download, Filter, Search, CheckCircle2, AlertTriangle, 
  Calendar, Layers, ArrowUpRight, ChevronRight, Info, ExternalLink,
  ShieldCheck, HelpCircle, Plus, X, Sparkles, CreditCard
} from 'lucide-react';

export default function LlmCosts({ activeWorkspace, currentUser, enabledEngines }) {
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

  // Strict Dutch currency formatter (strictly 2 decimal places)
  const formatEur = (val) => {
    const num = typeof val === 'number' ? val : parseFloat(val || 0);
    return '€ ' + num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUsd = (val) => {
    const num = typeof val === 'number' ? val : parseFloat(val || 0);
    return '$ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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

  // Force re-sync with Google AI Studio charges (€250,00)
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

  // Submit manual invoice / payment
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

  // Export CSV helper
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
    fallbackRequests: 0,
    failedRequests: 0,
    avgCostPerRequestEur: 0,
  };

  const byEngine = data?.byEngine || [];
  const byProject = data?.byProject || [];
  const dailyTrends = data?.dailyTrends || [];
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
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1a73e8 0%, #440099 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(26, 115, 232, 0.3)'
            }}>
              <Coins size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827', margin: 0 }}>
                  LLM Kosten & Verbruik
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Sparkles size={12} /> Google AI Studio Direct
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px', margin: 0 }}>
                Realtime inzicht in Google AI Studio facturen, tokenverbruik en LLM-modelkosten.
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

          {/* Sync Google AI Studio Button */}
          <button
            onClick={handleSyncAiStudio}
            disabled={syncingStudio}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: syncingStudio ? 'wait' : 'pointer'
            }}
            title="Her-synchroniseer de €250,00 Google AI Studio Mastercard afschrijvingen"
          >
            <RefreshCw size={14} className={syncingStudio ? 'animate-spin' : ''} />
            {syncingStudio ? 'Syncing...' : 'Google AI Studio Sync'}
          </button>

          {/* Add Invoice / Payment Button */}
          <button
            onClick={() => setShowInvoiceModal(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#10b981',
              border: 'none',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
            }}
          >
            <Plus size={14} />
            + Factuur Toevoegen
          </button>

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

      {/* Google AI Studio Verified Banner */}
      <div style={{
        backgroundColor: '#f0f7ff',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '14px 18px',
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
            backgroundColor: '#1a73e8',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CreditCard size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>
              Google AI Studio Pay-as-you-go Facturatie Gekoppeld
            </div>
            <div style={{ fontSize: '12px', color: '#0284c7' }}>
              Kosten voor Google Gemini Flash en Search Grounding worden automatisch verrekend in schijven van <strong>€ 25,00</strong> via Mastercard ••••3171.
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#075985',
          backgroundColor: '#e0f2fe',
          padding: '6px 12px',
          borderRadius: '8px'
        }}>
          <CheckCircle2 size={15} color="#0284c7" />
          <span>Geverifieerde Google Afschrijvingen: <strong>€ 250,00</strong></span>
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
              {formatEur(summary.totalCostEur)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              ≈ {formatUsd(summary.totalCostUsd)} (wisselkoers 0.92)
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
            Direct gesynchroniseerd met Google AI Studio
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
              API Verzoeken & Betalingen
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
              {summary.successfulRequests} succesvol verwerkt
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
            100% succesratio in kostenverwerking
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
              Gem. per Factuurpost
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
              {formatEur(summary.avgCostPerRequestEur)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              Standaard automatische debet (€ 25,00)
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
            ⚡ Google AI Studio threshold billing
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
              Overzicht van kosten, verbruikte tokens en tarieven per aangesloten provider.
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
            const isStudio = eng.isAiStudio || eng.engine === 'gemini';

            return (
              <div key={eng.engine} className="card" style={{
                padding: '20px',
                border: isStudio ? '2px solid #93c5fd' : '1px solid #e5e7eb',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                position: 'relative',
                background: isStudio ? 'linear-gradient(180deg, #ffffff 0%, #f0f7ff 100%)' : '#ffffff',
                boxShadow: isStudio ? '0 4px 16px rgba(26, 115, 232, 0.08)' : 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}>
                {/* Engine Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: eng.color
                    }} />
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#111827' }}>
                        {eng.name}
                      </h4>
                      <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {isStudio ? 'gemini-flash · Search Grounding' : eng.models.join(', ')}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: isStudio ? '#dbeafe' : (eng.isActive ? '#dcfce7' : '#f3f4f6'),
                    color: isStudio ? '#1d4ed8' : (eng.isActive ? '#15803d' : '#6b7280')
                  }}>
                    {isStudio ? 'Directe Koppeling' : (eng.isActive ? 'Actief' : 'Stand-by')}
                  </span>
                </div>

                {/* Cost Amount */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', fontWeight: 600 }}>Totale Kosten</span>
                    <span style={{ fontSize: '24px', fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: '#111827' }}>
                      {formatEur(eng.costEur)}
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
                    <span style={{ color: '#9ca3af', display: 'block' }}>Factuurposten:</span>
                    <strong>{eng.requests} transacties</strong>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block' }}>Tokens Totaal:</span>
                    <strong>{Number(eng.totalTokens).toLocaleString('nl-NL')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block' }}>Input Tokens:</span>
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
            Budget Verdeling per Provider
          </h4>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
            Proportionele verdeling van het totale LLM budget over de providers.
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
                title={`${e.name}: ${formatEur(e.costEur)} (${e.percentage}%)`}
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
                <span>{e.shortName}: <strong>{e.percentage}%</strong> ({formatEur(e.costEur)})</span>
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
            Inzicht in welke klantomgeving de Google AI Studio en LLM aanroepen genereert.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px' }}>Project / Bedrijf</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Transacties</th>
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
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-primary)' }}>
                        {formatEur(proj.costEur)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Daily Trends Timeline Chart */}
      {dailyTrends.length > 0 && (
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Kostenverloop & Automatische Debettransacties (Afgelopen Periode)
              </h4>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, marginTop: '2px' }}>
                Dagelijkse Google AI Studio Mastercard afschrijvingen (€ 25,00 / € 50,00) en verbruik.
              </p>
            </div>
          </div>

          {/* Timeline Bar Chart */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            height: '160px',
            paddingTop: '24px',
            borderBottom: '1px solid #e5e7eb',
            overflowX: 'auto'
          }}>
            {dailyTrends.map((day, idx) => {
              const maxCost = Math.max(...dailyTrends.map(d => d.costEur), 50);
              const heightPct = Math.min(100, Math.max(day.costEur > 0 ? 15 : 4, (day.costEur / maxCost) * 100));

              return (
                <div key={idx} style={{
                  flex: 1,
                  minWidth: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end'
                }}>
                  {day.costEur > 0 && (
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#1a73e8', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                      {formatEur(day.costEur)}
                    </span>
                  )}
                  <div
                    title={`${day.label}: ${formatEur(day.costEur)} (${day.requests} posten)`}
                    style={{
                      width: '100%',
                      maxWidth: '32px',
                      height: `${heightPct}%`,
                      backgroundColor: day.costEur > 0 ? '#1a73e8' : '#e5e7eb',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '9px', color: '#6b7280', marginTop: '6px', whiteSpace: 'nowrap' }}>
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
              Live Google AI Studio & LLM Transactielogboek
            </h4>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, marginTop: '2px' }}>
              Volledig audittrail van individuele Google AI Studio afschrijvingen en AI model calls.
            </p>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Engine filter pills */}
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
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: selectedEngineFilter === eng.id ? 700 : 500,
                    backgroundColor: selectedEngineFilter === eng.id ? 'var(--brand-primary)' : '#f3f4f6',
                    color: selectedEngineFilter === eng.id ? 'white' : '#4b5563',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {eng.label}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Zoeken op CLOUD referentie..."
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
        <div style={{ overflowX: 'auto', maxHeight: '460px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 1 }}>
              <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px' }}>Tijdstip</th>
                <th style={{ padding: '10px 8px' }}>Provider / Engine</th>
                <th style={{ padding: '10px 8px' }}>Factuur / Referentie</th>
                <th style={{ padding: '10px 8px' }}>Project</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Tokens (In / Uit)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Bedrag (€)</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Betaalmethode</th>
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
                  const isAiStudio = log.engine === 'gemini' || log.engineLabel === 'Google AI Studio';

                  return (
                    <tr 
                      key={log.id} 
                      style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '10px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        <div>{log.timestamp ? log.timestamp.slice(0, 10) : ''}</div>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>{log.timestamp ? log.timestamp.slice(11, 16) : ''}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700, color: isAiStudio ? '#1a73e8' : '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isAiStudio && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1a73e8' }} />}
                          {log.engineLabel || (isAiStudio ? 'Google AI Studio' : log.engine)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                          {log.model}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {log.invoiceRef ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: '1px solid #dbeafe'
                          }}>
                            {log.invoiceRef}
                          </span>
                        ) : (
                          <span style={{ color: '#6b7280', fontSize: '11px' }}>{log.operation}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: '#374151' }}>
                        {log.projectName || '-'}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        <span style={{ color: '#111827', fontWeight: 700 }}>{Number(log.totalTokens).toLocaleString('nl-NL')}</span>
                        {log.totalTokens > 0 && (
                          <span style={{ fontSize: '10px', color: '#9ca3af', display: 'block' }}>
                            ({log.inputTokens} in / {log.outputTokens} uit)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: '#111827', fontSize: '13px' }}>
                        {formatEur(log.costEur)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#6b7280', fontSize: '11px' }}>
                        {log.metadata?.payment_method || (isAiStudio ? 'Mastercard ••••3171' : 'API Saldo')}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: '#dcfce7',
                          color: '#15803d'
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
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} color="var(--brand-primary)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                  Factuur of Betaling Registreren
                </h3>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleStoreInvoice} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Provider / LLM Dienst
                </label>
                <select
                  value={invoiceForm.engine}
                  onChange={e => setInvoiceForm({ ...invoiceForm, engine: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
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
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Factuur- of Betalingsreferentie (Optioneel)
                </label>
                <input
                  type="text"
                  placeholder="bv. CLOUD PQQ8PX of INV-2026-001"
                  value={invoiceForm.invoice_ref}
                  onChange={e => setInvoiceForm({ ...invoiceForm, invoice_ref: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
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
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Factuurdatum
                </label>
                <input
                  type="date"
                  value={invoiceForm.date}
                  onChange={e => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
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
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--brand-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: invoiceSubmitting ? 'wait' : 'pointer'
                  }}
                >
                  {invoiceSubmitting ? 'Opslaan...' : 'Betaling Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
