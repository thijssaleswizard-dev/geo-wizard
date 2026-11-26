import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Shield, Building2, Mail, Lock, Search,
  Edit2, Trash2, X, Check, Loader2, LockKeyhole, ExternalLink, Globe
} from 'lucide-react';

export default function UserManagement({ currentUser, clients = [], onSelectClient }) {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState(clients || []);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerMsg, setBannerMsg] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('medewerker');
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [projectSearch, setProjectSearch] = useState('');

  const isStaff = currentUser?.role === 'medewerker' || currentUser?.role === 'admin';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentUser?.id) params.set('userId', String(currentUser.id));
      if (currentUser?.role) params.set('role', String(currentUser.role));

      const res = await fetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
        }
      }
    } catch (err) {
      console.error('Fout bij laden gebruikers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = (defaultRole = 'medewerker') => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole(defaultRole);
    setSelectedProjectIds(defaultRole === 'klant' && projects.length > 0 ? [projects[0].id] : []);
    setProjectSearch('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setName(u.name || '');
    setEmail(u.email || '');
    setPassword('');
    setRole(u.role || 'klant');
    setSelectedProjectIds(Array.isArray(u.project_ids) ? u.project_ids : (u.projects || []).map(p => p.id));
    setProjectSearch('');
    setFormError('');
    setModalOpen(true);
  };

  const toggleProjectSelection = (projId) => {
    setSelectedProjectIds(prev => {
      if (prev.includes(projId)) {
        return prev.filter(id => id !== projId);
      }
      return [...prev, projId];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !email.trim()) {
      setFormError('Vul zowel een naam als een e-mailadres in.');
      return;
    }
    if (!editingUser && password.length < 6) {
      setFormError('Kies een wachtwoord van minimaal 6 tekens.');
      return;
    }
    if (editingUser && password.length > 0 && password.length < 6) {
      setFormError('Een nieuw wachtwoord moet uit minimaal 6 tekens bestaan.');
      return;
    }
    if (role === 'klant' && selectedProjectIds.length === 0) {
      setFormError('Selecteer minimaal één project dat deze klant mag inzien.');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          project_ids: role === 'klant' ? selectedProjectIds : [],
          userId: currentUser?.id,
           callerRole: currentUser?.role
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Opslaan van gebruiker mislukt.');
        setSubmitting(false);
        return;
      }

      if (editingUser) {
        setUsers(prev => prev.map(u => u.id === data.user.id ? data.user : u));
      } else {
        setUsers(prev => [data.user, ...prev]);
      }

      setModalOpen(false);
      setBannerMsg(data.message || 'Gebruiker succesvol opgeslagen.');
      setTimeout(() => setBannerMsg(null), 5000);
    } catch (err) {
      console.error(err);
      setFormError('Kan geen verbinding maken met de server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === currentUser?.id) return;
    if (!window.confirm(`Weet u zeker dat u gebruiker "${u.name}" (${u.email}) definitief wilt verwijderen?`)) {
      return;
    }

    try {
      const params = new URLSearchParams({
        userId: String(currentUser?.id || ''),
        role: String(currentUser?.role || 'medewerker')
      });
      const res = await fetch(`/api/users/${u.id}?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(prev => prev.filter(item => item.id !== u.id));
        setBannerMsg(data.message || 'Gebruiker verwijderd.');
        setTimeout(() => setBannerMsg(null), 5000);
      } else {
        alert(data.error || 'Verwijderen mislukt.');
      }
    } catch (err) {
      console.error(err);
      alert('Kan geen verbinding maken met de server.');
    }
  };

  if (!isStaff) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: '#475569' }}>
        Geen toegang tot gebruikersbeheer.
      </div>
    );
  }

  const staffCount = users.filter(u => u.role === 'medewerker' || u.role === 'admin').length;
  const clientCount = users.filter(u => u.role === 'klant').length;

  const filteredUsers = users.filter(u => {
    if (roleFilter === 'staff' && !(u.role === 'medewerker' || u.role === 'admin')) return false;
    if (roleFilter === 'klant' && u.role !== 'klant') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchProj = (u.projects || []).some(p => (p.company || '').toLowerCase().includes(q));
      return matchName || matchEmail || matchProj;
    }
    return true;
  });

  const filteredModalProjects = projects.filter(p => {
    if (!projectSearch.trim()) return true;
    const q = projectSearch.toLowerCase();
    return (p.company || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
  });

  return (
    <div className="fade-in" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: '#f9fafb', minHeight: '100%' }}>
      <div style={{ maxWidth: '1040px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
              Gebruikers & Toegang
            </h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0 0' }}>
              Voeg Saleswizard medewerkers toe (volledig beheer) of maak klantaccounts aan die uitsluitend hun eigen project zien.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => openCreateModal('klant')}
              style={{
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 15px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Building2 size={15} style={{ color: '#64748b' }} />
              Klant toevoegen
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('medewerker')}
              style={{
                backgroundColor: '#440099',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 15px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <UserPlus size={15} />
              Medewerker toevoegen
            </button>
          </div>
        </div>

        {bannerMsg && (
          <div style={{
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#15803d',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>✓ {bannerMsg}</span>
            <button type="button" onClick={() => setBannerMsg(null)} style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Totaal accounts</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', fontFamily: "'Outfit', sans-serif", marginTop: '4px' }}>
              {users.length}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Actieve logins in GEO Wizard</div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Medewerkers &amp; beheerders</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', fontFamily: "'Outfit', sans-serif", marginTop: '4px' }}>
              {staffCount}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Toegang tot alle projecten &amp; instellingen</div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Klantaccounts</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', fontFamily: "'Outfit', sans-serif", marginTop: '4px' }}>
              {clientCount}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Afgeschermd tot alleen eigen project(en)</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#ffffff', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {[
              { id: 'all', label: `Alle (${users.length})` },
              { id: 'staff', label: `Medewerkers (${staffCount})` },
              { id: 'klant', label: `Klanten (${clientCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: roleFilter === tab.id ? 600 : 500,
                  backgroundColor: roleFilter === tab.id ? '#0f172a' : 'transparent',
                  color: roleFilter === tab.id ? '#ffffff' : '#475569',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '360px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Zoek op naam, e-mail of project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 36px',
                borderRadius: '20px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Users Table */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', color: '#6b7280', fontSize: '13px' }}>
              <Loader2 size={18} className="spin" /> Gebruikers laden...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
              Geen gebruikers gevonden voor deze weergave.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Gebruiker</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Rol</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Projecttoegang</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    const isUserStaff = u.role === 'medewerker' || u.role === 'admin';

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              backgroundColor: isUserStaff ? '#1e293b' : '#f1f5f9',
                              color: isUserStaff ? '#ffffff' : '#334155',
                              border: isUserStaff ? 'none' : '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              flexShrink: 0
                            }}>
                              {(u.name || u.email || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {u.name}
                                {isSelf && (
                                  <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                                    Jij
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          {u.role === 'admin' ? (
                            <span style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              padding: '3px 9px',
                              borderRadius: '6px',
                              backgroundColor: '#f1f5f9',
                              color: '#0f172a',
                              border: '1px solid #cbd5e1',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Shield size={12} style={{ color: '#475569' }} /> Beheerder
                            </span>
                          ) : u.role === 'medewerker' ? (
                            <span style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              padding: '3px 9px',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Users size={12} style={{ color: '#64748b' }} /> Medewerker
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '11.5px',
                              fontWeight: 500,
                              padding: '3px 9px',
                              borderRadius: '6px',
                              backgroundColor: '#ffffff',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <LockKeyhole size={12} style={{ color: '#64748b' }} /> Klant
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          {isUserStaff ? (
                            <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <Globe size={14} style={{ color: '#64748b' }} /> Alle projecten
                            </span>
                          ) : (u.projects && u.projects.length > 0) ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {u.projects.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => onSelectClient && onSelectClient(p.company)}
                                  title={`Open project ${p.company}`}
                                  style={{
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    backgroundColor: '#f8fafc',
                                    color: '#1e293b',
                                    border: '1px solid #cbd5e1',
                                    cursor: onSelectClient ? 'pointer' : 'default',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  <Lock size={12} style={{ color: '#64748b' }} /> {p.company}
                                  {onSelectClient && <ExternalLink size={11} style={{ color: '#64748b' }} />}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                              Geen project gekoppeld
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              title="Gebruiker of projecttoegang bewerken"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #e5e7eb',
                                backgroundColor: '#ffffff',
                                color: '#374151',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Edit2 size={12} /> Bewerken
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                title="Gebruiker verwijderen"
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #e5e7eb',
                                  backgroundColor: '#ffffff',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif", margin: '0 0 4px 0' }}>
              {editingUser ? 'Gebruiker bewerken' : 'Nieuwe gebruiker toevoegen'}
            </h3>
            <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '0 0 20px 0' }}>
              Kies de rol en bepaal tot welke omgeving de gebruiker toegang krijgt.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Role Selection Cards */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
                  1. Rol selecteren
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'medewerker', title: 'Medewerker', desc: 'Alle projecten & prompts beheren' },
                    { id: 'klant', title: 'Klant', desc: 'Ziet alleen eigen project' },
                    { id: 'admin', title: 'Admin', desc: 'Volledige rechten' }
                  ].map(rOpt => {
                    const active = role === rOpt.id;
                    return (
                      <button
                        key={rOpt.id}
                        type="button"
                        onClick={() => {
                          setRole(rOpt.id);
                          if (rOpt.id === 'klant' && selectedProjectIds.length === 0 && projects.length > 0) {
                            setSelectedProjectIds([projects[0].id]);
                          }
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: active ? '1.5px solid #18181b' : '1px solid #e5e7eb',
                          backgroundColor: active ? '#f8fafc' : '#ffffff',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{rOpt.title}</span>
                          {active && <Check size={13} color="#18181b" />}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '3px', lineHeight: 1.3 }}>
                          {rOpt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '5px' }}>
                    Naam
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={role === 'klant' ? 'Naam contactpersoon' : 'Naam medewerker'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '5px' }}>
                    E-mailadres (Login)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="email"
                      required
                      placeholder={role === 'klant' ? 'klant@bedrijf.nl' : 'naam@saleswizard.nl'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '5px' }}>
                  {editingUser ? 'Nieuw wachtwoord instellen (optioneel)' : 'Wachtwoord (minimaal 6 tekens)'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="password"
                    required={!editingUser}
                    placeholder={editingUser ? 'Laat leeg om huidig wachtwoord te behouden' : 'Kies een veilig wachtwoord'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Project Assignment (Strictly for Klant!) */}
              {role === 'klant' ? (
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                      Gekoppeld project voor deze klant ({selectedProjectIds.length} geselecteerd)
                    </label>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Alleen eigen project
                    </span>
                  </div>

                  {projects.length > 5 && (
                    <input
                      type="text"
                      placeholder="Filter projecten..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', backgroundColor: '#ffffff' }}
                    />
                  )}

                  {projects.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#dc2626', padding: '8px 0' }}>
                      Er zijn nog geen projecten aangemaakt. Maak eerst een project aan onder Projects.
                    </div>
                  ) : (
                    <div style={{ maxHeight: '175px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {filteredModalProjects.map(proj => {
                        const checked = selectedProjectIds.includes(proj.id);
                        return (
                          <label
                            key={proj.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              backgroundColor: checked ? '#f8fafc' : '#ffffff',
                              border: checked ? '1px solid #64748b' : '1px solid #e2e8f0',
                              cursor: 'pointer',
                              fontSize: '12.5px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProjectSelection(proj.id)}
                                style={{ width: '15px', height: '15px', accentColor: '#18181b', cursor: 'pointer' }}
                              />
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{proj.company}</span>
                              {proj.name && <span style={{ color: '#64748b', fontSize: '11.5px' }}>({proj.name})</span>}
                            </div>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b' }}>
                              {proj.subscription}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                    🔒 Deze klant ziet na inloggen <strong>uitsluitend het geselecteerde project</strong> (prompts, nulmeting en rapportages) en heeft geen toegang tot andere klanten of inkoopkosten.
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '12px'
                }}>
                  Saleswizard medewerkers en beheerders hebben automatisch toegang tot alle projecten, prompts, rapportages en gebruikersbeheer.
                </div>
              )}

              {formError && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#440099',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submitting && <Loader2 size={14} className="spin" />}
                  {editingUser ? 'Wijzigingen opslaan' : 'Gebruiker aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
