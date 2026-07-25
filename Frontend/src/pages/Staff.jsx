import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, ShieldCheck, Stethoscope, FlaskConical,
  Loader2, Search, X, Edit, Trash2, Filter, RefreshCw,
  UserCheck, UserX, Pill, PhoneCall
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Staff.css';

/* ── Role styling ── */
const ROLE_COLORS = {
  'Admin':          { bg: 'rgba(139,92,246,0.12)',  color: '#8B5CF6' },
  'Doctor':         { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6' },
  'Receptionist':   { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
  'Pharmacist':     { bg: 'rgba(46,125,50,0.12)',   color: '#2E7D32' },
  'Lab Technician': { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444' },
};

const PIE_COLORS  = ['#3B82F6','#8B5CF6','#F59E0B','#2E7D32','#EF4444','#C8247E'];
const AVT_COLORS  = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#C8247E','#2E7D32'];

const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

/* ── Custom tooltip ── */
const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 14px', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }}>
      <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>{label}</p>
      <p style={{ color: 'var(--primary-brand)' }}>{payload[0].value} members</p>
    </div>
  );
};

const Staff = () => {
  const [staff,         setStaff]         = useState([]);
  const [isLoading,     setIsLoading]     = useState(true);

  /* Filters */
  const [searchTerm,    setSearchTerm]    = useState('');
  const [roleFilter,    setRoleFilter]    = useState('All');
  const [statusFilter,  setStatusFilter]  = useState('All');

  /* Modal */
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [modalMode,     setModalMode]     = useState('add');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitError,   setSubmitError]   = useState('');

  const { user } = useAuth();

  const emptyForm = { id: '', full_name: '', email: '', password: '', role: 'Receptionist', phone: '' };
  const [formData, setFormData] = useState(emptyForm);

  /* ── Fetch ── */
  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setStaff(data || []);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  /* ── Filtered ── */
  const filtered = useMemo(() => {
    return staff.filter(s => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !term || s.full_name?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term) || s.phone?.includes(term) || s.role?.toLowerCase().includes(term);
      const matchRole   = roleFilter   === 'All' || s.role === roleFilter;
      const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' ? s.is_active : !s.is_active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [staff, searchTerm, roleFilter, statusFilter]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:    staff.length,
    doctors:  staff.filter(s => s.role === 'Doctor').length,
    active:   staff.filter(s => s.is_active).length,
    inactive: staff.filter(s => !s.is_active).length,
    admins:   staff.filter(s => s.role === 'Admin').length,
  }), [staff]);

  /* ── Chart data ── */
  const roles = ['Doctor','Admin','Receptionist','Pharmacist','Lab Technician'];

  const barData = useMemo(() =>
    roles.map(r => ({ role: r.split(' ')[0], count: staff.filter(s => s.role === r).length })),
  [staff]);

  const pieData = useMemo(() => {
    const d = roles.map(r => ({ name: r, value: staff.filter(s => s.role === r).length })).filter(d => d.value > 0);
    return d;
  }, [staff]);
  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  /* Role breakdown for side panel */
  const roleBreakdown = useMemo(() =>
    roles.map(r => ({ role: r, count: staff.filter(s => s.role === r).length })).filter(d => d.count > 0),
  [staff]);

  /* ── CRUD ── */
  const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const openAdd  = ()    => { setFormData(emptyForm); setModalMode('add');  setSubmitError(''); setIsModalOpen(true); };
  const openEdit = (m)   => { setFormData({ id: m.id, full_name: m.full_name||'', email: m.email||'', password: '', role: m.role||'Receptionist', phone: m.phone||'' }); setModalMode('edit'); setSubmitError(''); setIsModalOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    modalMode === 'add' ? handleAddStaff() : handleEditStaff();
  };

  const handleAddStaff = async () => {
    setIsSubmitting(true); setSubmitError('');
    try {
      const res = await fetch('http://localhost:3005/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: formData.full_name, email: formData.email, password: formData.password, role: formData.role, phone: formData.phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create staff account');
      setIsModalOpen(false); fetchStaff();
    } catch (err) { setSubmitError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleEditStaff = async () => {
    setIsSubmitting(true); setSubmitError('');
    try {
      const { error } = await supabase.from('profiles').update({ full_name: formData.full_name, email: formData.email, role: formData.role, phone: formData.phone }).eq('id', formData.id);
      if (error) throw error;
      setIsModalOpen(false); fetchStaff();
    } catch (err) { setSubmitError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (id === user.id) { alert('Ma tirtiri kartid koontadaada adiga ku furan!'); return; }
    if (!window.confirm(`Delete staff: ${name}?`)) return;
    try {
      const res = await fetch(`http://localhost:3005/api/staff/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setStaff(staff.filter(s => s.id !== id));
    } catch (err) { alert(err.message); }
  };

  const toggleActive = async (id, current) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', id);
      if (error) throw error;
      setStaff(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s));
    } catch (err) { console.error(err); }
  };

  /* ── KPI cards ── */
  const kpiCards = [
    { label: 'Total Staff',   value: stats.total,    sub: 'All members',    color: 'blue',   Icon: Users        },
    { label: 'Doctors',       value: stats.doctors,  sub: 'Medical staff',  color: 'green',  Icon: Stethoscope  },
    { label: 'Active',        value: stats.active,   sub: 'Currently on',   color: 'green',  Icon: UserCheck    },
    { label: 'Inactive',      value: stats.inactive, sub: 'Off duty',       color: 'red',    Icon: UserX        },
    { label: 'Admins',        value: stats.admins,   sub: 'System access',  color: 'purple', Icon: ShieldCheck  },
  ];

  return (
    <div className="staff-page">

      {/* ══ HEADER ══ */}
      <div className="staff-header">
        <div className="staff-header-left">
          <h2>Staff Directory</h2>
          <p className="breadcrumb-path">Dashboard / <span>Staff</span></p>
        </div>
        <button className="premium-btn" onClick={openAdd}>
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* ══ KPI RIBBON ══ */}
      <div className="staff-kpi-ribbon">
        {kpiCards.map(({ label, value, sub, color, Icon }) => (
          <div className="staff-kpi-card" key={label}>
            <div className={`staff-kpi-icon ${color}`}><Icon size={18} /></div>
            <div className="staff-kpi-info">
              <h3>{value}</h3>
              <p>{label}</p>
              <span className="kpi-sub">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ══ CHARTS ROW ══ */}
      <div className="staff-charts-row">
        {/* Bar: Staff by role */}
        <div className="staff-chart-panel">
          <div className="staff-chart-header">
            <h3>Staff by Role</h3>
            <span className="staff-chart-badge">{stats.total} Total</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={26}>
              <XAxis dataKey="role" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(46,125,50,0.06)' }} />
              <Bar dataKey="count" fill="var(--primary-brand)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: Active vs Inactive */}
        <div className="staff-chart-panel">
          <div className="staff-chart-header">
            <h3>Staff by Role Distribution</h3>
            <span className="staff-chart-badge">{totalPie} Members</span>
          </div>
          {pieData.length > 0 ? (
            <div className="staff-pie-wrap">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={54} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="staff-pie-legend">
                {pieData.map((item, i) => (
                  <div className="staff-pie-row" key={item.name}>
                    <div className="staff-pie-left">
                      <div className="staff-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {item.name}
                    </div>
                    <span className="staff-pie-pct">
                      {totalPie ? Math.round((item.value / totalPie) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Users size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />No data yet
            </div>
          )}
        </div>
      </div>

      {/* ══ FILTER TOOLBAR ══ */}
      <div className="staff-filter-toolbar">
        <div className="staff-search-wrap">
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by name, email, phone or role..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="staff-filter-select">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="All">All Roles</option>
            <option>Doctor</option>
            <option>Admin</option>
            <option>Receptionist</option>
            <option>Pharmacist</option>
            <option>Lab Technician</option>
          </select>
        </div>

        <div className="staff-filter-select">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <button className="staff-filter-btn"><Filter size={14} /> Filter</button>
        <button className="staff-reset-btn" onClick={() => { setSearchTerm(''); setRoleFilter('All'); setStatusFilter('All'); }}>
          <RefreshCw size={14} /> Reset
        </button>
      </div>

      {/* ══ CONTENT SPLIT ══ */}
      <div className="staff-content-split">

        {/* Left: Staff List */}
        <div className="staff-list-panel">
          <div className="staff-list-panel-header">
            <h4>Staff Members ({filtered.length})</h4>
          </div>

          {isLoading ? (
            <div className="staff-loading">
              <Loader2 className="spinner" size={28} color="var(--primary-brand)" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="staff-empty-state">
              <Users size={36} />
              <p>No staff members found.</p>
            </div>
          ) : (
            filtered.map((member, idx) => {
              const roleStyle  = ROLE_COLORS[member.role] || { bg: 'var(--bg-hover)', color: 'var(--text-muted)' };
              const avatarColor = AVT_COLORS[idx % AVT_COLORS.length];
              return (
                <div key={member.id} className={`staff-list-row ${!member.is_active ? 'inactive' : ''}`}>
                  <div className="staff-row-left">
                    <div className="staff-row-avatar" style={{ background: avatarColor }}>
                      {getInitials(member.full_name)}
                    </div>
                    <div className="staff-row-info">
                      <h3 className="staff-row-name">{member.full_name}</h3>
                      <p className="staff-row-contact">
                        {member.email}
                        {member.phone && <span className="contact-separator"> · {member.phone}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="staff-row-right">
                    <span className="staff-role-badge" style={{ background: roleStyle.bg, color: roleStyle.color }}>
                      {member.role}
                    </span>

                    <button
                      className={`staff-status-toggle ${member.is_active ? 'active' : 'inactive'}`}
                      onClick={() => toggleActive(member.id, member.is_active)}
                      title="Click to toggle"
                    >
                      {member.is_active ? 'Active' : 'Inactive'}
                    </button>

                    <div className="staff-row-actions">
                      <button className="action-circular-btn edit" onClick={() => openEdit(member)} title="Edit">
                        <Edit size={13} />
                      </button>
                      <button className="action-circular-btn delete" onClick={() => handleDelete(member.id, member.full_name)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Role Breakdown */}
        <div className="staff-side-panel">
          <div className="staff-side-header">
            <h4>Role Summary</h4>
          </div>
          <div className="staff-side-list">
            {roleBreakdown.map(({ role, count }) => (
              <div className="staff-role-summary-card" key={role}
                onClick={() => setRoleFilter(role)} style={{ cursor: 'pointer' }}>
                <div className="staff-role-summary-name">{role}</div>
                <span className="staff-role-count">{count} member{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
            {/* Active vs Inactive */}
            <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
            <div className="staff-role-summary-card" onClick={() => setStatusFilter('Active')} style={{ cursor: 'pointer' }}>
              <div className="staff-role-summary-name" style={{ color: 'var(--primary-brand)' }}>● Active</div>
              <span className="staff-role-count">{stats.active}</span>
            </div>
            <div className="staff-role-summary-card" onClick={() => setStatusFilter('Inactive')} style={{ cursor: 'pointer' }}>
              <div className="staff-role-summary-name" style={{ color: 'var(--accent-red)' }}>● Inactive</div>
              <span className="staff-role-count" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)' }}>{stats.inactive}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ADD / EDIT MODAL ══ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="staff-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '👤 Add Staff Member' : '✏️ Edit Staff Member'}</h2>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}><X size={17} /></button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                {submitError && <div className="submit-error-box">{submitError}</div>}

                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" className="premium-input" name="full_name" required
                    value={formData.full_name} onChange={handleFormChange}
                    placeholder="Dr. Aisha Ibrahim" />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input type="email" className="premium-input" name="email" required
                    value={formData.email} onChange={handleFormChange}
                    placeholder="email@cayush.com" />
                </div>

                {modalMode === 'add' && (
                  <div className="form-group">
                    <label>Password *</label>
                    <input type="password" className="premium-input" name="password" required minLength={8}
                      value={formData.password} onChange={handleFormChange}
                      placeholder="Minimum 8 characters" />
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Role *</label>
                    <select className="premium-input" name="role" required value={formData.role} onChange={handleFormChange}>
                      <option>Admin</option>
                      <option>Doctor</option>
                      <option>Receptionist</option>
                      <option>Pharmacist</option>
                      <option>Lab Technician</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="text" className="premium-input" name="phone"
                      value={formData.phone} onChange={handleFormChange}
                      placeholder="+252 61..." />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="premium-btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>
                    {isSubmitting
                      ? <><Loader2 className="spinner" size={14} /> Saving...</>
                      : modalMode === 'add' ? 'Create Account' : 'Save Changes'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
