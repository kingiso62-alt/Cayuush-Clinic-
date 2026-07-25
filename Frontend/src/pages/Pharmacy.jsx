import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Filter, Edit, Trash2, Loader2, AlertCircle, Package, 
  TrendingDown, DollarSign, ClipboardList, CheckCircle, BellRing, X,
  Activity, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Pharmacy.css';

const Pharmacy = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [prescriptions, setPrescriptions] = useState([]);
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [selectedPrescriptionGroup, setSelectedPrescriptionGroup] = useState(null);
  const [modalMode, setModalMode] = useState('add');
  const [selectedMedId, setSelectedMedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();

  const initialFormState = {
    name: '', generic_name: '', category: 'Antibiotics',
    batch_number: '', expiry_date: '', quantity: '', unit_price: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => { fetchMedicines(); fetchPrescriptions(); }, []);

  const fetchPrescriptions = async () => {
    setIsLoadingPrescriptions(true);
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patients(full_name, patient_id), medicines(name, generic_name), profiles!doctor_id(full_name)')
        .order('created_at', { ascending: false });
      if (!error) setPrescriptions(data || []);
    } catch (err) { console.error(err); }
    finally { setIsLoadingPrescriptions(false); }
  };

  const groupedPrescriptions = useMemo(() => {
    const groups = {};
    prescriptions.forEach(p => {
      const pid = p.patient_id || p.patients?.patient_id || 'unknown';
      if (!groups[pid]) {
        groups[pid] = {
          patient_id: pid,
          patients: p.patients,
          items: [],
          status: 'Dispensed',
          latest_date: p.created_at,
          doctor_name: p.profiles?.full_name
        };
      }
      groups[pid].items.push(p);
      if (p.status === 'Pending') groups[pid].status = 'Pending';
      if (new Date(p.created_at) > new Date(groups[pid].latest_date)) {
        groups[pid].latest_date = p.created_at;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latest_date) - new Date(a.latest_date));
  }, [prescriptions]);

  const handleDispense = async (id) => {
    try {
      const { error } = await supabase.from('prescriptions').update({
        status: 'Dispensed', dispensed_by: user.id, dispensed_at: new Date().toISOString(),
      }).eq('id', id);
      if (!error) {
        setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status: 'Dispensed' } : p));
        setSelectedPrescriptionGroup(prev => {
          if(!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(p => p.id === id ? { ...p, status: 'Dispensed' } : p),
            status: prev.items.every(p => p.id === id || p.status === 'Dispensed') ? 'Dispensed' : 'Pending'
          };
        });
      }
    } catch (err) { console.error(err); }
  };

  const fetchMedicines = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('medicines').select('*').order('name', { ascending: true });
      if (error) throw error;
      setMedicines(data || []);
      setFilteredMedicines(data || []);
      applyFilters(data || [], searchTerm, selectedCategory);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const applyFilters = (meds, search, category) => {
    let result = [...meds];
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(m => m.name?.toLowerCase().includes(term) || m.generic_name?.toLowerCase().includes(term));
    }
    if (category !== 'All') result = result.filter(m => m.category === category);
    setFilteredMedicines(result);
  };

  const handleSearch = (e) => { const t = e.target.value; setSearchTerm(t); applyFilters(medicines, t, selectedCategory); };
  const handleCategoryChange = (e) => { const c = e.target.value; setSelectedCategory(c); applyFilters(medicines, searchTerm, c); };
  const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const calculateStatus = (qty, expiry) => {
    const expDate = new Date(expiry);
    if (expDate < new Date()) return 'Expired';
    if (qty <= 0) return 'Out of Stock';
    if (qty <= 20) return 'Low Stock';
    return 'In Stock';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const status = calculateStatus(parseInt(formData.quantity), formData.expiry_date);
      const payload = {
        name: formData.name, generic_name: formData.generic_name,
        category: formData.category, batch_number: formData.batch_number,
        expiry_date: formData.expiry_date, quantity: parseInt(formData.quantity),
        unit_price: parseFloat(formData.unit_price), status, created_by: user.id
      };
      if (modalMode === 'add') {
        const { data, error } = await supabase.from('medicines').insert([payload]).select();
        if (error) throw error;
        const newMeds = [data[0], ...medicines].sort((a, b) => a.name.localeCompare(b.name));
        setMedicines(newMeds); applyFilters(newMeds, searchTerm, selectedCategory);
      } else {
        const { error } = await supabase.from('medicines').update(payload).eq('id', selectedMedId);
        if (error) throw error;
        const updated = medicines.map(m => m.id === selectedMedId ? { ...m, ...payload } : m)
          .sort((a, b) => a.name.localeCompare(b.name));
        setMedicines(updated); applyFilters(updated, searchTerm, selectedCategory);
      }
      setIsModalOpen(false); setFormData(initialFormState);
    } catch (err) { console.error(err); alert('Failed to save medicine.'); }
    finally { setIsSubmitting(false); }
  };

  const openAddModal = () => { setFormData(initialFormState); setModalMode('add'); setSelectedMedId(null); setIsModalOpen(true); };
  const openEditModal = (med) => {
    setFormData({ name: med.name, generic_name: med.generic_name || '', category: med.category,
      batch_number: med.batch_number || '', expiry_date: med.expiry_date || '',
      quantity: med.quantity, unit_price: med.unit_price });
    setModalMode('edit'); setSelectedMedId(med.id); setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this medicine?')) return;
    try {
      const { error } = await supabase.from('medicines').delete().eq('id', id);
      if (error) throw error;
      const updated = medicines.filter(m => m.id !== id);
      setMedicines(updated); applyFilters(updated, searchTerm, selectedCategory);
    } catch (err) { console.error(err); }
  };

  const pendingCount = prescriptions.filter(p => p.status === 'Pending').length;

  const kpiCards = [
    { label: 'Total Items',   value: medicines.length,                                        sub: 'In catalog',   iconColor: 'green',  Icon: Package },
    { label: 'Low Stock',     value: medicines.filter(m => m.status === 'Low Stock').length,  sub: '≤ 20 units',   iconColor: 'orange', Icon: TrendingDown },
    { label: 'Out of Stock',  value: medicines.filter(m => m.status === 'Out of Stock').length,sub: 'Needs restock',iconColor: 'red',    Icon: AlertCircle },
    { label: 'Expired',       value: medicines.filter(m => m.status === 'Expired').length,    sub: 'Remove ASAP',  iconColor: 'pink',   Icon: BellRing },
  ];

  return (
    <div className="pharmacy-redesign-root">

      {/* ── Page Header ── */}
      <div className="pharmacy-page-header">
        <div className="pharmacy-title-block">
          <h1>Pharmacy</h1>
          <p className="pharmacy-breadcrumb">Dashboard / <span>Pharmacy</span></p>
        </div>

        <div className="pharmacy-header-right">
          {/* Segment Tabs */}
          <div className="pharmacy-segments-wrapper">
            {[
              { key: 'inventory',     label: '📦 Stock Inventory' },
              { key: 'prescriptions', label: `💊 Prescriptions${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pharmacy-segment-tab ${activeTab === tab.key ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'inventory' && (
            <button className="premium-btn" onClick={openAddModal}>
              <Plus size={17} /> Add Medicine
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Ribbon ── */}
      <div className="pharmacy-kpi-ribbon">
        {kpiCards.map(({ label, value, sub, iconColor, Icon }) => (
          <div className="kpi-mini-card" key={label}>
            <div className={`kpi-icon-box ${iconColor}`}>
              <Icon size={20} />
            </div>
            <div className="kpi-text-block">
              <h3>{value}</h3>
              <p>{label}</p>
              <span className="kpi-sub">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════ INVENTORY TAB ══════════════════════════════ */}
      {activeTab === 'inventory' && (
        <>
          {/* Toolbar */}
          <div className="pharmacy-toolbar">
            <div className="pharmacy-toolbar-left">
              <div className="pharmacy-search-bar">
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search medicine catalog..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>

              <div className="pharmacy-filter-select-wrap">
                <Filter size={14} className="pharmacy-filter-icon" />
                <select
                  className="pharmacy-filter-select"
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                >
                  <option value="All">All Categories</option>
                  <option value="Antibiotics">Antibiotics</option>
                  <option value="Painkillers">Painkillers</option>
                  <option value="Vitamins & Supplements">Vitamins &amp; Supplements</option>
                  <option value="Cardiovascular">Cardiovascular</option>
                  <option value="Respiratory">Respiratory</option>
                  <option value="Gastrointestinal">Gastrointestinal</option>
                </select>
              </div>
            </div>

            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {filteredMedicines.length} result{filteredMedicines.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="pharmacy-table-wrap">
            <div className="pharmacy-table-inner">
              {isLoading ? (
                <div className="pharmacy-loading">
                  <Loader2 className="spinner" size={32} color="var(--primary-brand)" />
                </div>
              ) : (
                <table className="pharmacy-data-table">
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Category</th>
                      <th>Batch &amp; Expiry</th>
                      <th>Stock Level</th>
                      <th>Unit Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedicines.map(med => {
                      const expired    = med.status === 'Expired';
                      const outOfStock = med.status === 'Out of Stock';
                      const lowStock   = med.status === 'Low Stock';
                      return (
                        <tr key={med.id} className={`${expired ? 'expired-row' : ''} ${outOfStock ? 'out-of-stock-row' : ''}`}>
                          <td>
                            <div className="medicine-name-wrapper">
                              <span className="medicine-name-span">{med.name}</span>
                              {expired    && <span className="alert-badge text-red"><BellRing size={11} /> Expired!</span>}
                              {outOfStock && <span className="alert-badge text-red"><AlertCircle size={11} /> Empty!</span>}
                              {lowStock   && <span className="alert-badge text-yellow"><AlertCircle size={11} /> Low</span>}
                            </div>
                            <div className="medicine-generic-span">{med.generic_name || 'No generic name'}</div>
                          </td>
                          <td><span className="category-pill-badge">{med.category}</span></td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{med.batch_number || 'N/A'}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Exp: {med.expiry_date}</div>
                          </td>
                          <td>
                            <span className="stock-qty-text">{med.quantity}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 4 }}>units</span>
                          </td>
                          <td><strong className="price-tag-text">${parseFloat(med.unit_price).toFixed(2)}</strong></td>
                          <td>
                            <span className={`status-badge ${
                              med.status === 'In Stock'  ? 'success' :
                              med.status === 'Low Stock' ? 'warning' : 'danger'
                            }`}>
                              {med.status}
                            </span>
                          </td>
                          <td>
                            <div className="pharmacy-action-triggers">
                              <button className="action-circular-btn edit" onClick={() => openEditModal(med)} title="Edit">
                                <Edit size={14} />
                              </button>
                              <button className="action-circular-btn delete" onClick={() => handleDelete(med.id)} title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMedicines.length === 0 && (
                      <tr>
                        <td colSpan="7">
                          <div className="pharmacy-empty-state">
                            <Package size={40} />
                            <p>No medicines found matching the active filters.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════ PRESCRIPTIONS TAB ══════════════════════════════ */}
      {activeTab === 'prescriptions' && (
        <div className="pharmacy-table-wrap">
          <div className="pharmacy-table-inner">
            {isLoadingPrescriptions ? (
              <div className="pharmacy-loading">
                <Loader2 className="spinner" size={32} color="var(--primary-brand)" />
              </div>
            ) : (
              <table className="pharmacy-data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Medicine</th>
                    <th>Dosage / Duration</th>
                    <th>Doctor</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedPrescriptions.map(group => (
                    <tr key={group.patient_id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{group.patients?.full_name || '—'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{group.patients?.patient_id}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{group.items.length} Medicines</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Prescribed</div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>Multiple dosages</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{group.doctor_name || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {new Date(group.latest_date).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`status-badge ${
                          group.status === 'Dispensed' ? 'success' :
                          group.status === 'Cancelled' ? 'danger' : 'warning'
                        }`}>{group.status}</span>
                      </td>
                      <td>
                        <button
                          className="premium-btn-outline"
                          style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                          onClick={() => { setSelectedPrescriptionGroup(group); setIsPrescriptionModalOpen(true); }}
                        >
                          <Eye size={14} style={{ marginRight: 4 }} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {groupedPrescriptions.length === 0 && (
                    <tr>
                      <td colSpan="7">
                        <div className="pharmacy-empty-state">
                          <ClipboardList size={40} />
                          <p>No prescriptions found yet.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════ ADD / EDIT MODAL ══════════════════════════════ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '➕ Add New Medicine' : '✏️ Edit Medicine Details'}</h2>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Medicine Name *</label>
                    <input type="text" className="premium-input" name="name" required value={formData.name} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label>Generic Name</label>
                    <input type="text" className="premium-input" name="generic_name" value={formData.generic_name} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select className="premium-input" name="category" required value={formData.category} onChange={handleFormChange}>
                      <option>Antibiotics</option>
                      <option>Painkillers</option>
                      <option>Vitamins &amp; Supplements</option>
                      <option>Cardiovascular</option>
                      <option>Respiratory</option>
                      <option>Gastrointestinal</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Batch Number *</label>
                    <input type="text" className="premium-input" name="batch_number" required value={formData.batch_number} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date *</label>
                    <input type="date" className="premium-input" name="expiry_date" required value={formData.expiry_date} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input type="number" className="premium-input" name="quantity" required value={formData.quantity} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label>Unit Price ($) *</label>
                    <input type="number" step="0.01" className="premium-input" name="unit_price" required value={formData.unit_price} onChange={handleFormChange} />
                  </div>
                </div>

                <div className="modal-footer" style={{ marginTop: 24, padding: '16px 0 0', background: 'transparent', border: 'none' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>
                    {isSubmitting
                      ? <><Loader2 className="spinner" size={16} /> Saving...</>
                      : modalMode === 'add' ? 'Save Medicine' : 'Update Details'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}      {/* ══ PATIENT PRESCRIPTIONS MODAL (professional preview with print layout) ══ */}
      {isPrescriptionModalOpen && selectedPrescriptionGroup && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setIsPrescriptionModalOpen(false)}>
          <div className="modal-content" style={{ width: '850px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Prescription Preview &amp; Actions</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#005f54', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🖨️ Print Prescription
                </button>
                <button className="close-modal-btn" onClick={() => setIsPrescriptionModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left Panel: Preview */}
              <div style={{ flex: 1, padding: '30px', overflowY: 'auto', background: '#fff', color: '#1a1a1a', borderRight: '1px solid var(--border-color)' }} id="pharmacy-print-area">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <img src="/logo.png" alt="Logo" style={{ height: 60, width: 60, objectFit: 'contain' }} />
                    <div>
                      <h1 style={{ color: '#800000', fontFamily: 'serif', fontSize: '1.6rem', fontWeight: 'bold', margin: 0 }}>
                        {selectedPrescriptionGroup.doctor_name || 'Dr Aisho Ibrahim Hoji, MBBS, MD'}
                      </h1>
                      <p style={{ color: '#555', fontSize: '0.95rem', fontWeight: 'bold', margin: '4px 0 2px 0' }}>
                        Obstetrics, Gynaecology &amp; Infertility
                      </p>
                      <p style={{ color: '#777', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>
                        Mogadishu, Somalia
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=CayushClinic-${selectedPrescriptionGroup.patients?.full_name || 'Patient'}&color=000000&bgcolor=ffffff`}
                      alt="QR"
                      style={{ width: '60px', height: '60px', marginBottom: '4px' }}
                    />
                    <span style={{ fontSize: '0.78rem', color: '#111', fontWeight: 'bold' }}>+252 61 9639994</span>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '4px', background: '#b01d5d', margin: '10px 0 20px 0' }} />

                {/* Rx Title */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: 'bold', color: '#b01d5d', fontFamily: 'serif' }}>R</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#005f54', letterSpacing: '1px', textTransform: 'uppercase' }}>Prescription</span>
                </div>

                {/* Patient Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                      <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Patient:</span>
                      <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{selectedPrescriptionGroup.patients?.full_name || '—'}</span>
                    </div>
                    <div style={{ width: '200px', display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                      <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Date:</span>
                      <span style={{ fontSize: '0.95rem' }}>{new Date(selectedPrescriptionGroup.latest_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                      <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Age:</span>
                      <span style={{ fontSize: '0.95rem' }}>{selectedPrescriptionGroup.patients?.age || '—'}</span>
                    </div>
                    <div style={{ width: '200px', display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                      <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Gender:</span>
                      <span style={{ fontSize: '0.95rem' }}>{selectedPrescriptionGroup.patients?.gender || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Rx Body */}
                <div style={{ minHeight: '200px' }}>
                  <div style={{ fontSize: '2.8rem', color: '#b01d5d', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginBottom: '8px' }}>Rx</div>
                  <div style={{ paddingLeft: '20px' }}>
                    {selectedPrescriptionGroup.items.map((m, i) => (
                      <div key={m.id} style={{ marginBottom: '12px', fontSize: '1.05rem', color: '#222', display: 'flex', gap: '15px' }}>
                        <span style={{ fontWeight: 'bold', color: '#b01d5d' }}>{i + 1}.</span>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>{m.medicines?.name}</span> 
                          {m.dosage && <span style={{ marginLeft: '10px', color: '#444' }}>({m.dosage})</span>}
                          {m.duration && <span style={{ marginLeft: '15px', color: '#005f54', fontStyle: 'italic', fontSize: '0.9rem' }}>— {m.duration}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '30px' }}>
                  <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                    <span>Next visit: </span>
                    <span style={{ borderBottom: '1px solid #999', minWidth: '100px', display: 'inline-block' }}>{selectedPrescriptionGroup.items[0]?.notes || '—'}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '1px', background: '#9ca3af', width: '180px', marginBottom: '6px' }} />
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Doctor's Signature &amp; Stamp</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#777', marginTop: '24px', paddingTop: '10px', borderTop: '2px dashed #eee' }}>
                  Cayush Clinic • +252 61 9639994 • Mogadishu, Somalia
                </div>
              </div>

              {/* Right Panel: Actions / Dispensing */}
              <div style={{ width: '320px', padding: '24px', background: 'var(--bg-card)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-main)' }}>Dispense Medicines</h3>
                {selectedPrescriptionGroup.items.map(p => (
                  <div key={p.id} style={{ padding: '12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>{p.medicines?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{p.dosage} · {p.duration}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`status-badge ${p.status === 'Dispensed' ? 'success' : 'warning'}`} style={{ fontSize: '0.7rem' }}>
                        {p.status}
                      </span>
                      {p.status === 'Pending' ? (
                        <button
                          className="premium-btn"
                          onClick={() => handleDispense(p.id)}
                          style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <CheckCircle size={12} /> Dispense
                        </button>
                      ) : (
                        <span style={{ color: 'var(--accent-green)', fontSize: '0.78rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ Done
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pharmacy;
