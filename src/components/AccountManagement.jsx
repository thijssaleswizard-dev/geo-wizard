import React, { useState, useEffect } from 'react';
import { Award, Check, Sparkles, Zap, ShieldCheck, HelpCircle, FileText, Download, Loader2 } from 'lucide-react';

export default function AccountManagement({ currentUser, onUpdateSubscription, onUpdateAddonPrompts }) {
  const plans = [
    {
      id: 'AI Starter',
      name: 'AI/GEO Starter',
      price: 195,
      setup: '750',
      promptsLimit: 15,
      features: [
        'Nulmeting AI-zichtbaarheid',
        'AI strategie',
        'Monitoring 15 prompts',
        '1 paginaoptimalisatie p/m',
        'AI Zichtbaarheidsrapport',
        '1 backlink p/m',
        'Max 1,5 uur support p/m',
        'Jaarlijkse evaluatie'
      ],
      color: '#06b6d4', // Cyan
      badge: 'Instap'
    },
    {
      id: 'AI Pro',
      name: 'AI/GEO Pro',
      price: 350,
      setup: '750',
      promptsLimit: 30,
      features: [
        'Nulmeting AI-zichtbaarheid',
        'AI strategie',
        'Monitoring 30 prompts',
        '1 paginaoptimalisatie p/m',
        '1 FAQ sectie p/m',
        '1 post/pagina extra p/m',
        'AI Zichtbaarheidsrapport',
        '2 backlinks p/m',
        'Max 4 uur support p/m',
        'Halfjaarlijkse evaluatie'
      ],
      color: '#440099', // Saleswizard Purple
      badge: 'Populair',
      popular: true
    },
    {
      id: 'AI Enterprise',
      name: 'AI/GEO Top',
      price: 700,
      setup: '750',
      promptsLimit: 60,
      features: [
        'Nulmeting AI-zichtbaarheid',
        'AI strategie',
        'Monitoring 60 prompts',
        '2 paginaoptimalisaties p/m',
        '2 FAQ sectie p/m',
        '2 posts/pagina\'s p/m',
        'AI Zichtbaarheidsrapport',
        '4 backlinks p/m',
        'Max 8 uur support p/m',
        'Kwartaalevaluatie'
      ],
      color: '#ec4899', // Pink
      badge: 'Maatwerk'
    }
  ];

  // Add-on options database
  const addons = [
    { count: 0, price: 0, label: 'Geen extra prompts' },
    { count: 10, price: 15, label: '+10 Extra Prompts' },
    { count: 20, price: 30, label: '+20 Extra Prompts' },
    { count: 30, price: 45, label: '+30 Extra Prompts' },
    { count: 40, price: 60, label: '+40 Extra Prompts' },
    { count: 50, price: 75, label: '+50 Extra Prompts' }
  ];

  const currentPlan = plans.find(p => p.id === currentUser.subscription) || plans[0];
  const currentAddonPrompts = currentUser.addonPrompts || 0;
  const currentAddon = addons.find(a => a.count === currentAddonPrompts) || addons[0];

  const basePrice = currentPlan.price;
  const addonPrice = currentAddon.price;
  const totalPrice = basePrice + addonPrice;
  const totalLimit = currentPlan.promptsLimit + currentAddonPrompts;

  // Invoices state & fetching
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  useEffect(() => {
    fetch(`/api/payments/invoices?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.invoices) {
          setInvoices(data.invoices);
        }
        setLoadingInvoices(false);
      })
      .catch(err => {
        console.error('Error fetching invoices:', err);
        setLoadingInvoices(false);
      });
  }, [currentUser.id]);

  const handleSelectAddon = (count) => {
    if (onUpdateAddonPrompts) {
      onUpdateAddonPrompts(count);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Account & Abonnement</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
          Beheer uw bedrijfsinformatie, wijzig uw GEO abonnement en voeg extra prompts trackingcapaciteit toe.
        </p>
      </div>

      {/* Account Details Box */}
      <div className="card responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Bedrijfsgegevens</h3>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>Organisatie:</strong> {currentUser.company}</div>
            <div><strong>E-mailadres:</strong> {currentUser.email}</div>
            <div><strong>Gebruiker:</strong> {currentUser.name}</div>
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '24px' }} className="no-border-mobile">
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Actief Abonnement & Limieten</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--brand-primary)',
              fontFamily: "'Outfit', sans-serif"
            }}>
              {currentUser.subscription}
            </span>
            {currentAddonPrompts > 0 && (
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-accent)' }}>
                (+{currentAddonPrompts} Extra Prompts)
              </span>
            )}
            <span className="badge badge-positive" style={{ gap: '2px' }}>
              <ShieldCheck size={10} /> Actief
            </span>
          </div>

          <div style={{ display: 'flex', gap: '24px', marginTop: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Prompts Limiet:</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {totalLimit} prompts
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Maandelijkse kosten:</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                €{totalPrice},- / mnd
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extra Prompts Add-on Bundles Selection */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--brand-light-border)' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'Outfit', sans-serif" }}>
            <Sparkles size={16} style={{ color: 'var(--brand-primary)' }} />
            Extra Prompts Tracking Bundels (Add-on)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
            Heeft u meer prompts nodig dan in uw basisabonnement is inbegrepen? Voeg flexibel extra capaciteit toe voor **€1,50 per prompt per maand**.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '6px'
        }}>
          {addons.map((add) => {
            const isSelected = currentAddonPrompts === add.count;
            return (
              <button
                key={add.count}
                onClick={() => handleSelectAddon(add.count)}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: isSelected ? 'rgba(68, 0, 153, 0.04)' : 'var(--bg-app)',
                  border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-medium)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--brand-primary)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-medium)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {add.count === 0 ? 'Geen extra' : `+${add.count} prompts`}
                  </span>
                  {isSelected && <Check size={14} style={{ color: 'var(--brand-primary)' }} />}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {add.count === 0 ? 'Basis limiet' : `€${add.price} / maand`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subscription Pricing Grid */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', fontFamily: "'Outfit', sans-serif" }}>
          Kies Basis AI Optimalisatie (GEO) Abonnement
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          {plans.map((plan) => {
            const isActive = currentUser.subscription === plan.id;
            
            return (
              <div
                key={plan.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  border: isActive ? `2px solid ${plan.color}` : '1px solid var(--border-light)',
                  position: 'relative',
                  backgroundColor: isActive ? 'rgba(68, 0, 153, 0.01)' : 'var(--bg-card)',
                  transform: plan.popular ? 'scale(1.02)' : 'none',
                  boxShadow: plan.popular ? '0 10px 25px -5px rgba(68, 0, 153, 0.1)' : 'var(--shadow-md)'
                }}
              >
                {/* Plan Badge */}
                <span style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  backgroundColor: plan.color,
                  color: 'white'
                }}>
                  {plan.badge}
                </span>

                {/* Header */}
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>{plan.name}</h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '8px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                      €{plan.price}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>/ maand</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    + €{plan.setup} eenmalige opstartkosten
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => onUpdateSubscription(plan.id)}
                  disabled={isActive}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: '13px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'var(--status-positive-bg)' : 'var(--brand-primary)',
                    color: isActive ? 'var(--status-positive-text)' : 'white',
                    border: isActive ? '1px solid var(--status-positive-text)' : 'none',
                    textAlign: 'center',
                    cursor: isActive ? 'default' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                  }}
                >
                  {isActive ? 'Actief abonnement' : 'Kies dit abonnement'}
                </button>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>WAT IS INBEGREPEN:</div>
                  {plan.features.map((feat, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'start', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <Check size={14} style={{ color: plan.color, marginTop: '2px', flexShrink: 0 }} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice Registry List */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Outfit', sans-serif" }}>
          <FileText size={18} style={{ color: 'var(--brand-primary)' }} />
          Factuurhistorie (Recurring Payments)
        </h3>
        
        {loadingInvoices ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px', color: 'var(--text-secondary)' }}>
            <Loader2 size={16} className="spin" /> Facturen laden...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Er zijn nog geen facturen gegenereerd voor dit account.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>Factuurnummer</th>
                  <th style={{ padding: '10px' }}>Datum</th>
                  <th style={{ padding: '10px' }}>Omschrijving</th>
                  <th style={{ padding: '10px' }}>Totaal (incl. BTW)</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Actie</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '10px', fontWeight: 700 }}>{inv.invoice_number}</td>
                    <td style={{ padding: '10px' }}>{new Date(inv.created_at).toLocaleDateString('nl-NL')}</td>
                    <td style={{ padding: '10px' }}>{inv.package_name}</td>
                    <td style={{ padding: '10px', fontWeight: 700 }}>€ {Number(inv.total_amount).toFixed(2).replace('.', ',')}</td>
                    <td style={{ padding: '10px' }}>
                      <span className="badge badge-positive" style={{ fontSize: '11px', padding: '2px 8px' }}>Betaald</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <a
                        href={inv.html_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--brand-primary)',
                          fontWeight: 700,
                          textDecoration: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <Download size={14} /> Bekijken
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
