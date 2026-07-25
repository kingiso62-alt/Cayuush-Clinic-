import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, Loader2, ClipboardList, CheckCircle,
  Clock, FileText, Beaker, Trash2, X, AlertTriangle,
  Award, Play, CheckSquare, Edit, ShieldAlert
} from 'lucide-react';
import './Procedures.css';

const Procedures = () => {
  const { user } = useAuth();
  
  // Lists
  const [procedures, setProcedures] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [medicines, setMedicines] = useState([]); // Pharmacy inventory for supplies
  
  // Loading & UI
  const [activeTab, setActiveTab] = useState('procedures'); // 'procedures', 'catalog'
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modals
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form States
  const [catalogForm, setCatalogForm] = useState({
    name: '', category: 'Minor Surgery', default_price: '',
    required_department: '', required_equipment: '', preparation_instructions: ''
  });

  const [scheduleForm, setScheduleForm] = useState({
    patient_id: '', doctor_id: '', assistants: '',
    procedure_catalog_id: '', procedure_room: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '09:00', pre_procedure_assessment: '',
    consent_confirmed: false, anaesthesia_type: 'None',
    procedure_notes: '', complications: '', post_procedure_instructions: '',
    follow_up_date: '', status: 'Planned', used_supplies: []
  });

  // Supplies Search State
  const [supplySearch, setSupplySearch] = useState('');
  const [showSupplyDropdown, setShowSupplyDropdown] = useState(false);

  useEffect(() => {
    fetchProcedures();
    fetchCatalog();
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [patRes, docRes, medRes] = await Promise.all([
        supabase.from('patients').select('id, full_name, patient_id, drug_allergies, food_allergies, chronic_conditions, pregnancy_warning, previous_severe_reactions, infectious_disease_warning, special_care_instructions').order('full_name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'Doctor').order('full_name'),
        supabase.from('medicines').select('*').gt('quantity', 0).order('name')
      ]);
      setPatients(patRes.data || []);
      setDoctors(docRes.data || []);
      setMedicines(medRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCatalog = async () => {
    try {
      const { data } = await supabase.from('procedure_catalog').select('*').order('name');
      setCatalog(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProcedures = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select(`
          *,
          patients (id, patient_id, full_name, age, gender),
          profiles:doctor_id (full_name),
          procedure_catalog (name, category, default_price)
        `)
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      setProcedures(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Create/Edit Catalog Handlers
  const handleCatalogSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...catalogForm,
        default_price: parseFloat(catalogForm.default_price) || 0
      };

      if (modalMode === 'add') {
        const { error } = await supabase.from('procedure_catalog').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('procedure_catalog').update(payload).eq('id', selectedItem.id);
        if (error) throw error;
      }
      setIsCatalogModalOpen(false);
      fetchCatalog();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Schedule Procedure Handlers
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isCompleting = scheduleForm.status === 'Completed' && (!selectedItem || selectedItem.status !== 'Completed');

      // 1. Create or Update Procedure
      let procData = null;
      if (modalMode === 'add') {
        const payload = {
          ...scheduleForm,
          created_by: user?.id,
          follow_up_date: scheduleForm.follow_up_date || null
        };
        const { data, error } = await supabase.from('procedures').insert([payload]).select().single();
        if (error) throw error;
        procData = data;
      } else {
        const payload = {
          ...scheduleForm,
          follow_up_date: scheduleForm.follow_up_date || null
        };
        const { data, error } = await supabase.from('procedures').update(payload).eq('id', selectedItem.id).select().single();
        if (error) throw error;
        procData = data;
      }

      // 2. Automated Completion Actions
      if (isCompleting && procData) {
        const targetCatalog = catalog.find(c => c.id === procData.procedure_catalog_id);
        const targetPatient = patients.find(p => p.id === procData.patient_id);
        const procedurePrice = targetCatalog ? parseFloat(targetCatalog.default_price) : 0;
        
        // A. Calculate billing total (Procedure Price + Used Supplies Cost)
        const suppliesTotal = scheduleForm.used_supplies.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0);
        const grandTotal = procedurePrice + suppliesTotal;
        const invNum = `INV-PR-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create Invoice
        const { data: invData, error: invError } = await supabase.from('invoices').insert([{
          invoice_number: invNum,
          patient_id: procData.patient_id,
          subtotal: grandTotal,
          total_amount: grandTotal,
          created_by: user.id,
          notes: `Billing for Procedure: ${targetCatalog?.name || 'Surgery'}`
        }]).select().single();

        if (!invError && invData) {
          // Add Invoice Items
          const invoiceItems = [
            {
              invoice_id: invData.id,
              item_description: `Procedure: ${targetCatalog?.name || 'Surgery'}`,
              quantity: 1,
              unit_price: procedurePrice,
              total_price: procedurePrice
            },
            ...scheduleForm.used_supplies.map(sup => ({
              invoice_id: invData.id,
              item_description: `Supply: ${sup.name}`,
              quantity: sup.quantity,
              unit_price: sup.unit_price,
              total_price: sup.quantity * sup.unit_price
            }))
          ];
          await supabase.from('invoice_items').insert(invoiceItems);
        }

        // B. Deduct Medicine Stock
        for (const supply of scheduleForm.used_supplies) {
          const med = medicines.find(m => m.id === supply.medicine_id);
          if (med) {
            const newQty = Math.max(0, med.quantity - supply.quantity);
            const status = newQty <= 0 ? 'Out of Stock' : newQty <= 20 ? 'Low Stock' : 'In Stock';
            await supabase.from('medicines').update({ quantity: newQty, status }).eq('id', med.id);
          }
        }

        // C. Notify relevant staff via OS Notification/Channel (simulated custom notification insertion if required)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🏥 Surgery / Procedure Completed', {
            body: `Procedure ${targetCatalog?.name} completed for patient ${targetPatient?.full_name}`
          });
        }
      }

      setIsScheduleModalOpen(false);
      fetchProcedures();
    } catch (err) {
      console.error(err);
      alert('Failed to save procedure: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProcedure = async (id) => {
    if (window.confirm('Are you sure you want to delete this scheduled procedure?')) {
      try {
        const { error } = await supabase.from('procedures').delete().eq('id', id);
        if (error) throw error;
        setProcedures(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openScheduleAddModal = () => {
    setScheduleForm({
      patient_id: '', doctor_id: user?.id || '', assistants: '',
      procedure_catalog_id: '', procedure_room: '',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '09:00', pre_procedure_assessment: '',
      consent_confirmed: false, anaesthesia_type: 'None',
      procedure_notes: '', complications: '', post_procedure_instructions: '',
      follow_up_date: '', status: 'Planned', used_supplies: []
    });
    setModalMode('add');
    setSelectedItem(null);
    setIsScheduleModalOpen(true);
  };

  const openScheduleEditModal = (proc) => {
    setSelectedItem(proc);
    setScheduleForm({
      patient_id: proc.patient_id || '',
      doctor_id: proc.doctor_id || '',
      assistants: proc.assistants || '',
      procedure_catalog_id: proc.procedure_catalog_id || '',
      procedure_room: proc.procedure_room || '',
      scheduled_date: proc.scheduled_date || '',
      scheduled_time: proc.scheduled_time?.substring(0, 5) || '',
      pre_procedure_assessment: proc.pre_procedure_assessment || '',
      consent_confirmed: proc.consent_confirmed || false,
      anaesthesia_type: proc.anaesthesia_type || 'None',
      procedure_notes: proc.procedure_notes || '',
      complications: proc.complications || '',
      post_procedure_instructions: proc.post_procedure_instructions || '',
      follow_up_date: proc.follow_up_date || '',
      status: proc.status || 'Planned',
      used_supplies: proc.used_supplies || []
    });
    setModalMode('edit');
    setIsScheduleModalOpen(true);
  };

  // Supply search/filtering
  const filteredSupplies = useMemo(() => {
    if (!supplySearch) return [];
    return medicines.filter(m => m.name.toLowerCase().includes(supplySearch.toLowerCase()));
  }, [supplySearch, medicines]);

  const addSupplyItem = (med) => {
    const exists = scheduleForm.used_supplies.find(s => s.medicine_id === med.id);
    if (exists) {
      setScheduleForm(prev => ({
        ...prev,
        used_supplies: prev.used_supplies.map(s => s.medicine_id === med.id ? { ...s, quantity: s.quantity + 1 } : s)
      }));
    } else {
      setScheduleForm(prev => ({
        ...prev,
        used_supplies: [...prev.used_supplies, { medicine_id: med.id, name: med.name, quantity: 1, unit_price: med.unit_price }]
      }));
    }
    setSupplySearch('');
    setShowSupplyDropdown(false);
  };

  const removeSupplyItem = (medId) => {
    setScheduleForm(prev => ({
      ...prev,
      used_supplies: prev.used_supplies.filter(s => s.medicine_id !== medId)
    }));
  };

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: procedures.length,
      planned: procedures.filter(p => p.status === 'Planned').length,
      active: procedures.filter(p => p.status === 'In Progress').length,
      completed: procedures.filter(p => p.status === 'Completed').length
    };
  }, [procedures]);

  // General Filter
  const filteredProcedures = useMemo(() => {
    return procedures.filter(p => {
      const term = searchTerm.toLowerCase();
      const patientName = p.patients?.full_name?.toLowerCase() || '';
      const docName = p.profiles?.full_name?.toLowerCase() || '';
      const procName = p.procedure_catalog?.name?.toLowerCase() || '';

      const matchesSearch = patientName.includes(term) || docName.includes(term) || procName.includes(term);
      const matchesCategory = categoryFilter === 'All' || p.procedure_catalog?.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [procedures, searchTerm, categoryFilter, statusFilter]);

  // Selected Patient Alert check
  const selectedPatientData = useMemo(() => {
    return patients.find(p => p.id === scheduleForm.patient_id);
  }, [scheduleForm.patient_id, patients]);

  return (
    <div className="procedures-layout">
      
      {/* Header */}
      <div className="procedures-header-row">
        <div className="procedures-header-left">
          <h1>Procedures & Surgery Management</h1>
          <p className="procedures-subtitle">Manage catalog, scheduled minor surgeries, assessments, consent forms, and outcomes.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="premium-btn-outline" onClick={() => { setModalMode('add'); setCatalogForm({ name: '', category: 'Minor Surgery', default_price: '', required_department: '', required_equipment: '', preparation_instructions: '' }); setIsCatalogModalOpen(true); }}>
            <Plus size={16} /> Add Catalog Item
          </button>
          <button className="premium-btn" onClick={openScheduleAddModal}>
            <Plus size={16} /> Schedule Procedure
          </button>
        </div>
      </div>

      {/* Stats Cards Ribbon */}
      <div className="procedures-stats-grid">
        <div className="procedures-stat-card">
          <div className="procedures-stat-icon total"><ClipboardList size={20} /></div>
          <div className="procedures-stat-info">
            <h3>{stats.total}</h3>
            <p>Total Procedures</p>
          </div>
        </div>
        <div className="procedures-stat-card">
          <div className="procedures-stat-icon pending"><Clock size={20} /></div>
          <div className="procedures-stat-info">
            <h3>{stats.planned}</h3>
            <p>Planned / Booked</p>
          </div>
        </div>
        <div className="procedures-stat-card">
          <div className="procedures-stat-icon active"><Play size={20} /></div>
          <div className="procedures-stat-info">
            <h3>{stats.active}</h3>
            <p>In Progress</p>
          </div>
        </div>
        <div className="procedures-stat-card">
          <div className="procedures-stat-icon completed"><CheckCircle size={20} /></div>
          <div className="procedures-stat-info">
            <h3>{stats.completed}</h3>
            <p>Completed</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="procedures-toolbar">
        <div className="procedures-search-input">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search patient name, surgeon or procedure..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <select className="procedures-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="All">All Categories</option>
          <option value="Minor Surgery">Minor Surgery</option>
          <option value="Endoscopy">Endoscopy</option>
          <option value="Cardiology">Cardiology</option>
          <option value="Orthopedics">Orthopedics</option>
          <option value="General">General</option>
        </select>

        <select className="procedures-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="Planned">Planned</option>
          <option value="Confirmed">Confirmed</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Postponed">Postponed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <button className="procedures-reset-btn" onClick={() => { setSearchTerm(''); setCategoryFilter('All'); setStatusFilter('All'); }}>Reset</button>
      </div>

      {/* Main Content Layout */}
      <div className="procedures-split-layout">
        
        {/* Scheduled list table */}
        <div className="procedures-main-panel">
          <div className="procedures-panel-header">
            <h4>Scheduled Surgeries / Procedures</h4>
            <div className="procedures-tab-pills">
              <button className={`procedures-tab-pill ${activeTab === 'procedures' ? 'active' : ''}`} onClick={() => setActiveTab('procedures')}>Procedures</button>
              <button className={`procedures-tab-pill ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>Catalog</button>
            </div>
          </div>

          <div className="procedures-table-inner">
            {activeTab === 'procedures' ? (
              isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                  <Loader2 className="spinner" size={32} color="var(--primary-brand)" />
                </div>
              ) : filteredProcedures.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>No scheduled procedures found.</div>
              ) : (
                <table className="procedures-data-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Procedure</th>
                      <th>Surgeon</th>
                      <th>Room & Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProcedures.map(proc => (
                      <tr key={proc.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{proc.patients?.full_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{proc.patients?.patient_id}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{proc.procedure_catalog?.name}</div>
                          <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--bg-body)', borderRadius: 4 }}>{proc.procedure_catalog?.category}</span>
                        </td>
                        <td>Dr. {proc.profiles?.full_name || 'Unassigned'}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>Room: {proc.procedure_room || 'N/A'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{proc.scheduled_date} at {proc.scheduled_time?.substring(0, 5)}</div>
                        </td>
                        <td>
                          <span className={`procedures-status-pill ${proc.status.toLowerCase().replace(' ', '-')}`}>{proc.status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="procedures-action-btn" onClick={() => openScheduleEditModal(proc)}><Edit size={12} /> Edit / Assess</button>
                            <button className="procedures-action-btn" style={{ color: 'var(--accent-red)' }} onClick={() => handleDeleteProcedure(proc.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              // Catalog view
              <table className="procedures-data-table">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Category</th>
                    <th>Default Price</th>
                    <th>Equipment / Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map(cat => (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 700 }}>{cat.name}</td>
                      <td><span style={{ padding: '2px 8px', background: 'rgba(20,184,166,0.1)', color: 'var(--primary-brand)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{cat.category}</span></td>
                      <td><strong>${parseFloat(cat.default_price).toFixed(2)}</strong></td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Prep: {cat.preparation_instructions || 'None'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Equip: {cat.required_equipment || 'Standard'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Side Panel: Quick view today */}
        <div className="procedures-side-panel">
          <div className="procedures-catalog-summary-card">
            <div className="procedures-catalog-header">
              <h4>Upcoming Today</h4>
            </div>
            <div className="procedures-catalog-list">
              {procedures.filter(p => p.scheduled_date === new Date().toISOString().split('T')[0]).map(proc => (
                <div key={proc.id} className="procedures-catalog-item" onClick={() => openScheduleEditModal(proc)} style={{ cursor: 'pointer' }}>
                  <div>
                    <div className="procedures-catalog-item-name">{proc.patients?.full_name}</div>
                    <div className="procedures-catalog-item-cat">{proc.procedure_catalog?.name} · Room {proc.procedure_room}</div>
                  </div>
                  <span className={`procedures-status-pill ${proc.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.62rem' }}>{proc.status}</span>
                </div>
              ))}
              {procedures.filter(p => p.scheduled_date === new Date().toISOString().split('T')[0]).length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '10px 0' }}>No surgeries scheduled for today.</div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── ADD CATALOG MODAL ── */}
      {isCatalogModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCatalogModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>➕ Add Catalog Procedure</h2>
              <button className="close-modal-btn" onClick={() => setIsCatalogModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCatalogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Procedure Name *</label>
                  <input type="text" className="premium-input" required value={catalogForm.name} onChange={e => setCatalogForm({ ...catalogForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select className="premium-input" value={catalogForm.category} onChange={e => setCatalogForm({ ...catalogForm, category: e.target.value })}>
                    <option>Minor Surgery</option>
                    <option>Endoscopy</option>
                    <option>Cardiology</option>
                    <option>Orthopedics</option>
                    <option>General</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Default Price ($) *</label>
                  <input type="number" step="0.01" className="premium-input" required value={catalogForm.default_price} onChange={e => setCatalogForm({ ...catalogForm, default_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Required Department</label>
                  <input type="text" className="premium-input" value={catalogForm.required_department} onChange={e => setCatalogForm({ ...catalogForm, required_department: e.target.value })} placeholder="e.g. Surgery, Outpatient" />
                </div>
                <div className="form-group">
                  <label>Required Equipment</label>
                  <input type="text" className="premium-input" value={catalogForm.required_equipment} onChange={e => setCatalogForm({ ...catalogForm, required_equipment: e.target.value })} placeholder="e.g. Sterilized surgical kit" />
                </div>
                <div className="form-group">
                  <label>Preparation Instructions</label>
                  <textarea className="premium-input" rows={2} value={catalogForm.preparation_instructions} onChange={e => setCatalogForm({ ...catalogForm, preparation_instructions: e.target.value })} placeholder="Fasting needed, skin sterilization etc..." />
                </div>
                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsCatalogModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Save Item</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE PROCEDURE MODAL ── */}
      {isScheduleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsScheduleModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '➕ Schedule New Procedure' : '📝 Procedure Assessment & Details'}</h2>
              <button className="close-modal-btn" onClick={() => setIsScheduleModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {/* Permanent Patient Alert Banner inside the modal if patient has active warnings */}
              {selectedPatientData && (selectedPatientData.drug_allergies || selectedPatientData.food_allergies || selectedPatientData.chronic_conditions || selectedPatientData.pregnancy_warning || selectedPatientData.previous_severe_reactions || selectedPatientData.infectious_disease_warning || selectedPatientData.special_care_instructions) && (
                <div style={{ background: '#FEF2F2', border: '2px dashed #EF4444', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: '800', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <ShieldAlert size={16} /> CRITICAL MEDICAL ALERT FOR THIS PATIENT
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.78rem' }}>
                    {selectedPatientData.drug_allergies && <span style={{ background: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', color: '#991B1B' }}><strong>Drug Allergy:</strong> {selectedPatientData.drug_allergies}</span>}
                    {selectedPatientData.pregnancy_warning && <span style={{ background: '#FCE7F3', padding: '2px 6px', borderRadius: '4px', color: '#9D174D', fontWeight: 'bold' }}>🤰 PREGNANT</span>}
                    {selectedPatientData.infectious_disease_warning && <span style={{ background: '#FEF2F2', padding: '2px 6px', borderRadius: '4px', color: '#B91C1C', fontWeight: 'bold' }}>☣️ Infectious: {selectedPatientData.infectious_disease_warning}</span>}
                    {selectedPatientData.special_care_instructions && <span style={{ background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px', color: '#065F46' }}><strong>Special Care:</strong> {selectedPatientData.special_care_instructions}</span>}
                  </div>
                </div>
              )}

              <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Select Patient *</label>
                    <select className="premium-input" required value={scheduleForm.patient_id} onChange={e => setScheduleForm({ ...scheduleForm, patient_id: e.target.value })}>
                      <option value="">-- Select Patient --</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Select Procedure *</label>
                    <select className="premium-input" required value={scheduleForm.procedure_catalog_id} onChange={e => setScheduleForm({ ...scheduleForm, procedure_catalog_id: e.target.value })}>
                      <option value="">-- Select Procedure --</option>
                      {catalog.map(c => <option key={c.id} value={c.id}>{c.name} (${parseFloat(c.default_price).toFixed(2)})</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Surgeon / Attending Doctor *</label>
                    <select className="premium-input" required value={scheduleForm.doctor_id} onChange={e => setScheduleForm({ ...scheduleForm, doctor_id: e.target.value })}>
                      <option value="">-- Select Surgeon --</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assistants (Names, comma separated)</label>
                    <input type="text" className="premium-input" value={scheduleForm.assistants} onChange={e => setScheduleForm({ ...scheduleForm, assistants: e.target.value })} placeholder="e.g. Nurse Halima, Dr. Abdi" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Scheduled Date *</label>
                    <input type="date" className="premium-input" required value={scheduleForm.scheduled_date} onChange={e => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Scheduled Time *</label>
                    <input type="time" className="premium-input" required value={scheduleForm.scheduled_time} onChange={e => setScheduleForm({ ...scheduleForm, scheduled_time: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Procedure Room</label>
                    <input type="text" className="premium-input" value={scheduleForm.procedure_room} onChange={e => setScheduleForm({ ...scheduleForm, procedure_room: e.target.value })} placeholder="e.g. OR-1, Room 2" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Anaesthesia Type</label>
                    <select className="premium-input" value={scheduleForm.anaesthesia_type} onChange={e => setScheduleForm({ ...scheduleForm, anaesthesia_type: e.target.value })}>
                      <option value="None">None</option>
                      <option value="Local">Local</option>
                      <option value="Regional">Regional</option>
                      <option value="General">General</option>
                      <option value="Sedation">Sedation</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Procedure Status</label>
                    <select className="premium-input" value={scheduleForm.status} onChange={e => setScheduleForm({ ...scheduleForm, status: e.target.value })}>
                      <option value="Planned">Planned</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Postponed">Postponed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Pre-procedure Assessment Notes</label>
                  <textarea className="premium-input" rows={2} value={scheduleForm.pre_procedure_assessment} onChange={e => setScheduleForm({ ...scheduleForm, pre_procedure_assessment: e.target.value })} placeholder="General physical check, allergies, vitals checks..." />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="consent_chk" checked={scheduleForm.consent_confirmed} onChange={e => setScheduleForm({ ...scheduleForm, consent_confirmed: e.target.checked })} style={{ width: 'auto' }} />
                  <label htmlFor="consent_chk" style={{ cursor: 'pointer', margin: 0, fontWeight: 'bold' }}>Consent Certificate Confirmed & Signed by Patient</label>
                </div>

                {/* Supplies / Used Medicines Section */}
                <div className="form-group">
                  <label style={{ fontWeight: 'bold' }}>Used Medicines & Supplies (Deducted on Completed)</label>
                  <div className="procedures-supplies-box">
                    <div className="procedures-supplies-search-wrap">
                      <input
                        type="text"
                        placeholder="Search medicines from inventory..."
                        value={supplySearch}
                        onChange={e => { setSupplySearch(e.target.value); setShowSupplyDropdown(true); }}
                      />
                      {showSupplyDropdown && filteredSupplies.length > 0 && (
                        <div className="procedures-supplies-dropdown">
                          {filteredSupplies.map(med => (
                            <div key={med.id} className="procedures-supplies-dropdown-item" onClick={() => addSupplyItem(med)}>
                              <span>{med.name}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Qty: {med.quantity} · ${parseFloat(med.unit_price).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="procedures-selected-supplies-list">
                      {scheduleForm.used_supplies.map(sup => (
                        <div key={sup.medicine_id} className="procedures-selected-supply-row">
                          <span>{sup.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="number"
                              style={{ width: '60px', padding: '4px', fontSize: '0.8rem', textAlign: 'center' }}
                              value={sup.quantity}
                              onChange={e => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setScheduleForm(prev => ({
                                  ...prev,
                                  used_supplies: prev.used_supplies.map(s => s.medicine_id === sup.medicine_id ? { ...s, quantity: val } : s)
                                }));
                              }}
                            />
                            <span>x ${sup.unit_price}</span>
                            <button type="button" onClick={() => removeSupplyItem(sup.medicine_id)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}><X size={14} /></button>
                          </div>
                        </div>
                      ))}
                      {scheduleForm.used_supplies.length === 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>No medicines/supplies added yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Procedure Notes & Outcomes</label>
                    <textarea className="premium-input" rows={2} value={scheduleForm.procedure_notes} onChange={e => setScheduleForm({ ...scheduleForm, procedure_notes: e.target.value })} placeholder="Describe details of the surgery..." />
                  </div>
                  <div className="form-group">
                    <label>Complications</label>
                    <textarea className="premium-input" rows={2} value={scheduleForm.complications} onChange={e => setScheduleForm({ ...scheduleForm, complications: e.target.value })} placeholder="Specify any intra-operative complications..." />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Post-procedure Instructions</label>
                    <input type="text" className="premium-input" value={scheduleForm.post_procedure_instructions} onChange={e => setScheduleForm({ ...scheduleForm, post_procedure_instructions: e.target.value })} placeholder="Wound dressing, rest, fasting checks..." />
                  </div>
                  <div className="form-group">
                    <label>Follow-up Date</label>
                    <input type="date" className="premium-input" value={scheduleForm.follow_up_date} onChange={e => setScheduleForm({ ...scheduleForm, follow_up_date: e.target.value })} />
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsScheduleModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Save Details</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Procedures;
