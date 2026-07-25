import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Building2, User, Key, Users, Activity,
  Loader2, X, Edit, Trash2, Eye, Filter, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Departments.css';

/* ── Default seed data ── */
const DEFAULT_DEPARTMENTS = [
  { id: 'dep1', name: 'General OPD',          room: 'Room 3', lead: 'Dr. Aisha Ibrahim', staff_count: 2, status: 'Active',   description: 'Outpatient consultations and general wellness checks.',              occupancy: 'Normal' },
  { id: 'dep2', name: 'Dental Clinic',         room: 'Room 5', lead: 'Dr. Hassan Ali',   staff_count: 1, status: 'Active',   description: 'Orthodontics, cosmetic dentistry, and oral surgery.',                occupancy: 'Normal' },
  { id: 'dep3', name: 'Pediatrics Department', room: 'Room 2', lead: 'Dr. Aisha Ibrahim', staff_count: 1, status: 'Active',  description: 'Specialized healthcare for infants, kids, and adolescents.',         occupancy: 'Normal' },
  { id: 'dep4', name: 'Gynecology Unit',       room: 'Room 4', lead: 'Dr. Maryan Ahmed', staff_count: 1, status: 'Active',   description: 'Maternal health, prenatal care, and reproductive treatment.',         occupancy: 'Busy'   },
  { id: 'dep5', name: 'Orthopedics & Orthotics', room: 'Room 6', lead: 'Dr. Hassan Ali', staff_count: 1, status: 'Active',  description: 'Bone fractures, joint replacements, and muscle therapies.',           occupancy: 'Normal' },
];

const PIE_COLORS = ['#2E7D32', '#C8247E', '#3B82F6', '#F59E0B', '#8B5CF6'];

const OCC_COLORS = {
  Normal:       { fill: 'var(--primary-brand)', bg: 'rgba(46,125,50,0.12)' },
  Busy:         { fill: 'var(--accent-orange)',  bg: 'rgba(245,158,11,0.12)' },
  Understaffed: { fill: 'var(--accent-red)',     bg: 'rgba(239,68,68,0.12)' },
  Closed:       { fill: 'var(--text-muted)',     bg: 'rgba(100,116,139,0.12)' },
};

/* ── Custom tooltip ── */
const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 14px', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }}>
      <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>{label}</p>
      <p style={{ color: 'var(--primary-brand)' }}>{payload[0].value} staff</p>
    </div>
  );
};

