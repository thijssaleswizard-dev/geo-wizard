import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, LayoutDashboard, Search, Eye, 
  Settings, Award, RefreshCw, BarChart2, Compass, AlertCircle, 
  HelpCircle, Sliders, Users, Key, ExternalLink, LogOut, ShieldCheck
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  activeWorkspace, 
  onWorkspaceChange, 
  onLogout,
  clients = []
}) {
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  const brandReportItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'keywords', label: 'Keywords', icon: Sliders },
    { id: 'prompts', label: 'Prompts', icon: Search },
    { id: 'citations', label: 'Citations', icon: Award },
    { id: 'recommendations', label: 'Recommendations', icon: RefreshCw },
    { id: 'agents', label: 'Agents analytics', icon: BarChart2 }
  ];

  const generalItems = [
    { id: 'prompt_research', label: 'AI Prompt Research', icon: Compass },
    { id: 'search_prompts', label: 'Search Prompts', icon: Sliders, badge: 'New' },
    { id: 'audit_tools', label: 'GEO Audit Tools', icon: AlertCircle },
    { id: 'resources', label: 'Resources', icon: HelpCircle }
  ];

  // Admin menu links vary by role
  const getAdminItems = () => {
    if (currentUser.role === 'medewerker') {
      return [
        { id: 'client_admin', label: 'Client Workspaces', icon: Users, badge: 'Admin' },
        { id: 'api_keys', label: 'API Keys', icon: Key }
      ];
    }
    return [
      { id: 'account_plan', label: 'Account & Plan', icon: Settings },
      { id: 'api_keys', label: 'API Keys', icon: Key }
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
        padding: '24px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'var(--brand-accent-gradient)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 800,
          fontSize: '20px',
          fontFamily: "'Outfit', sans-serif"
        }}>
          S
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{
            fontSize: '18px',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            letterSpacing: '-0.5px',
            background: 'linear-gradient(to right, #ffffff, #d8b4fe)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Saleswizard
          </span>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#a78bfa',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            marginTop: '-2px'
          }}>
            GEO Wizard
          </span>
        </div>
      </div>

      {/* Workspace Selector (Enabled only for Medewerker, Locked for Klant) */}
      <div style={{ padding: '16px 16px 8px', position: 'relative' }}>
        <button
          onClick={() => {
            if (currentUser.role === 'medewerker') {
              setIsWorkspaceOpen(!isWorkspaceOpen);
            }
          }}
          disabled={currentUser.role !== 'medewerker'}
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
            cursor: currentUser.role === 'medewerker' ? 'pointer' : 'default'
          }}
          onMouseEnter={(e) => {
            if (currentUser.role === 'medewerker') e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            if (currentUser.role === 'medewerker') e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
        >
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: currentUser.role === 'medewerker' ? '#ec4899' : '#8b5cf6',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '11px'
          }}>
            {activeWorkspace[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {currentUser.role === 'medewerker' ? 'Actief Project' : 'Uw Project'}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeWorkspace}
            </div>
          </div>
          {currentUser.role === 'medewerker' && (
            isWorkspaceOpen ? <ChevronUp size={16} style={{ opacity: 0.6 }} /> : <ChevronDown size={16} style={{ opacity: 0.6 }} />
          )}
        </button>

        {/* Workspace Dropdown for Employees */}
        {isWorkspaceOpen && currentUser.role === 'medewerker' && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 16,
            right: 16,
            backgroundColor: '#150f24',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--border-radius-sm)',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            zIndex: 10,
            marginTop: '4px',
            overflow: 'hidden'
          }}>
            {clients.map((client) => (
              <button
                key={client.company}
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
                  display: 'block'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activeWorkspace === client.company ? 'rgba(255,255,255,0.06)' : 'transparent'}
              >
                {client.company}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <div style={{ flex: 1, padding: '12px' }}>
        
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
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#a78bfa' }}></div>
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
                    color: isActive ? '#f8fafc' : 'rgba(255,255,255,0.65)',
                    backgroundColor: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon size={16} style={{ color: isActive ? '#c084fc' : 'rgba(255,255,255,0.4)' }} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* GENERAL SECTION */}
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
                    color: isActive ? '#f8fafc' : 'rgba(255,255,255,0.65)',
                    backgroundColor: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon size={16} style={{ color: isActive ? '#c084fc' : 'rgba(255,255,255,0.4)' }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      backgroundColor: '#a78bfa',
                      color: 'white',
                      fontWeight: 700
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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
            {currentUser.role === 'medewerker' ? 'Admin' : 'Mijn Account'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px', marginTop: '4px' }}>
            {adminItems.map((item) => {
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
                    color: isActive ? '#f8fafc' : 'rgba(255,255,255,0.65)',
                    backgroundColor: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon size={16} style={{ color: isActive ? '#c084fc' : 'rgba(255,255,255,0.4)' }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(236, 72, 153, 0.2)',
                      color: '#ec4899',
                      fontWeight: 700
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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

      {/* User Footer Profile */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(0,0,0,0.1)'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: currentUser.role === 'medewerker' ? 'linear-gradient(135deg, #ec4899, #ec4899)' : 'linear-gradient(135deg, #a78bfa, #818cf8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 800,
          fontSize: '13px'
        }}>
          {currentUser.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentUser.name}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'capitalize' }}>
            {currentUser.role === 'medewerker' ? 'SW Medewerker' : `${currentUser.subscription}`}
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Uitloggen"
          style={{
            padding: '6px',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <LogOut size={14} />
        </button>
      </div>

    </aside>
  );
}
