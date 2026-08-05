import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import Prompts from './components/Prompts';
import Citations from './components/Citations';
import Recommendations from './components/Recommendations';
import AgentsAnalytics from './components/AgentsAnalytics';
import PromptResearch from './components/PromptResearch';
import AuditTools from './components/AuditTools';
import Login from './components/Login';
import AccountManagement from './components/AccountManagement';
import ClientAdmin from './components/ClientAdmin';
import Keywords from './components/Keywords';
import PaymentSimulator from './components/PaymentSimulator';
import { 
  Bell, HelpCircle, MessageSquare, ShieldAlert, Sparkles, User, LogOut 
} from 'lucide-react';

function App() {
  // Check for simulated payment parameters
  const [simulationParams, setSimulationParams] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('simulate_payment') === 'true') {
      setSimulationParams({
        paymentId: params.get('payment_id'),
        customerId: params.get('customer_id'),
        amount: params.get('amount'),
        description: params.get('description'),
        userId: params.get('userId')
      });
    } else if (params.get('payment_success') === 'true') {
      // In a real app we might auto-login or show a success notice
      alert('Betaling succesvol ontvangen! U kunt nu inloggen.');
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // Authentication & Workspace session state
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('geo_wizard_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    const savedWs = localStorage.getItem('geo_wizard_active_workspace');
    if (savedWs && savedWs !== 'null') return savedWs;

    const savedUser = localStorage.getItem('geo_wizard_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      return parsed.role === 'klant' ? parsed.company : null;
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('geo_wizard_active_tab');
    return savedTab || 'overview';
  });

  const [showNotifications, setShowNotifications] = useState(false);

  // Sync activeWorkspace and activeTab to localStorage so page refresh retains state
  useEffect(() => {
    if (activeWorkspace) {
      localStorage.setItem('geo_wizard_active_workspace', activeWorkspace);
    } else {
      localStorage.removeItem('geo_wizard_active_workspace');
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('geo_wizard_active_tab', activeTab);
    }
  }, [activeTab]);

  // Clients database (Workspaces list)
  const [clients, setClients] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Fetch clients and notifications from database
  useEffect(() => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.clients) {
          setClients(data.clients.map(c => ({
            id: c.id,
            company: c.company,
            name: c.name,
            email: c.email,
            subscription: c.subscription,
            promptsCount: c.promptsCount,
            keywordsCount: c.keywordsCount,
            visibilityIndex: c.visibility_index
          })));
        }
      })
      .catch(console.error);

    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.notifications) {
          setNotifications(data.notifications);
        }
      })
      .catch(console.error);
  }, []);

  // Callback: User logs in
  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('geo_wizard_user', JSON.stringify(user));
    if (user.role === 'klant') {
      // Force clients to their own workspace
      setActiveWorkspace(user.company);
      setActiveTab('overview');
    } else {
      // Employees start with no workspace selected (null) to choose a project
      setActiveWorkspace(null);
      setActiveTab('client_admin');
    }
  };

  // Callback: User logs out
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('geo_wizard_user');
    localStorage.removeItem('geo_wizard_active_workspace');
    localStorage.removeItem('geo_wizard_active_tab');
    setActiveWorkspace(null);
    setActiveTab('overview');
  };

  // Callback: Client updates their own plan in Account page
  const handleUpdateSubscription = (newPlan) => {
    if (!currentUser) return;
    
    // Update logged in profile
    setCurrentUser(prev => {
      const updated = { ...prev, subscription: newPlan };
      localStorage.setItem('geo_wizard_user', JSON.stringify(updated));
      return updated;
    });

    // Update clients database list
    setClients(clients.map(c => {
      if (c.company === currentUser.company) {
        return { ...c, subscription: newPlan };
      }
      return c;
    }));
  };

  // Callback: Client updates their addon prompts bundle
  const handleUpdateAddonPrompts = (count) => {
    if (!currentUser) return;
    setCurrentUser(prev => {
      const updated = { ...prev, addonPrompts: count };
      localStorage.setItem('geo_wizard_user', JSON.stringify(updated));
      return updated;
    });
  };

  // Callback: Medewerker updates client plan in Admin page
  const handleUpdateClientPlan = (company, newPlan) => {
    setClients(clients.map(c => {
      if (c.company === company) {
        return { ...c, subscription: newPlan };
      }
      return c;
    }));

    // If employee is actively viewing this company, update profile display
    if (currentUser && currentUser.role === 'klant' && currentUser.company === company) {
      setCurrentUser(prev => ({ ...prev, subscription: newPlan }));
    }
  };

  // Callback: Medewerker deletes a client workspace
  const handleDeleteClient = (companyToDelete) => {
    setClients(prev => prev.filter(c => c.company.toLowerCase() !== companyToDelete.toLowerCase()));
    if (activeWorkspace && activeWorkspace.toLowerCase() === companyToDelete.toLowerCase()) {
      setActiveWorkspace(null);
      setActiveTab('client_admin');
    }
  };

  // Callback: Medewerker creates new client workspace
  const handleAddClient = (newClient) => {
    setClients(prev => [newClient, ...prev]);
  };

  // Callback: Medewerker updates an existing client workspace
  const handleUpdateClient = (updatedClient) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c));
  };

  // Callback: Medewerker clicks "Bekijk Dashboard" for a client
  const handleSelectClient = (company) => {
    setActiveWorkspace(company);
    setActiveTab('overview');
  };

  if (simulationParams) {
    return (
      <PaymentSimulator
        paymentId={simulationParams.paymentId}
        customerId={simulationParams.customerId}
        amount={simulationParams.amount}
        description={simulationParams.description}
        userId={simulationParams.userId}
        onPaymentComplete={() => {
          // Redirect to trigger success and clear parameters
          window.location.href = `/?payment_success=true&userId=${simulationParams.userId}`;
        }}
      />
    );
  }

  // If no session, show Login Page
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const getTabTitle = () => {
    if (currentUser.role === 'medewerker' && !activeWorkspace) {
      return 'Projects';
    }
    switch (activeTab) {
      case 'overview': return 'Overview Dashboard';
      case 'keywords': return 'Keywords';
      case 'prompts': return 'Tracked Prompts';
      case 'citations': return 'Citations';
      case 'recommendations': return 'GEO Recommendations';
      case 'agents': return 'Agents Analytics';
      case 'prompt_research': return 'AI Prompt Research';
      case 'audit_tools': return 'GEO Audit Tools';
      case 'account_plan': return 'Account & Plan';
      case 'client_admin': return 'Projects';
      default: return activeTab;
    }
  };

  const renderContent = () => {
    if (currentUser.role === 'medewerker' && !activeWorkspace) {
      return <ClientAdmin clients={clients} onSelectClient={handleSelectClient} onUpdateClientPlan={handleUpdateClientPlan} onAddClient={handleAddClient} onDeleteClient={handleDeleteClient} onUpdateClient={handleUpdateClient} />;
    }
    switch (activeTab) {
      case 'overview':
        return <Keywords key={activeWorkspace} currentUser={currentUser} activeWorkspace={activeWorkspace} onUpdateAddonPrompts={handleUpdateAddonPrompts} />;
      case 'keywords':
        return <Keywords key={activeWorkspace} currentUser={currentUser} activeWorkspace={activeWorkspace} onUpdateAddonPrompts={handleUpdateAddonPrompts} />;
      case 'prompts':
        return <Prompts key={activeWorkspace} currentUser={currentUser} activeWorkspace={activeWorkspace} />;
      case 'citations':
        return <Citations key={activeWorkspace} activeWorkspace={activeWorkspace} />;
      case 'recommendations':
        return <Recommendations key={activeWorkspace} activeWorkspace={activeWorkspace} />;
      case 'agents':
        return <AgentsAnalytics key={activeWorkspace} activeWorkspace={activeWorkspace} />;
      case 'prompt_research':
        return <PromptResearch key={activeWorkspace} activeWorkspace={activeWorkspace} />;
      case 'audit_tools':
        return <AuditTools key={activeWorkspace} activeWorkspace={activeWorkspace} />;
      case 'account_plan':
        return <AccountManagement currentUser={currentUser} onUpdateSubscription={handleUpdateSubscription} onUpdateAddonPrompts={handleUpdateAddonPrompts} />;
      case 'client_admin':
        return <ClientAdmin clients={clients} onSelectClient={handleSelectClient} onUpdateClientPlan={handleUpdateClientPlan} onAddClient={handleAddClient} onDeleteClient={handleDeleteClient} />;
      default:
        // coming soon fallback page
        return (
          <div className="fade-in" style={{
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: '16px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              backgroundColor: 'var(--brand-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Coming Soon</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', maxWidth: '400px' }}>
                The <strong>{activeTab}</strong> component is currently in active development by the Saleswizard marketing team and will be released in the next update.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                padding: '10px 20px',
                borderRadius: 'var(--border-radius-sm)',
                marginTop: '12px'
              }}
            >
              Back to Overview
            </button>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser}
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={setActiveWorkspace}
        onLogout={handleLogout}
        clients={clients}
      />

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Top Workspace Sub-Header Bar */}
        <header style={{
          height: 'var(--header-height)',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
              {getTabTitle()}
            </h1>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            
            {/* Live active client marker */}
            {activeWorkspace && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                backgroundColor: 'rgba(68, 0, 153, 0.05)',
                border: '1px solid var(--brand-light-border)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--brand-primary)'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                Client: {activeWorkspace}
              </div>
            )}

            {/* Notifications trigger */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  padding: '8px',
                  borderRadius: '50%',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: showNotifications ? 'var(--border-light)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!showNotifications) e.currentTarget.style.backgroundColor = 'var(--border-light)';
                }}
                onMouseLeave={(e) => {
                  if (!showNotifications) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Bell size={18} />
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  border: '1.5px solid var(--bg-card)'
                }}></span>
              </button>

              {/* Notifications panel dropdown */}
              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: '320px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--border-radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  marginTop: '8px',
                  zIndex: 200,
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 800, fontSize: '13px' }}>
                    Notifications
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {notifications.map(notif => (
                      <div key={notif.id} style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-light)',
                        fontSize: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{notif.text}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{notif.time}</span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--brand-primary)',
                      textAlign: 'center',
                      backgroundColor: 'rgba(68,0,153,0.02)'
                    }}
                  >
                    Sluiten
                  </button>
                </div>
              )}
            </div>

            {/* General help link */}
            <a
              href="https://saleswizard.nl/contact"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '8px',
                borderRadius: '50%',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <HelpCircle size={18} />
            </a>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-medium)', margin: '0 8px' }}></div>

            {/* User Profile & Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{currentUser.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {currentUser.role === 'medewerker' ? 'SW Medewerker' : currentUser.subscription}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Uitloggen"
                style={{
                  padding: '8px',
                  borderRadius: '50%',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <LogOut size={16} />
              </button>
            </div>

          </div>
        </header>

      {/* Dynamic subview */}
        <div style={{ flex: 1 }}>
          {renderContent()}
        </div>

      </main>

      {/* Floating Action Help Button (Chat Bubble matching Otterly screen dump) */}
      <a
        href="https://saleswizard.nl/contact"
        target="_blank"
        rel="noreferrer"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--brand-primary)',
          boxShadow: '0 8px 24px rgba(68, 0, 153, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          zIndex: 1000,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
        }}
      >
        <MessageSquare size={24} />
      </a>

    </div>
  );
}

export default App;