const Departments = () => {
  const [departments, setDepartments]         = useState([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [isUsingLocal, setIsUsingLocal]       = useState(false);

  /* Filters */
  const [searchTerm,    setSearchTerm]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [occFilter,     setOccFilter]     = useState('All');

  /* Modals */
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [modalMode,     setModalMode]     = useState('add'); // 'add'|'edit'|'view'
  const [selectedDept,  setSelectedDept]  = useState(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitError,   setSubmitError]   = useState('');

  const { user } = useAuth();

  const emptyForm = { id: '', name: '', room: '', lead: '', description: '', status: 'Active', staff_count: 1, occupancy: 'Normal' };
  const [formData, setFormData] = useState(emptyForm);

  /* ── Fetch ── */
  useEffect(() => { fetchDepartments(); }, []);

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      setDepartments(data || []);
      setIsUsingLocal(false);
    } catch {
      setIsUsingLocal(true);
      const local = localStorage.getItem('hospital_departments');
      if (local) { setDepartments(JSON.parse(local)); }
      else { localStorage.setItem('hospital_departments', JSON.stringify(DEFAULT_DEPARTMENTS)); setDepartments(DEFAULT_DEPARTMENTS); }
    } finally { setIsLoading(false); }
  };

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    return departments.filter(d => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !term || d.name?.toLowerCase().includes(term) || d.lead?.toLowerCase().includes(term) || d.room?.toLowerCase().includes(term) || d.description?.toLowerCase().includes(term);
      const matchStatus = statusFilter === 'All' || d.status === statusFilter;
      const matchOcc    = occFilter    === 'All' || d.occupancy === occFilter;
      return matchSearch && matchStatus && matchOcc;
    });
  }, [departments, searchTerm, statusFilter, occFilter]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:    departments.length,
    active:   departments.filter(d => d.status === 'Active').length,
    inactive: departments.filter(d => d.status === 'Inactive').length,
    totalStaff: departments.reduce((s, d) => s + (d.staff_count || 0), 0),
  }), [departments]);

  /* ── Chart data ── */
  const barData = useMemo(() =>
    departments.slice(0, 6).map(d => ({ name: d.name.split(' ')[0], staff: d.staff_count || 0 })),
  [departments]);

  const pieData = useMemo(() => {
    const counts = {};
    departments.forEach(d => { counts[d.occupancy || 'Normal'] = (counts[d.occupancy || 'Normal'] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [departments]);

  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  /* Occupancy breakdown for bar chart */
  const occBreakdown = useMemo(() => {
    const keys = ['Normal','Busy','Understaffed','Closed'];
    return keys.map(k => ({ key: k, count: departments.filter(d => (d.occupancy || 'Normal') === k).length }))
      .filter(o => o.count > 0);
  }, [departments]);

  /* ── CRUD ── */
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: name === 'staff_count' ? parseInt(value) || 0 : value }));
  };

  const openAdd  = ()    => { setFormData(emptyForm); setModalMode('add');  setSubmitError(''); setIsModalOpen(true); };
  const openEdit = (d)   => { setSelectedDept(d); setFormData({ id: d.id, name: d.name||'', room: d.room||'', lead: d.lead||'', description: d.description||'', status: d.status||'Active', staff_count: d.staff_count||0, occupancy: d.occupancy||'Normal' }); setModalMode('edit'); setSubmitError(''); setIsModalOpen(true); };
  const openView = (d)   => { setSelectedDept(d); setModalMode('view'); setIsModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true); setSubmitError('');
    try {
      if (isUsingLocal) {
        let list = [...departments];
        if (modalMode === 'add') list.unshift({ ...formData, id: `local-${Date.now()}` });
        else list = list.map(d => d.id === formData.id ? { ...formData } : d);
        localStorage.setItem('hospital_departments', JSON.stringify(list));
        setDepartments(list);
      } else {
        if (modalMode === 'add') {
          const { id, ...payload } = formData;
          const { data, error } = await supabase.from('departments').insert([payload]).select();
          if (error) throw error;
          setDepartments([data[0], ...departments]);
        } else {
          const { error } = await supabase.from('departments').update({ name: formData.name, room: formData.room, lead: formData.lead, description: formData.description, status: formData.status, staff_count: formData.staff_count, occupancy: formData.occupancy }).eq('id', formData.id);
          if (error) throw error;
          setDepartments(departments.map(d => d.id === formData.id ? { ...formData } : d));
        }
      }
      setIsModalOpen(false);
    } catch (err) { setSubmitError(err.message || 'Error saving.'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete department: ${name}?`)) return;
    try {
      if (isUsingLocal) { const l = departments.filter(d => d.id !== id); localStorage.setItem('hospital_departments', JSON.stringify(l)); setDepartments(l); }
      else { const { error } = await supabase.from('departments').delete().eq('id', id); if (error) throw error; setDepartments(departments.filter(d => d.id !== id)); }
    } catch (err) { alert('Failed to delete department.'); }
  };

  /* ── KPI cards ── */
  const kpiCards = [
    { label: 'Total Departments', value: stats.total,     sub: 'All registered',   color: 'blue',   Icon: Building2 },
    { label: 'Active',            value: stats.active,    sub: 'Currently running', color: 'green',  Icon: Activity  },
    { label: 'Inactive',          value: stats.inactive,  sub: 'Not operating',     color: 'orange', Icon: Building2 },
    { label: 'Total Doctors',     value: stats.totalStaff,sub: 'Across all depts',  color: 'pink',   Icon: Users     },
  ];

  return (
    <div className="departments-page">

      {/* ══ HEADER ══ */}
      <div className="departments-header-section">
        <div className="dept-header-left">
          <h2>Hospital Departments</h2>
          <p className="breadcrumb-path">Dashboard / <span>Departments</span></p>
        </div>
        <div className="dept-header-right">
          <button className="premium-btn" onClick={openAdd}>
            <Plus size={16} /> Add Department
          </button>
        </div>
      </div>

      {/* ══ KPI RIBBON ══ */}
      <div className="dept-kpi-ribbon">
        {kpiCards.map(({ label, value, sub, color, Icon }) => (
          <div className="dept-kpi-card" key={label}>
            <div className={`dept-kpi-icon ${color}`}><Icon size={18} /></div>
            <div className="dept-kpi-info">
              <h3>{value}</h3>
              <p>{label}</p>
              <span className="kpi-sub">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ══ CHARTS ROW ══ */}
      <div className="dept-charts-row">
        {/* Bar: Staff per dept */}
        <div className="dept-chart-panel">
          <div className="dept-chart-header">
            <h3>Staff by Department</h3>
            <span className="dept-chart-badge">{stats.totalStaff} Doctors Total</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={26}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(46,125,50,0.06)' }} />
              <Bar dataKey="staff" fill="var(--primary-brand)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy breakdown */}
        <div className="dept-chart-panel">
          <div className="dept-chart-header">
            <h3>Departments by Occupancy</h3>
            <span className="dept-chart-badge">{departments.length} Depts</span>
          </div>
          {departments.length > 0 ? (
            <div className="dept-pie-wrap">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={54} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={(OCC_COLORS[entry.name] || OCC_COLORS.Normal).fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="dept-pie-legend">
                {pieData.map((item) => (
                  <div className="dept-pie-legend-row" key={item.name}>
                    <div className="dept-pie-legend-left">
                      <div className="dept-pie-dot" style={{ background: (OCC_COLORS[item.name] || OCC_COLORS.Normal).fill }} />
                      {item.name}
                    </div>
                    <span className="dept-pie-pct">
                      {totalPie ? Math.round((item.value / totalPie) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</div>
          )}
        </div>
      </div>

      {/* ══ FILTER TOOLBAR ══ */}
      {isUsingLocal && (
        <div className="db-fallback-banner">
          ⚠️ Running in Local Storage Mode — departments table not found in database.
        </div>
      )}

      <div className="dept-filter-toolbar">
        <div className="dept-search-wrap">
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by name, head, room, or description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="dept-filter-select">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="dept-filter-select">
          <select value={occFilter} onChange={e => setOccFilter(e.target.value)}>
            <option value="All">All Occupancy</option>
            <option value="Normal">Normal</option>
            <option value="Busy">Busy</option>
            <option value="Understaffed">Understaffed</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <button className="dept-filter-btn"><Filter size={14} /> Filter</button>
        <button className="dept-reset-btn" onClick={() => { setSearchTerm(''); setStatusFilter('All'); setOccFilter('All'); }}>
          <RefreshCw size={14} /> Reset
        </button>
      </div>

      {/* ══ CONTENT SPLIT ══ */}
      <div className="dept-content-split">

        {/* Left: Departments List */}
        <div className="dept-list-panel">
          <div className="dept-list-panel-header">
            <h4>All Departments ({filtered.length})</h4>
          </div>

          {isLoading ? (
            <div className="dept-loading">
              <Loader2 className="spinner" size={28} color="var(--primary-brand)" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="dept-empty-state">
              <Building2 size={36} />
              <p>No departments found matching your filters.</p>
            </div>
          ) : (
            filtered.map(dep => (
              <div
                key={dep.id}
                className={`dept-row-item ${dep.status?.toLowerCase() === 'inactive' ? 'inactive' : ''}`}
              >
                <div className="dept-row-left">
                  <div className="dept-row-avatar"><Building2 size={20} /></div>
                  <div className="dept-row-info">
                    <h3 className="dept-row-name">{dep.name}</h3>
                    <p className="dept-row-desc">{dep.description || 'No description registered.'}</p>
                  </div>
                </div>

                <div className="dept-row-right">
                  <div className="dept-meta-grid">
                    <div className="dept-meta-item"><Key size={12} /><span>{dep.room || 'N/A'}</span></div>
                    <div className="dept-meta-item"><User size={12} /><span>{dep.lead || 'N/A'}</span></div>
                    <div className="dept-meta-item"><Users size={12} /><span>{dep.staff_count || 0} Doctors</span></div>
                    <div className="dept-meta-item"><Activity size={12} /><span>{dep.occupancy || 'Normal'}</span></div>
                  </div>

                  <span className={`status-pill ${dep.status?.toLowerCase() || 'active'}`}>
                    {dep.status || 'Active'}
                  </span>

                  <div className="dept-row-actions">
                    <button className="action-circular-btn view"   onClick={() => openView(dep)} title="View"><Eye size={13} /></button>
                    <button className="action-circular-btn edit"   onClick={() => openEdit(dep)} title="Edit"><Edit size={13} /></button>
                    <button className="action-circular-btn delete" onClick={() => handleDelete(dep.id, dep.name)} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Quick Summary */}
        <div className="dept-summary-panel">
          <div className="dept-summary-panel-header">
            <h4>Department Directory</h4>
          </div>
          <div className="dept-summary-list">
            {departments.slice(0, 8).map(dep => (
              <div className="dept-summary-card" key={dep.id} onClick={() => openView(dep)}>
                <div className="dept-summary-name">{dep.name}</div>
                <div className="dept-summary-meta">
                  <span>{dep.staff_count || 0} Doctors</span>
                  <span className={`status-pill ${dep.status?.toLowerCase() || 'active'}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                    {dep.status}
                  </span>
                </div>
              </div>
            ))}
            {departments.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No departments yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ MODAL ══ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="dept-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'add' ? '🏥 Add Department' : modalMode === 'edit' ? '✏️ Edit Department' : '📋 Department Details'}
              </h2>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}><X size={17} /></button>
            </div>

            <div className="modal-body">
              {/* VIEW MODE */}
              {modalMode === 'view' && selectedDept ? (
                <>
                  <div className="dept-view-hero">
                    <div className="dept-row-avatar" style={{ width: 52, height: 52, borderRadius: 14 }}>
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h3>{selectedDept.name}</h3>
                      <span className={`status-pill ${selectedDept.status?.toLowerCase() || 'active'}`}>{selectedDept.status}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                    {selectedDept.description || 'No description recorded.'}
                  </p>
                  <div className="dept-view-grid">
                    {[
                      { label: 'Location Room',    value: selectedDept.room         || 'N/A' },
                      { label: 'Department Head',  value: selectedDept.lead         || 'N/A' },
                      { label: 'Staff Count',      value: `${selectedDept.staff_count || 0} Doctors` },
                      { label: 'Occupancy Status', value: selectedDept.occupancy    || 'Normal' },
                    ].map(f => (
                      <div className="dept-view-field" key={f.label}>
                        <label>{f.label}</label>
                        <p>{f.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="modal-footer">
                    <button className="premium-btn-outline" onClick={() => setIsModalOpen(false)}>Close</button>
                    <button className="premium-btn" onClick={() => openEdit(selectedDept)}>Edit Department</button>
                  </div>
                </>
              ) : (
                /* ADD / EDIT FORM */
                <form onSubmit={handleSubmit}>
                  {submitError && <div className="submit-error-box">{submitError}</div>}

                  <div className="form-group">
                    <label>Department Name *</label>
                    <input type="text" className="premium-input" name="name" required
                      value={formData.name} onChange={handleFormChange}
                      placeholder="e.g. Gynecology Unit" />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea className="premium-input" name="description" rows={3}
                      value={formData.description} onChange={handleFormChange}
                      placeholder="Brief clinical functions..." />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Room / Location</label>
                      <input type="text" className="premium-input" name="room"
                        value={formData.room} onChange={handleFormChange} placeholder="e.g. Room 4" />
                    </div>
                    <div className="form-group">
                      <label>Department Head</label>
                      <input type="text" className="premium-input" name="lead"
                        value={formData.lead} onChange={handleFormChange} placeholder="e.g. Dr. Maryan Ahmed" />
                    </div>
                    <div className="form-group">
                      <label>Staff Count (Doctors)</label>
                      <input type="number" className="premium-input" name="staff_count"
                        min={0} value={formData.staff_count} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Occupancy Status</label>
                      <select className="premium-input" name="occupancy" value={formData.occupancy} onChange={handleFormChange}>
                        <option>Normal</option>
                        <option>Busy</option>
                        <option>Understaffed</option>
                        <option>Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select className="premium-input" name="status" value={formData.status} onChange={handleFormChange}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="premium-btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                    <button type="submit" className="premium-btn" disabled={isSubmitting}>
                      {isSubmitting
                        ? <><Loader2 className="spinner" size={14} /> Saving...</>
                        : modalMode === 'add' ? 'Create Department' : 'Save Changes'
                      }
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
