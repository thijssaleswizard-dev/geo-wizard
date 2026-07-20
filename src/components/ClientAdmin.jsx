import React, { useState } from 'react';
import { 
  Users, Search, ShieldAlert, CheckCircle, 
  ExternalLink, Sparkles, Filter, Settings, Award 
} from 'lucide-react';

export default function ClientAdmin({ clients, onSelectClient, onUpdateClientPlan }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('All');

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = filterPlan === 'All' || c.subscription === filterPlan;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Client Workspaces Admin</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Beheer alle actieve klantprojecten, wijzig abonnementstiers en inspecteer hun individuele GEO visibility scores.
          </p>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Zoek op klantnaam of bedrijf..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span>Abonnement:</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'AI Starter', 'AI Pro', 'AI Enterprise'].map((planOpt) => (
              <button
                key={planOpt}
                onClick={() => setFilterPlan(planOpt)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: filterPlan === planOpt ? 'var(--brand-primary)' : 'var(--bg-app)',
                  color: filterPlan === planOpt ? 'white' : 'var(--text-secondary)',
                  border: filterPlan === planOpt ? 'none' : '1px solid var(--border-medium)'
                }}
              >
                {planOpt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Client List Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Bedrijf / Domein</th>
              <th>Klantnaam</th>
              <th style={{ width: '180px' }}>Actief GEO Plan</th>
              <th style={{ textAlign: 'center', width: '130px' }}>Gevolgen Prompts</th>
              <th style={{ textAlign: 'center', width: '120px' }}>Visibility Share</th>
              <th style={{ textAlign: 'center', width: '150px' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => {
              // Color helper matching active tier
              const planColor = {
                'AI Starter': '#06b6d4',
                'AI Pro': '#a78bfa',
                'AI Enterprise': '#ec4899'
              }[client.subscription] || 'var(--text-muted)';

              return (
                <tr key={client.company}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: `${planColor}20`,
                        color: planColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '14px'
                      }}>
                        {client.company[0]}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{client.company}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{client.email}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {client.name}
                  </td>
                  <td>
                    <select
                      value={client.subscription}
                      onChange={(e) => onUpdateClientPlan(client.company, e.target.value)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderColor: 'var(--border-medium)',
                        color: planColor,
                        backgroundColor: 'var(--bg-card)'
                      }}
                    >
                      <option value="AI Starter">AI Starter (€195)</option>
                      <option value="AI Pro">AI Pro (€350)</option>
                      <option value="AI Enterprise">AI Enterprise (€750)</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    {client.promptsCount} / {
                      client.subscription === 'AI Starter' ? 15 :
                      client.subscription === 'AI Pro' ? 30 : 100
                    }
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-positive" style={{ fontWeight: 700 }}>
                      {client.visibilityIndex}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => onSelectClient(client.company)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--brand-primary)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
                    >
                      Bekijk Dashboard
                      <ExternalLink size={10} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
