import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, LayoutDashboard, Search, Eye,
  Settings, Award, RefreshCw, BarChart2, Compass, AlertCircle,
  HelpCircle, Sliders, Users, Key, ExternalLink, LogOut, ShieldCheck, Coins, FileText, NewReleases, Globe
} from 'lucide-react';

const FaviconImage = ({ domain, fallbackLabel, fallbackBg, fallbackColor, size = 20, style = {} }) => {
  const [error, setError] = React.useState(false);
  const cleanDomain = (domain || '').toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0].split('?')[0].trim();
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${size * 2}`;

  React.useEffect(() => {
    setError(false);
  }, [cleanDomain]);

  if (error || !cleanDomain) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '4px',
        backgroundColor: fallbackBg || '#f3f4f6',
        color: fallbackColor || 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(10, size - 12)}px`,
        fontWeight: 700,
        ...style
      }}>
        {fallbackLabel ? fallbackLabel.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }

  return (
    <img
      src={faviconUrl}
      onError={() => setError(true)}
      alt=""
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '4px',
        objectFit: 'contain',
        ...style
      }}
    />
  );
};

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  activeWorkspace,
  onWorkspaceChange,
  onLogout,
  clients = [],
  onOpenGuide,
  onStartTour
}) {
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const isStaff = currentUser.role === 'medewerker' || currentUser.role === 'admin';

  const brandReportItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'report', label: 'Rapportage', icon: FileText }
  ];

  const generalItems = isStaff
    ? [
      { id: 'prompt_research', label: 'AI Prompt Research', icon: Compass },
      { id: 'llm_costs', label: 'DataForSEO Kosten', icon: Coins },
      { id: 'whats_new', label: "What's New", icon: NewReleases, badge: 'v2.6' }
    ]
    : [];

  // Admin menu links vary by role
  const getAdminItems = () => {
    if (isStaff) {
      return [
        { id: 'client_admin', label: 'Projects', icon: LayoutDashboard },
        { id: 'users', label: 'Gebruikers & Toegang', icon: Users }
      ];
    }
    return [
      { id: 'account_plan', label: 'Account & Plan', icon: Settings }
    ];
  };

  const adminItems = getAdminItems();

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      backgroundColor: 'var(--bg-sidebar)',
      color: 'var(--text-light)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100,
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      overflowY: 'auto'
    }} className="sidebar-nav">

      {/* Saleswizard Brand Header */}
      <div style={{
        padding: '22px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#440099',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '7px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '16px',
          fontFamily: "'Outfit', sans-serif"
        }}>
          S
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{
            fontSize: '16px',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.3px',
            color: '#ffffff'
          }}>
            Saleswizard
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.45)',
            letterSpacing: '0.6px',
            marginTop: '-1px'
          }}>
            GEO Wizard
          </span>
        </div>
      </div>

      {/* Workspace Selector (Enabled for Staff or multi-project Klant, Locked for single-project Klant) */}
      <div data-tour="sidebar-workspace" style={{ padding: '16px 16px 8px', position: 'relative' }}>
        <button
          onClick={() => {
            if (isStaff || (clients && clients.length > 1)) {
              setIsWorkspaceOpen(!isWorkspaceOpen);
            }
          }}
          disabled={!(isStaff || (clients && clients.length > 1))}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'between',
            gap: '8px',
            textAlign: 'left',
            cursor: (isStaff || (clients && clients.length > 1)) ? 'pointer' : 'default'
          }}
          onMouseEnter={(e) => {
            if (isStaff || (clients && clients.length > 1)) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            if (isStaff || (clients && clients.length > 1)) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
        >
          <FaviconImage
            domain={activeWorkspace}
            fallbackLabel={activeWorkspace || 'P'}
            fallbackBg="#334155"
            fallbackColor="white"
            size={24}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isStaff ? 'Actief Project' : 'Uw Project'}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: activeWorkspace ? 'white' : 'rgba(255,255,255,0.8)' }}>
              {activeWorkspace || (isStaff ? 'Alle Projecten (Totaal)' : 'Geen project gekoppeld')}
            </div>
          </div>
          {(isStaff || (clients && clients.length > 1)) && (
            isWorkspaceOpen ? <ChevronUp size={16} style={{ opacity: 0.6 }} /> : <ChevronDown size={16} style={{ opacity: 0.6 }} />
          )}
        </button>

        {/* Workspace Dropdown */}
        {isWorkspaceOpen && (isStaff || (clients && clients.length > 1)) && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 16,
            right: 16,
            backgroundColor: '#1d0840',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
            zIndex: 10,
            marginTop: '4px',
            overflow: 'hidden',
            maxHeight: '320px',
            overflowY: 'auto'
          }}>
            {isStaff && (
              <button
                onClick={() => {
                  onWorkspaceChange(null);
                  setIsWorkspaceOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: !activeWorkspace ? 600 : 400,
                  backgroundColor: !activeWorkspace ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: !activeWorkspace ? '#ffffff' : 'rgba(255,255,255,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !activeWorkspace ? 'rgba(255,255,255,0.08)' : 'transparent'}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px'
                }}>
                  <Globe size={13} />
                </div>
                <span>Alle projecten</span>
              </button>
            )}
            {clients.map((client) => (
              <button
                key={client.id || client.company}
                onClick={() => {
                  onWorkspaceChange(client.company);
                  setIsWorkspaceOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: activeWorkspace === client.company ? 600 : 400,
                  backgroundColor: activeWorkspace === client.company ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: activeWorkspace === client.company ? 'white' : 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeWorkspace === client.company ? 'rgba(255,255,255,0.06)' : 'transparent'}
              >
                <FaviconImage
                  domain={client.company}
                  fallbackLabel={client.company}
                  fallbackBg="rgba(255,255,255,0.1)"
                  fallbackColor="white"
                  size={16}
                />
                <span>{client.company}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <div style={{ flex: 1, padding: '12px' }}>

        {!activeWorkspace ? (
          /* Staff Initial state menu (Projects, Users, DataForSEO Costs & What's New) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {[
              { id: 'client_admin', label: 'Projects', icon: LayoutDashboard },
              { id: 'users', label: 'Gebruikers & Toegang', icon: Users },
              { id: 'llm_costs', label: 'DataForSEO Kosten', icon: Coins },
              { id: 'whats_new', label: "What's New", icon: NewReleases, badge: 'v2.6' }
            ].map(nav => {
              const NavIcon = nav.icon;
              const isAct = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    fontWeight: isAct ? 600 : 400,
                    color: isAct ? '#ffffff' : 'rgba(255,255,255,0.72)',
                    backgroundColor: isAct ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    textAlign: 'left',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <NavIcon size={17} style={{ color: isAct ? '#ffffff' : 'rgba(255,255,255,0.55)' }} />
                  <span style={{ flex: 1 }}>{nav.label}</span>
                  {nav.badge && (
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontWeight: 600
                    }}>
                      {nav.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* Normal Project menus */
          <>
            {/* BRAND REPORT SECTION */}
            <div>
              <div style={{
                width: '100%',
                padding: '8px',
                fontSize: '10px',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                textAlign: 'left'
              }}>
                Brand Report
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px', marginTop: '4px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#47ca9b' }}></div>
                  {activeWorkspace}
                </div>
                {brandReportItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#ffffff' : 'rgba(255,255,255,0.68)',
                        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Icon size={16} style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)' }} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GENERAL SECTION */}
            {generalItems.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <div style={{
                  padding: '8px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  General
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px', marginTop: '4px' }}>
                  {generalItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 'var(--border-radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '13px',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#ffffff' : 'rgba(255,255,255,0.68)',
                          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Icon size={16} style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)' }} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.badge && (
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontWeight: 600
                          }}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ADMIN / ACCOUNT SECTION */}
            <div style={{ marginTop: '18px' }}>
              <div style={{
                padding: '8px',
                fontSize: '10px',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {isStaff ? 'Admin' : 'Mijn Account'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px', marginTop: '4px' }}>
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'client_admin') {
                          onWorkspaceChange(null);
                        }
                        setActiveTab(item.id);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#ffffff' : 'rgba(255,255,255,0.68)',
                        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Icon size={16} style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)' }} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.8)',
                          fontWeight: 600
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Handleiding & Rondleiding Quick Access in Sidebar */}
      <div style={{ padding: '8px 16px 14px' }}>
        <button
          type="button"
          onClick={() => onOpenGuide && onOpenGuide()}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.72)',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
        >
          <HelpCircle size={15} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
          <span>Handleiding &amp; Rondleiding</span>
        </button>
      </div>

      {/* Trial CTA Widget (Show only for Klant) */}
      {currentUser.role === 'klant' && (
        <div style={{ padding: '16px' }}>
          <div style={{
            background: 'linear-gradient(145deg, #1f143a, #130a27)',
            border: '1px solid rgba(167, 139, 250, 0.15)',
            borderRadius: 'var(--border-radius-md)',
            padding: '16px',
            position: 'relative'
          }}>
            <h4 style={{ color: 'white', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={14} style={{ color: '#a78bfa' }} />
              Improve visibility
            </h4>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '6px', lineHeight: '1.4' }}>
              Book a 30-min call and we\'ll show you exactly how to track and improve your AI search visibility.
            </p>
            <a
              href="https://saleswizard.nl/contact"
              target="_blank"
              rel="noreferrer"
              style={{
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: 'var(--brand-primary)',
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                padding: '8px 12px',
                borderRadius: 'var(--border-radius-sm)',
                textDecoration: 'none',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
            >
              Book a Demo
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}



    </aside>
  );
}
