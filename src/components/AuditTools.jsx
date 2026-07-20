import React, { useState } from 'react';
import { 
  AlertCircle, CheckCircle, Code, Copy, Info, 
  RefreshCw, Settings, ShieldAlert, Sparkles, Terminal 
} from 'lucide-react';

export default function AuditTools() {
  const [activeSubTab, setActiveSubTab] = useState('schema');
  const [copied, setCopied] = useState(false);

  // Schema builder inputs
  const [bizName, setBizName] = useState('Saleswizard');
  const [bizUrl, setBizUrl] = useState('https://saleswizard.nl');
  const [bizPhone, setBizPhone] = useState('088-5002500');
  const [bizStreet, setBizStreet] = useState('IJsselburcht 3');
  const [bizCity, setBizCity] = useState('Arnhem');
  const [bizPostal, setBizPostal] = useState('6825 BS');

  // Generator schema markup output
  const generatedSchema = `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${bizName}",
  "image": "https://saleswizard.nl/logo.png",
  "@id": "${bizUrl}/#localbusiness",
  "url": "${bizUrl}",
  "telephone": "${bizPhone}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "${bizStreet}",
    "addressLocality": "${bizCity}",
    "postalCode": "${bizPostal}",
    "addressCountry": "NL"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 51.9839,
    "longitude": 5.9554
  },
  "sameAs": [
    "https://www.facebook.com/saleswizard",
    "https://www.linkedin.com/company/saleswizard"
  ]
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Crawl checks items
  const auditChecks = [
    { id: 1, title: 'Robots.txt configuration', desc: 'Allow AI agent user-agents (GPTBot, ClaudeBot, Google-Extended) to crawl answer hub pages.', status: 'Pass' },
    { id: 2, title: 'Schema LocalBusiness Markup', desc: 'Verify presence of detailed LocalBusiness JSON-LD structure.', status: 'Pass' },
    { id: 3, title: 'Q&A Header structures', desc: 'Identify page section headers matching search query prompt layouts.', status: 'Review' },
    { id: 4, title: 'External citation links', desc: 'Find backlinks from authoritative marketing blogs mentioning the brand name.', status: 'Review' },
    { id: 5, title: 'Page indexing speed', desc: 'Check page render times (LCP < 2.5s) to guarantee fast crawler index loops.', status: 'Pass' }
  ];

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>GEO Audit Tools</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
          Technical validation utilities to optimize Saleswizard.nl code structure for search crawlers.
        </p>
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveSubTab('schema')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            color: activeSubTab === 'schema' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'schema' ? '2.5px solid var(--brand-primary)' : '2.5px solid transparent',
            marginBottom: '-12px'
          }}
        >
          JSON-LD Schema Generator
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            color: activeSubTab === 'audit' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'audit' ? '2.5px solid var(--brand-primary)' : '2.5px solid transparent',
            marginBottom: '-12px'
          }}
        >
          AI Crawler Audit
        </button>
      </div>

      {/* Schema Generator content tab */}
      {activeSubTab === 'schema' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }} className="responsive-grid">
          
          {/* Inputs card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={16} /> Business Details
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Business Name</label>
              <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>URL</label>
              <input type="text" value={bizUrl} onChange={(e) => setBizUrl(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Phone Number</label>
              <input type="text" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Street Address</label>
              <input type="text" value={bizStreet} onChange={(e) => setBizStreet(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>City</label>
                <input type="text" value={bizCity} onChange={(e) => setBizCity(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Postal Code</label>
                <input type="text" value={bizPostal} onChange={(e) => setBizPostal(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Generated markup block */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={16} /> JSON-LD Schema Script
              </h3>
              
              <button
                onClick={handleCopy}
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--brand-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--bg-app)'
                }}
              >
                <Copy size={12} />
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            {/* Code output */}
            <div style={{
              flex: 1,
              backgroundColor: '#0f0a1c',
              color: '#d8b4fe',
              padding: '16px',
              borderRadius: '8px',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              lineHeight: '1.5',
              overflowX: 'auto',
              whiteSpace: 'pre',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {generatedSchema}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
              <Info size={14} style={{ color: 'var(--brand-accent)' }} />
              <span>Add this block inside the <code>&lt;head&gt;</code> tags of your website templates.</span>
            </div>
          </div>

        </div>
      )}

      {/* AI Crawler Audit tab */}
      {activeSubTab === 'audit' && (
        <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
          <table className="premium-table">
            <thead>
              <tr>
                <th>Audit Parameter</th>
                <th>Diagnostic description</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {auditChecks.map(check => (
                <tr key={check.id}>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)', width: '220px' }}>
                    {check.title}
                  </td>
                  <td>
                    {check.desc}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {check.status === 'Pass' ? (
                      <span className="badge badge-positive" style={{ gap: '2px' }}>
                        <CheckCircle size={10} /> Passed
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ gap: '2px' }}>
                        <AlertCircle size={10} /> Review Needed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
