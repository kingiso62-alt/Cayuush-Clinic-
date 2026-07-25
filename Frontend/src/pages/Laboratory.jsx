import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Loader2, TestTube, CheckCircle, Clock,
  FileText, CheckSquare, Beaker, FlaskConical, RefreshCw, Filter, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sendWhatsApp } from '../lib/notifications';
import './Laboratory.css';

/* ── Palette ── */
const PIE_COLORS = ['#2E7D32', '#C8247E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

/* ── Eye SVG (inline) ── */
const Eye = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const Laboratory = () => {
  const [activeTab, setActiveTab] = useState('requests');

  /* Data */
  const [requests,  setRequests]  = useState([]);
  const [catalog,   setCatalog]   = useState([]);
  const [isLoadingRequests,  setIsLoadingRequests]  = useState(false);
  const [isLoadingCatalog,   setIsLoadingCatalog]   = useState(false);

  /* Filters */
  const [searchTerm,      setSearchTerm]      = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('All');
  const [statusFilter,    setStatusFilter]    = useState('All');

  /* Modals */
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isResultModalOpen,  setIsResultModalOpen]  = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [selectedRequest,    setSelectedRequest]    = useState(null);
  const [selectedPatientGroup, setSelectedPatientGroup] = useState(null);
  const [isSubmitting,       setIsSubmitting]       = useState(false);

  const { user } = useAuth();

  const [catalogForm, setCatalogForm] = useState({ test_name: '', category: 'Hematology', price: '' });
  const [resultForm,  setResultForm]  = useState({ result_text: '', notes: '' });

  /* ── Fetch ── */
  useEffect(() => {
    fetchRequests();
    fetchCatalog();
  }, []);

  const fetchRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('lab_requests')
        .select('*, patients(full_name, patient_id, drug_allergies, food_allergies, chronic_conditions, pregnancy_warning, previous_severe_reactions, infectious_disease_warning, special_care_instructions), lab_catalog(test_name, category)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data || []).filter(r =>
        !['radiology','imaging'].includes(r.lab_catalog?.category?.toLowerCase())
      ));
    } catch (e) { console.error(e); }
    finally { setIsLoadingRequests(false); }
  };

  const fetchCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const { data, error } = await supabase
        .from('lab_catalog').select('*')
        .order('category').order('test_name');
      if (error) throw error;
      setCatalog((data || []).filter(c =>
        !['radiology','imaging'].includes(c.category?.toLowerCase())
      ));
    } catch (e) { console.error(e); }
    finally { setIsLoadingCatalog(false); }
  };

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:     requests.length,
    pending:   requests.filter(r => r.status === 'Pending').length,
    completed: requests.filter(r => r.status === 'Completed').length,
    catalog:   catalog.length,
    today:     requests.filter(r =>
      new Date(r.created_at).toDateString() === new Date().toDateString()
    ).length,
  }), [requests, catalog]);

  /* ── Chart Data ── */
  const barData = useMemo(() => {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return days.map((day, i) => {
      const now = new Date();
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() - now.getDay() + i + 1);
      const count = requests.filter(r => {
        const d = new Date(r.created_at);
        return d.toDateString() === dayDate.toDateString();
      }).length;
      return { day, count };
    });
  }, [requests]);

  const pieData = useMemo(() => {
    const cats = {};
    requests.forEach(r => {
      const c = r.lab_catalog?.category || 'Other';
      cats[c] = (cats[c] || 0) + 1;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [requests]);

  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    return requests.filter(r => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !term ||
        r.patients?.full_name?.toLowerCase().includes(term) ||
        r.patients?.patient_id?.toLowerCase().includes(term) ||
        r.lab_catalog?.test_name?.toLowerCase().includes(term);
      const matchCat    = categoryFilter === 'All' || r.lab_catalog?.category === categoryFilter;
      const matchStatus = statusFilter   === 'All' || r.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [requests, searchTerm, categoryFilter, statusFilter]);

  /* Group requests by patient */
  const groupedPatients = useMemo(() => {
    const groups = {};
    filtered.forEach(req => {
      const pid = req.patient_id || req.patients?.patient_id || 'unknown';
      if (!groups[pid]) {
        groups[pid] = {
          patient_id: pid,
          patients: req.patients,
          requests: [],
          status: 'Completed',
          latest_date: req.created_at
        };
      }
      groups[pid].requests.push(req);
      if (req.status === 'Pending') {
        groups[pid].status = 'Pending';
      }
      if (new Date(req.created_at) > new Date(groups[pid].latest_date)) {
        groups[pid].latest_date = req.created_at;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latest_date) - new Date(a.latest_date));
  }, [filtered]);

  /* Unique categories for filter */
  const categories = useMemo(() => {
    const s = new Set(requests.map(r => r.lab_catalog?.category).filter(Boolean));
    return Array.from(s);
  }, [requests]);

  /* Today's queue (pending today) */
  const todayQueue = useMemo(() =>
    requests.filter(r => {
      const isToday = new Date(r.created_at).toDateString() === new Date().toDateString();
      return isToday;
    }),
  [requests]);

  /* Group today's queue by patient */
  const todayQueueGrouped = useMemo(() => {
    const groups = {};
    todayQueue.forEach(req => {
      const pid = req.patient_id || req.patients?.patient_id || 'unknown';
      if (!groups[pid]) {
        groups[pid] = {
          patient_id: pid,
          patients: req.patients,
          requests: [],
          status: 'Completed'
        };
      }
      groups[pid].requests.push(req);
      if (req.status === 'Pending') groups[pid].status = 'Pending';
    });
    return Object.values(groups).slice(0, 8); // Take top 8 patients
  }, [todayQueue]);

  /* ── Actions ── */
  const handleAddCatalog = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('lab_catalog').insert([{
        test_name: catalogForm.test_name,
        category:  catalogForm.category,
        price:     parseFloat(catalogForm.price)
      }]).select();
      if (error) throw error;
      setCatalog([...data, ...catalog]);
      setIsCatalogModalOpen(false);
      setCatalogForm({ test_name: '', category: 'Hematology', price: '' });
    } catch (e) { console.error(e); alert('Failed to add test.'); }
    finally { setIsSubmitting(false); }
  };

  const openResultModal = (req) => {
    setSelectedRequest(req);
    setResultForm({ result_text: req.result_text || '', notes: req.notes || '' });
    setIsResultModalOpen(true);
  };

  const handleUpdateResult = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('lab_requests').update({
        result_text:  resultForm.result_text,
        notes:        resultForm.notes,
        status:       'Completed',
        performed_by: user.id,
        completed_at: new Date().toISOString()
      }).eq('id', selectedRequest.id)
        .select('*, patients(full_name,patient_id,phone), lab_catalog(test_name,category)');
      if (error) throw error;
      const updatedReq = data[0];
      setRequests(requests.map(r => r.id === selectedRequest.id ? updatedReq : r));
      setSelectedPatientGroup(prev => {
        if(!prev) return prev;
        return {
          ...prev,
          requests: prev.requests.map(r => r.id === selectedRequest.id ? updatedReq : r)
        };
      });
      setIsResultModalOpen(false);

      // 📱 Send WhatsApp notification to patient
      const phone = updatedReq.patients?.phone;
      if (phone) {
        const patientName = updatedReq.patients?.full_name || 'Bukaanka';
        const testName    = updatedReq.lab_catalog?.test_name || 'baaritaanka';
        sendWhatsApp(
          phone,
          `Salaan ${patientName}! Natiijadii ${testName} way diyaar tahay. Fadlan dhakhtarkaaga la xiriir ama Isbitaalka Cayush soo booqo. Tel: +252 61 9639994`
        );
      }
    } catch (e) { console.error(e); alert('Failed to save result.'); }
    finally { setIsSubmitting(false); }
  };

  const resetFilters = () => {
    setSearchTerm(''); setCategoryFilter('All'); setStatusFilter('All');
  };

  /* ── KPI Cards ── */
  const kpiCards = [
    { label: 'Total Requests', value: stats.total,     sub: 'All time',        color: 'blue',   Icon: TestTube      },
    { label: 'Pending',        value: stats.pending,   sub: 'Awaiting results', color: 'orange', Icon: Clock         },
    { label: 'Completed',      value: stats.completed, sub: 'Results entered',  color: 'green',  Icon: CheckCircle   },
    { label: "Today's Tests",  value: stats.today,     sub: 'Requested today',  color: 'pink',   Icon: FlaskConical  },
    { label: 'Catalog Tests',  value: stats.catalog,   sub: 'Available tests',  color: 'blue',   Icon: FileText      },
  ];

  /* ── Custom Tooltip ── */
  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 14px', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }}>
        <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>{label}</p>
        <p style={{ color: 'var(--primary-brand)' }}>{payload[0].value} tests</p>
      </div>
    );
  };

  return (
    <div className="lab-root">

      {/* ══ PAGE HEADER ══ */}
      <div className="lab-header-section">
        <div className="lab-header-left">
          <h2>Laboratory Center</h2>
          <p className="lab-breadcrumb">Dashboard / <span>Laboratory</span></p>
        </div>
        <div className="lab-header-right">
          <button className="premium-btn" onClick={() => setIsCatalogModalOpen(true)}>
            <Plus size={16} /> Add Test
          </button>
        </div>
      </div>

      {/* ══ KPI RIBBON ══ */}
      <div className="lab-kpi-ribbon">
        {kpiCards.map(({ label, value, sub, color, Icon }) => (
          <div className="lab-kpi-card" key={label}>
            <div className={`lab-kpi-icon-wrap ${color}`}><Icon size={18} /></div>
            <div className="lab-kpi-info">
              <h3>{value}</h3>
              <p>{label}</p>
              <span className="kpi-sub">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ══ CHARTS ROW ══ */}
      <div className="lab-charts-row">
        {/* Bar Chart */}
        <div className="lab-chart-panel">
          <div className="lab-chart-header">
            <h3>Tests This Week</h3>
            <span className="lab-chart-badge">This Week</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={28}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(46,125,50,0.06)' }} />
              <Bar dataKey="count" fill="var(--primary-brand)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="lab-chart-panel">
          <div className="lab-chart-header">
            <h3>Tests by Category</h3>
            <span className="lab-chart-badge">{totalPie} Total</span>
          </div>
          {pieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="lab-pie-legend">
                {pieData.map((item, i) => (
                  <div className="lab-pie-legend-item" key={item.name}>
                    <div className="lab-pie-legend-left">
                      <div className="lab-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {item.name}
                    </div>
                    <span className="lab-pie-pct">
                      {totalPie ? Math.round((item.value / totalPie) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <TestTube size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><br />No data yet
            </div>
          )}
        </div>
      </div>

      {/* ══ FILTER TOOLBAR ══ */}
      <div className="lab-filter-toolbar">
        {/* Search */}
        <div className="lab-search-wrap">
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by patient, test name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category */}
        <div className="lab-filter-select">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Status */}
        <div className="lab-filter-select">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <button className="lab-filter-btn"><Filter size={14} /> Filter</button>
        <button className="lab-reset-btn" onClick={resetFilters}><RefreshCw size={14} /> Reset</button>
      </div>

      {/* ══ MAIN CONTENT SPLIT ══ */}
      <div className="lab-content-split">

        {/* Left: Table Panel */}
        <div className="lab-table-panel">
          <div className="lab-table-panel-header">
            <h4>
              {activeTab === 'requests'
                ? `Test Requests (${filtered.length})`
                : `Test Catalog (${catalog.length})`}
            </h4>
            <div className="lab-tab-pills">
              <button
                className={`lab-tab-pill ${activeTab === 'requests' ? 'active' : ''}`}
                onClick={() => setActiveTab('requests')}
              >
                🧪 Requests
                {stats.pending > 0 && (
                  <span style={{ background: 'var(--accent-orange)', color: 'white', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', marginLeft: 4 }}>
                    {stats.pending}
                  </span>
                )}
              </button>
              <button
                className={`lab-tab-pill ${activeTab === 'catalog' ? 'active' : ''}`}
                onClick={() => setActiveTab('catalog')}
              >
                📋 Catalog
              </button>
            </div>
          </div>

          <div className="lab-table-inner">
            {/* REQUESTS TABLE */}
            {activeTab === 'requests' && (
              isLoadingRequests ? (
                <div className="lab-loading">
                  <Loader2 className="spinner" size={28} color="var(--primary-brand)" />
                </div>
              ) : (
                <table className="lab-data-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Test</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedPatients.map(group => (
                      <tr key={group.patient_id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{group.patients?.full_name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.patients?.patient_id}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{group.requests.length} Tests Requested</div>
                          <span className="lab-cat-pill">Multiple</span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(group.latest_date).toLocaleDateString()}
                        </td>
                        <td>
                          <span className={`status-badge ${group.status === 'Completed' ? 'success' : 'warning'}`}>
                            {group.status}
                          </span>
                        </td>
                        <td>
                          <button className="lab-action-btn primary" onClick={() => {
                            setSelectedPatientGroup(group);
                            setIsPatientModalOpen(true);
                          }}>
                            <Eye size={13} /> View Tests
                          </button>
                        </td>
                      </tr>
                    ))}
                    {groupedPatients.length === 0 && (
                      <tr><td colSpan="5">
                        <div className="lab-empty-state">
                          <TestTube size={36} /><p>No lab requests found.</p>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )
            )}

            {/* CATALOG TABLE */}
            {activeTab === 'catalog' && (
              isLoadingCatalog ? (
                <div className="lab-loading">
                  <Loader2 className="spinner" size={28} color="var(--primary-brand)" />
                </div>
              ) : (
                <table className="lab-data-table">
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.test_name}</td>
                        <td><span className="lab-cat-pill">{c.category}</span></td>
                        <td><strong>${parseFloat(c.price).toFixed(2)}</strong></td>
                        <td><span className="status-badge success">Active</span></td>
                      </tr>
                    ))}
                    {catalog.length === 0 && (
                      <tr><td colSpan="4">
                        <div className="lab-empty-state">
                          <Beaker size={36} /><p>No catalog tests. Add one.</p>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        {/* Right: Today's Queue */}
        <div className="lab-side-panel">
          <div className="lab-side-panel-header">
            <h4>Today's Lab Queue</h4>
            <a onClick={() => { setStatusFilter('All'); setActiveTab('requests'); }}>View All</a>
          </div>
          <div className="lab-queue-list">
            {todayQueueGrouped.length > 0 ? todayQueueGrouped.map(group => (
              <div className="lab-queue-item" key={group.patient_id} 
                   onClick={() => { setSelectedPatientGroup(group); setIsPatientModalOpen(true); }} 
                   style={{ cursor: 'pointer' }}>
                <div className={`lab-queue-dot ${group.status === 'Completed' ? 'completed' : 'pending'}`} />
                <div className="lab-queue-info">
                  <div className="lab-queue-name">{group.patients?.full_name || '—'}</div>
                  <div className="lab-queue-test">{group.requests.length} Tests Requested</div>
                </div>
                <span className={`status-badge ${group.status === 'Completed' ? 'success' : 'warning'}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                  {group.status}
                </span>
              </div>
            )) : (
              <div className="lab-no-queue">
                <TestTube size={24} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                No lab tests today.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ ADD CATALOG MODAL ══ */}
      {isCatalogModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCatalogModalOpen(false)}>
          <div className="lab-center-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Lab Test</h2>
              <button className="close-modal-btn" onClick={() => setIsCatalogModalOpen(false)}><X size={17} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddCatalog}>
                <div className="form-group">
                  <label>Test Name *</label>
                  <input type="text" className="premium-input" required
                    value={catalogForm.test_name}
                    onChange={e => setCatalogForm({ ...catalogForm, test_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select className="premium-input" required
                    value={catalogForm.category}
                    onChange={e => setCatalogForm({ ...catalogForm, category: e.target.value })}>
                    <option>Hematology</option>
                    <option>Biochemistry</option>
                    <option>Microbiology</option>
                    <option>Hormonal</option>
                    <option>Pathology</option>
                    <option>Radiology</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price ($) *</label>
                  <input type="number" step="0.01" className="premium-input" required
                    value={catalogForm.price}
                    onChange={e => setCatalogForm({ ...catalogForm, price: e.target.value })} />
                </div>
                <div className="modal-footer">
                  <button type="button" className="premium-btn-outline" onClick={() => setIsCatalogModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="spinner" size={14} /> Saving...</> : 'Save Test'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ PATIENT LAB MODAL (right slide) ══ */}
      {isPatientModalOpen && selectedPatientGroup && (
        <div className="modal-overlay" style={{ justifyContent: 'flex-end', alignItems: 'stretch', zIndex: 1000 }}
          onClick={() => setIsPatientModalOpen(false)}>
          <div className="lab-slide-modal" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🩺 Tests for {selectedPatientGroup.patients?.full_name}</h2>
              <button className="close-modal-btn" onClick={() => setIsPatientModalOpen(false)}><X size={17} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              {selectedPatientGroup.patients && (selectedPatientGroup.patients.drug_allergies || selectedPatientGroup.patients.food_allergies || selectedPatientGroup.patients.chronic_conditions || selectedPatientGroup.patients.pregnancy_warning || selectedPatientGroup.patients.previous_severe_reactions || selectedPatientGroup.patients.infectious_disease_warning || selectedPatientGroup.patients.special_care_instructions) && (
                 <div style={{ background: '#FEF2F2', border: '1px dashed #EF4444', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '0.8rem', color: '#B91C1C' }}>
                   <div style={{ fontWeight: 'bold', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>⚠️ CRITICAL PATIENT ALERTS</div>
                   <ul style={{ margin: 0, paddingLeft: '16px' }}>
                     {selectedPatientGroup.patients.drug_allergies && <li><strong>Drug Allergies:</strong> {selectedPatientGroup.patients.drug_allergies}</li>}
                     {selectedPatientGroup.patients.food_allergies && <li><strong>Food Allergies:</strong> {selectedPatientGroup.patients.food_allergies}</li>}
                     {selectedPatientGroup.patients.chronic_conditions && <li><strong>Chronic:</strong> {selectedPatientGroup.patients.chronic_conditions}</li>}
                     {selectedPatientGroup.patients.pregnancy_warning && <li><strong>Pregnancy Warning:</strong> Patient is PREGNANT</li>}
                     {selectedPatientGroup.patients.previous_severe_reactions && <li><strong>Severe Reactions:</strong> {selectedPatientGroup.patients.previous_severe_reactions}</li>}
                     {selectedPatientGroup.patients.infectious_disease_warning && <li><strong>Infectious Disease:</strong> {selectedPatientGroup.patients.infectious_disease_warning}</li>}
                     {selectedPatientGroup.patients.special_care_instructions && <li><strong>Special Instructions:</strong> {selectedPatientGroup.patients.special_care_instructions}</li>}
                   </ul>
                 </div>
               )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedPatientGroup.requests.map(req => (
                  <div key={req.id} style={{
                    background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                    padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                        {req.lab_catalog?.test_name}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className={`status-badge ${req.status === 'Completed' ? 'success' : 'warning'}`} style={{ fontSize: '0.65rem' }}>
                          {req.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div>
                       {req.status === 'Pending' ? (
                         <button className="lab-action-btn primary" onClick={() => openResultModal(req)}>
                           <CheckSquare size={13} /> Enter Result
                         </button>
                       ) : (
                         <button className="lab-action-btn outline" onClick={() => openResultModal(req)}>
                           <Eye size={13} /> View
                         </button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ RESULT MODAL (right slide) ══ */}
      {isResultModalOpen && selectedRequest && (
        <div className="modal-overlay" style={{ justifyContent: 'flex-end', alignItems: 'stretch', zIndex: 1050 }}
          onClick={() => setIsResultModalOpen(false)}>
          <div className="lab-slide-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedRequest.status === 'Pending' ? '🔬 Enter Lab Result' : '📄 View Lab Result'}</h2>
              <button className="close-modal-btn" onClick={() => setIsResultModalOpen(false)}><X size={17} /></button>
            </div>
            <div className="modal-body">
              {/* Patient info card */}
              <div className="lab-result-info-card">
                {[
                  { label: 'Patient',   value: selectedRequest.patients?.full_name,      cls: '' },
                  { label: 'ID',        value: selectedRequest.patients?.patient_id,      cls: '' },
                  { label: 'Test',      value: selectedRequest.lab_catalog?.test_name,    cls: 'highlight' },
                  { label: 'Category',  value: selectedRequest.lab_catalog?.category,     cls: '' },
                  { label: 'Requested', value: new Date(selectedRequest.created_at).toLocaleDateString(), cls: '' },
                ].map(row => (
                  <div className="lab-result-info-row" key={row.label}>
                    <span className="lab-info-label">{row.label}</span>
                     <span className={`lab-info-value ${row.cls}`}>{row.value || '—'}</span>
                   </div>
                 ))}
               </div>

               {selectedRequest.patients && (selectedRequest.patients.drug_allergies || selectedRequest.patients.food_allergies || selectedRequest.patients.chronic_conditions || selectedRequest.patients.pregnancy_warning || selectedRequest.patients.previous_severe_reactions || selectedRequest.patients.infectious_disease_warning || selectedRequest.patients.special_care_instructions) && (
                 <div style={{ background: '#FEF2F2', border: '1px dashed #EF4444', borderRadius: '8px', padding: '12px', margin: '0 20px 16px 20px', fontSize: '0.8rem', color: '#B91C1C' }}>
                   <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ PATIENT CRITICAL ALERTS:</div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                     {selectedRequest.patients.drug_allergies && <span style={{ background: '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>Drug Allergy: {selectedRequest.patients.drug_allergies}</span>}
                     {selectedRequest.patients.pregnancy_warning && <span style={{ background: '#FCE7F3', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PREGNANT</span>}
                     {selectedRequest.patients.infectious_disease_warning && <span style={{ background: '#FEF2F2', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Infectious: {selectedRequest.patients.infectious_disease_warning}</span>}
                     {selectedRequest.patients.special_care_instructions && <span style={{ background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>Special Care: {selectedRequest.patients.special_care_instructions}</span>}
                   </div>
                 </div>
               )}

               <form onSubmit={handleUpdateResult}>
                <div className="form-group">
                  <label>Result / Findings *</label>
                  <textarea className="premium-input" rows={6} required
                    value={resultForm.result_text}
                    onChange={e => setResultForm({ ...resultForm, result_text: e.target.value })}
                    disabled={selectedRequest.status === 'Completed'}
                    placeholder="Enter lab findings here..." />
                </div>
                <div className="form-group">
                  <label>Additional Notes</label>
                  <input type="text" className="premium-input"
                    value={resultForm.notes}
                    onChange={e => setResultForm({ ...resultForm, notes: e.target.value })}
                    disabled={selectedRequest.status === 'Completed'}
                    placeholder="Any extra notes..." />
                </div>
                {selectedRequest.status === 'Pending' && (
                  <div className="modal-footer">
                    <button type="button" className="premium-btn-outline" onClick={() => setIsResultModalOpen(false)}>Cancel</button>
                    <button type="submit" className="premium-btn" disabled={isSubmitting}>
                      {isSubmitting
                        ? <><Loader2 className="spinner" size={14} /> Submitting...</>
                        : <><CheckCircle size={14} /> Complete Test</>}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Laboratory;
