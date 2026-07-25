import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, Loader2, CheckCircle, Clock, Heart, Calendar,
  ShieldAlert, UserCheck, Stethoscope, Baby, HelpCircle, X, Info
} from 'lucide-react';
import './Maternity.css';

const Maternity = () => {
  const { user } = useAuth();

  // Lists
  const [registrations, setRegistrations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // UI / Loading
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('registrations'); // 'registrations', 'births'
  const [deliveries, setDeliveries] = useState([]);

  // Modals
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedReg, setSelectedReg] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');

  // Form States
  const [regForm, setRegForm] = useState({
    patient_id: '', lmp_date: '', edd_date: '',
    gravida: 1, para: 0, previous_pregnancies: '',
    previous_complications: '', risk_assessment: 'Low Risk',
    delivery_plan: '', status: 'Active'
  });

  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    weight: '', blood_pressure: '', fetal_heart_rate: '',
    fundal_height: '', fetal_movement: 'Active',
    ultrasound_notes: '', supplements: '', vaccinations: '',
    notes: '', next_appointment: ''
  });

  const [deliveryForm, setDeliveryForm] = useState({
    delivery_date: new Date().toISOString().substring(0, 16),
    delivery_type: 'Normal Vaginal', attending_doctor_id: '',
    baby_gender: 'Male', birth_weight: '',
    apgar_1min: '', apgar_5min: '', mother_condition: 'Healthy',
    baby_condition: 'Healthy', complications: '', delivery_notes: ''
  });

  useEffect(() => {
    fetchRegistrations();
    fetchDeliveries();
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [patRes, docRes] = await Promise.all([
        supabase.from('patients').select('id, full_name, patient_id, gender, phone, address').order('full_name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'Doctor').order('full_name')
      ]);
      // Filter female patients for pregnancy registration
      setPatients(patRes.data || []);
      setDoctors(docRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const femalePatients = useMemo(() => {
    return patients.filter(p => p.gender === 'Female' || p.gender === 'female');
  }, [patients]);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('maternity_registrations')
        .select('*, patients(id, patient_id, full_name, age, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRegistrations(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeliveries = async () => {
    try {
      const { data } = await supabase
        .from('delivery_records')
        .select('*, mother:patients!mother_id(full_name), newborn:patients!newborn_patient_id(full_name, patient_id)')
        .order('delivery_date', { ascending: false });
      setDeliveries(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // LMP auto EDD calculation
  const handleLmpChange = (e) => {
    const lmp = e.target.value;
    if (lmp) {
      const lmpDate = new Date(lmp);
      // EDD = LMP + 280 days
      lmpDate.setDate(lmpDate.getDate() + 280);
      const edd = lmpDate.toISOString().split('T')[0];
      setRegForm(prev => ({ ...prev, lmp_date: lmp, edd_date: edd }));
    } else {
      setRegForm(prev => ({ ...prev, lmp_date: '', edd_date: '' }));
    }
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...regForm,
        gravida: parseInt(regForm.gravida) || 1,
        para: parseInt(regForm.para) || 0
      };

      if (modalMode === 'add') {
        const { error } = await supabase.from('maternity_registrations').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('maternity_registrations').update(payload).eq('id', selectedReg.id);
        if (error) throw error;
      }
      setIsRegModalOpen(false);
      fetchRegistrations();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVisitSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...visitForm,
        maternity_registration_id: selectedReg.id,
        weight: parseFloat(visitForm.weight) || null,
        fetal_heart_rate: parseInt(visitForm.fetal_heart_rate) || null,
        fundal_height: parseFloat(visitForm.fundal_height) || null,
        next_appointment: visitForm.next_appointment || null,
        created_by: user?.id
      };

      const { error } = await supabase.from('antenatal_visits').insert([payload]);
      if (error) throw error;

      setIsVisitModalOpen(false);
      alert('Antenatal visit registered successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Register Newborn in Patients Table to prevent duplicate data
      const motherPatient = patients.find(p => p.id === selectedReg.patient_id);
      const newbornName = `Baby of ${motherPatient ? motherPatient.full_name : 'Patient'}`;
      
      const countRes = await supabase.from('patients').select('id', { count: 'exact', head: true });
      const currentCount = countRes.count || 0;
      const newbornId = `PAT-${10001 + currentCount}`;

      const { data: babyData, error: babyError } = await supabase.from('patients').insert([{
        patient_id: newbornId,
        full_name: newbornName,
        gender: deliveryForm.baby_gender,
        age: 0,
        phone: motherPatient?.phone || '',
        address: motherPatient?.address || '',
        medical_history: `Born on ${deliveryForm.delivery_date}. Mother ID: ${motherPatient?.patient_id}`
      }]).select().single();

      if (babyError) throw babyError;

      // 2. Insert Delivery Record linking newborn profile
      const payload = {
        maternity_registration_id: selectedReg.id,
        mother_id: selectedReg.patient_id,
        delivery_date: deliveryForm.delivery_date,
        delivery_type: deliveryForm.delivery_type,
        attending_doctor_id: deliveryForm.attending_doctor_id || null,
        baby_gender: deliveryForm.baby_gender,
        birth_weight: parseFloat(deliveryForm.birth_weight) || 0,
        apgar_1min: parseInt(deliveryForm.apgar_1min) || null,
        apgar_5min: parseInt(deliveryForm.apgar_5min) || null,
        mother_condition: deliveryForm.mother_condition,
        baby_condition: deliveryForm.baby_condition,
        complications: deliveryForm.complications,
        delivery_notes: deliveryForm.delivery_notes,
        newborn_patient_id: babyData.id
      };

      const { error: delError } = await supabase.from('delivery_records').insert([payload]);
      if (delError) throw delError;

      // 3. Mark maternity registration completed
      await supabase.from('maternity_registrations').update({ status: 'Completed' }).eq('id', selectedReg.id);

      setIsDeliveryModalOpen(false);
      fetchRegistrations();
      fetchDeliveries();
      alert('Delivery registered and newborn patient profile created successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRegAddModal = () => {
    setRegForm({
      patient_id: '', lmp_date: '', edd_date: '',
      gravida: 1, para: 0, previous_pregnancies: '',
      previous_complications: '', risk_assessment: 'Low Risk',
      delivery_plan: '', status: 'Active'
    });
    setModalMode('add');
    setSelectedReg(null);
    setIsRegModalOpen(true);
  };

  const openRegEditModal = (reg) => {
    setSelectedReg(reg);
    setRegForm({
      patient_id: reg.patient_id || '',
      lmp_date: reg.lmp_date || '',
      edd_date: reg.edd_date || '',
      gravida: reg.gravida || 1,
      para: reg.para || 0,
      previous_pregnancies: reg.previous_pregnancies || '',
      previous_complications: reg.previous_complications || '',
      risk_assessment: reg.risk_assessment || 'Low Risk',
      delivery_plan: reg.delivery_plan || '',
      status: reg.status || 'Active'
    });
    setModalMode('edit');
    setIsRegModalOpen(true);
  };

  const filteredRegistrations = useMemo(() => {
    return registrations.filter(r => {
      const term = searchTerm.toLowerCase();
      const patName = r.patients?.full_name?.toLowerCase() || '';
      const patId = r.patients?.patient_id?.toLowerCase() || '';

      const matchesSearch = patName.includes(term) || patId.includes(term);
      const matchesRisk = riskFilter === 'All' || r.risk_assessment === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [registrations, searchTerm, riskFilter]);

  const stats = useMemo(() => {
    return {
      total: registrations.filter(r => r.status === 'Active').length,
      highRisk: registrations.filter(r => r.status === 'Active' && r.risk_assessment === 'High Risk').length,
      deliveries: deliveries.length
    };
  }, [registrations, deliveries]);

  return (
    <div className="maternity-layout">
      {/* Header */}
      <div className="maternity-header-row">
        <div className="maternity-header-left">
          <h1>Maternity & Antenatal Care</h1>
          <p className="maternity-subtitle">Pregnancy registrations, LMP and EDD calculators, antenatal visits logs, and newborn links.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="premium-btn" onClick={openRegAddModal}>
            <Plus size={16} /> Register Pregnancy
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="maternity-stats-grid">
        <div className="maternity-stat-card">
          <div className="maternity-stat-icon total"><Heart size={20} /></div>
          <div className="maternity-stat-info">
            <h3>{stats.total}</h3>
            <p>Active Pregnancies</p>
          </div>
        </div>
        <div className="maternity-stat-card">
          <div className="maternity-stat-icon high-risk"><ShieldAlert size={20} /></div>
          <div className="maternity-stat-info">
            <h3>{stats.highRisk}</h3>
            <p>High Risk Profiles</p>
          </div>
        </div>
        <div className="maternity-stat-card">
          <div className="maternity-stat-icon births"><Baby size={20} /></div>
          <div className="maternity-stat-info">
            <h3>{stats.deliveries}</h3>
            <p>Registered Deliveries</p>
          </div>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="procedures-tab-pills" style={{ alignSelf: 'flex-start' }}>
        <button className={`procedures-tab-pill ${activeTab === 'registrations' ? 'active' : ''}`} onClick={() => setActiveTab('registrations')}>Active Registrations</button>
        <button className={`procedures-tab-pill ${activeTab === 'births' ? 'active' : ''}`} onClick={() => setActiveTab('births')}>Birth Records</button>
      </div>

      {activeTab === 'registrations' ? (
        <>
          {/* Toolbar */}
          <div className="maternity-toolbar">
            <div className="maternity-search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search mother name or patient ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="maternity-filter-select" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
              <option value="All">All Risks</option>
              <option value="Low Risk">Low Risk</option>
              <option value="Medium Risk">Medium Risk</option>
              <option value="High Risk">High Risk</option>
            </select>
            <button className="maternity-reset-btn" onClick={() => { setSearchTerm(''); setRiskFilter('All'); }}>Reset</button>
          </div>

          {/* Grid Cards */}
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <Loader2 className="spinner" size={32} color="var(--primary-brand)" />
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>No active maternity registrations found.</div>
          ) : (
            <div className="maternity-grid">
              {filteredRegistrations.map(reg => (
                <div key={reg.id} className="maternity-card">
                  <div className="maternity-card-header">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: <strong>{reg.status}</strong></span>
                    <span className={`maternity-risk-badge ${reg.risk_assessment.toLowerCase().replace(' ', '-')}`}>{reg.risk_assessment}</span>
                  </div>

                  <div className="maternity-card-patient">
                    <h3>{reg.patients?.full_name}</h3>
                    <p>{reg.patients?.patient_id} · {reg.patients?.phone || 'No phone'}</p>
                  </div>

                  <div className="maternity-card-details">
                    <div className="maternity-detail-row">
                      <span className="maternity-detail-label">LMP Date:</span>
                      <span className="maternity-detail-value">{reg.lmp_date}</span>
                    </div>
                    <div className="maternity-detail-row">
                      <span className="maternity-detail-label">Expected Delivery (EDD):</span>
                      <span className="maternity-detail-value" style={{ color: 'var(--primary-brand)', fontWeight: 'bold' }}>{reg.edd_date}</span>
                    </div>
                    <div className="maternity-detail-row">
                      <span className="maternity-detail-label">Gravida / Para:</span>
                      <span className="maternity-detail-value">G{reg.gravida} P{reg.para}</span>
                    </div>
                  </div>

                  <div className="maternity-card-footer">
                    <button className="maternity-action-btn" onClick={() => openRegEditModal(reg)}>Edit</button>
                    <div className="maternity-actions">
                      <button className="maternity-action-btn log-visit" onClick={() => { setSelectedReg(reg); setVisitForm({ visit_date: new Date().toISOString().split('T')[0], weight: '', blood_pressure: '', fetal_heart_rate: '', fundal_height: '', fetal_movement: 'Active', ultrasound_notes: '', supplements: '', vaccinations: '', notes: '', next_appointment: '' }); setIsVisitModalOpen(true); }}><Stethoscope size={14} /> Visit</button>
                      <button className="maternity-action-btn deliver" onClick={() => { setSelectedReg(reg); setDeliveryForm({ delivery_date: new Date().toISOString().substring(0, 16), delivery_type: 'Normal Vaginal', attending_doctor_id: '', baby_gender: 'Male', birth_weight: '', apgar_1min: '', apgar_5min: '', mother_condition: 'Healthy', baby_condition: 'Healthy', complications: '', delivery_notes: '' }); setIsDeliveryModalOpen(true); }}><Baby size={14} /> Deliver</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        // Birth Records Tab
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table className="procedures-data-table">
            <thead>
              <tr>
                <th>Delivery Date</th>
                <th>Mother</th>
                <th>Baby Name / ID</th>
                <th>Weight & Gender</th>
                <th>APGAR (1/5)</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(del => (
                <tr key={del.id}>
                  <td>{new Date(del.delivery_date).toLocaleString()}</td>
                  <td><strong>{del.mother?.full_name}</strong></td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary-brand)' }}>{del.newborn?.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{del.newborn?.patient_id}</div>
                  </td>
                  <td>{del.birth_weight} kg · {del.baby_gender}</td>
                  <td>{del.apgar_1min || '—'} / {del.apgar_5min || '—'}</td>
                  <td>{del.delivery_type}</td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No birth/delivery records logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── REGISTER MATERNITY MODAL ── */}
      {isRegModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRegModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>🤰 Register Maternal Profile</h2>
              <button className="close-modal-btn" onClick={() => setIsRegModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRegSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Select Mother Patient *</label>
                  <select className="premium-input" required value={regForm.patient_id} onChange={e => setRegForm({ ...regForm, patient_id: e.target.value })} disabled={modalMode === 'edit'}>
                    <option value="">-- Select Female Patient --</option>
                    {femalePatients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Last Menstrual Period (LMP) *</label>
                    <input type="date" className="premium-input" required value={regForm.lmp_date} onChange={handleLmpChange} />
                  </div>
                  <div className="form-group">
                    <label>Calculated Expected Delivery (EDD)</label>
                    <input type="date" className="premium-input" readOnly value={regForm.edd_date} style={{ background: 'var(--bg-body)', cursor: 'not-allowed' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Gravida *</label>
                    <input type="number" min="1" className="premium-input" required value={regForm.gravida} onChange={e => setRegForm({ ...regForm, gravida: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Para *</label>
                    <input type="number" min="0" className="premium-input" required value={regForm.para} onChange={e => setRegForm({ ...regForm, para: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Risk Assessment *</label>
                    <select className="premium-input" value={regForm.risk_assessment} onChange={e => setRegForm({ ...regForm, risk_assessment: e.target.value })}>
                      <option>Low Risk</option>
                      <option>Medium Risk</option>
                      <option>High Risk</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status *</label>
                    <select className="premium-input" value={regForm.status} onChange={e => setRegForm({ ...regForm, status: e.target.value })}>
                      <option>Active</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Previous Pregnancies Notes</label>
                  <textarea className="premium-input" rows={2} value={regForm.previous_pregnancies} onChange={e => setRegForm({ ...regForm, previous_pregnancies: e.target.value })} placeholder="Number of births, healthy births..." />
                </div>

                <div className="form-group">
                  <label>Previous Complications</label>
                  <input type="text" className="premium-input" value={regForm.previous_complications} onChange={e => setRegForm({ ...regForm, previous_complications: e.target.value })} placeholder="e.g. Gestational diabetes, pre-eclampsia" />
                </div>

                <div className="form-group">
                  <label>Delivery Plan</label>
                  <input type="text" className="premium-input" value={regForm.delivery_plan} onChange={e => setRegForm({ ...regForm, delivery_plan: e.target.value })} placeholder="e.g. Planned C-section at clinic" />
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsRegModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Register Profile</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── ANTENATAL VISIT MODAL ── */}
      {isVisitModalOpen && (
        <div className="modal-overlay" onClick={() => setIsVisitModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>🩺 Log Antenatal Visit</h2>
              <button className="close-modal-btn" onClick={() => setIsVisitModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleVisitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Visit Date *</label>
                    <input type="date" className="premium-input" required value={visitForm.visit_date} onChange={e => setVisitForm({ ...visitForm, visit_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input type="number" step="0.1" className="premium-input" value={visitForm.weight} onChange={e => setVisitForm({ ...visitForm, weight: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Blood Pressure</label>
                    <input type="text" className="premium-input" placeholder="e.g. 120/80" value={visitForm.blood_pressure} onChange={e => setVisitForm({ ...visitForm, blood_pressure: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Fetal Heart Rate (bpm)</label>
                    <input type="number" className="premium-input" placeholder="e.g. 140" value={visitForm.fetal_heart_rate} onChange={e => setVisitForm({ ...visitForm, fetal_heart_rate: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Fundal Height (cm)</label>
                    <input type="number" step="0.1" className="premium-input" placeholder="e.g. 24" value={visitForm.fundal_height} onChange={e => setVisitForm({ ...visitForm, fundal_height: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Fetal Movement</label>
                    <select className="premium-input" value={visitForm.fetal_movement} onChange={e => setVisitForm({ ...visitForm, fetal_movement: e.target.value })}>
                      <option>Active</option>
                      <option>Reduced</option>
                      <option>Not Felt</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Supplements Given</label>
                    <input type="text" className="premium-input" placeholder="e.g. Iron, Folic Acid" value={visitForm.supplements} onChange={e => setVisitForm({ ...visitForm, supplements: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Vaccinations Given</label>
                    <input type="text" className="premium-input" placeholder="e.g. Tetanus Toxoid" value={visitForm.vaccinations} onChange={e => setVisitForm({ ...visitForm, vaccinations: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Ultrasound History / Notes</label>
                  <input type="text" className="premium-input" placeholder="e.g. Normal single live fetus, cephalic" value={visitForm.ultrasound_notes} onChange={e => setVisitForm({ ...visitForm, ultrasound_notes: e.target.value })} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>General Notes</label>
                    <input type="text" className="premium-input" value={visitForm.notes} onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Next Appointment Date</label>
                    <input type="date" className="premium-input" value={visitForm.next_appointment} onChange={e => setVisitForm({ ...visitForm, next_appointment: e.target.value })} />
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsVisitModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Log Visit</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── DELIVER BABY MODAL ── */}
      {isDeliveryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDeliveryModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>👶 Record Delivery & Baby Birth</h2>
              <button className="close-modal-btn" onClick={() => setIsDeliveryModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleDeliverySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Delivery Date & Time *</label>
                    <input type="datetime-local" className="premium-input" required value={deliveryForm.delivery_date} onChange={e => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Delivery Type *</label>
                    <select className="premium-input" value={deliveryForm.delivery_type} onChange={e => setDeliveryForm({ ...deliveryForm, delivery_type: e.target.value })}>
                      <option>Normal Vaginal</option>
                      <option>C-Section</option>
                      <option>Assisted Vaginal</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Baby Gender *</label>
                    <select className="premium-input" value={deliveryForm.baby_gender} onChange={e => setDeliveryForm({ ...deliveryForm, baby_gender: e.target.value })}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Birth Weight (kg) *</label>
                    <input type="number" step="0.01" className="premium-input" required value={deliveryForm.birth_weight} onChange={e => setDeliveryForm({ ...deliveryForm, birth_weight: e.target.value })} placeholder="e.g. 3.25" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>APGAR Score (1 minute)</label>
                    <input type="number" min="0" max="10" className="premium-input" value={deliveryForm.apgar_1min} onChange={e => setDeliveryForm({ ...deliveryForm, apgar_1min: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>APGAR Score (5 minutes)</label>
                    <input type="number" min="0" max="10" className="premium-input" value={deliveryForm.apgar_5min} onChange={e => setDeliveryForm({ ...deliveryForm, apgar_5min: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Mother Condition</label>
                    <input type="text" className="premium-input" value={deliveryForm.mother_condition} onChange={e => setDeliveryForm({ ...deliveryForm, mother_condition: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Baby Condition</label>
                    <input type="text" className="premium-input" value={deliveryForm.baby_condition} onChange={e => setDeliveryForm({ ...deliveryForm, baby_condition: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Attending Doctor or Midwife *</label>
                  <select className="premium-input" required value={deliveryForm.attending_doctor_id} onChange={e => setDeliveryForm({ ...deliveryForm, attending_doctor_id: e.target.value })}>
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Complications</label>
                  <input type="text" className="premium-input" value={deliveryForm.complications} onChange={e => setDeliveryForm({ ...deliveryForm, complications: e.target.value })} placeholder="e.g. Postpartum hemorrhage, none" />
                </div>

                <div className="form-group">
                  <label>Delivery Notes</label>
                  <textarea className="premium-input" rows={2} value={deliveryForm.delivery_notes} onChange={e => setDeliveryForm({ ...deliveryForm, delivery_notes: e.target.value })} placeholder="Any specific details of the birth..." />
                </div>

                <div style={{ background: 'rgba(20,184,166,0.1)', padding: 12, borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Info size={16} color="var(--primary-brand)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <strong>Automated Linker:</strong> Clicking register will automatically create a new newborn patient record connected to the mother's contact information.
                  </span>
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsDeliveryModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Register Birth</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Maternity;
