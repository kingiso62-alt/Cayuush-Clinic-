import React, { useState, useEffect } from 'react';
import { 
  Bed, Users, Clock, CheckCircle, Search, Filter, Eye, UserX, Loader2,
  Calendar, ClipboardList, Pill, TestTube, DollarSign, X, CheckSquare, ShieldAlert
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Inpatients.css';

const Inpatients = () => {
  const [inpatients, setInpatients] = useState([]);
  const [filteredInpatients, setFilteredInpatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Admitted'); // 'Admitted', 'Discharged', 'All'
  const [isLoading, setIsLoading] = useState(true);
  const [isDischarging, setIsDischarging] = useState(false);

  // Clinical Summary Modal state
  const [selectedInpatient, setSelectedInpatient] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [clinicalHistory, setClinicalHistory] = useState({
    encounters: [],
    prescriptions: [],
    labs: [],
    invoices: [],
    triage: []
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    fetchInpatients();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [inpatients, searchTerm, statusFilter]);

  const fetchInpatients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inpatients')
        .select(`
          *,
          patients (id, patient_id, full_name, age, gender, blood_group, phone, address, allergies, medical_history, drug_allergies, food_allergies, chronic_conditions, pregnancy_warning, previous_severe_reactions, infectious_disease_warning, special_care_instructions),
          profiles!doctor_id (full_name)
        `)
        .order('admission_date', { ascending: false });

      if (error) throw error;
      setInpatients(data || []);
    } catch (err) {
      console.error('Error fetching inpatients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = inpatients;

    // Search query (Patient Name, Patient ID, Room or Bed)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.patients?.full_name?.toLowerCase().includes(term) || 
        item.patients?.patient_id?.toLowerCase().includes(term) ||
        item.room_number?.toLowerCase().includes(term) ||
        item.bed_number?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(item => item.status === statusFilter);
    }

    setFilteredInpatients(result);
  };

  const handleDischarge = async (inpatientId) => {
    if (!window.confirm('Ma ogolaatay in aad fasaxdo (discharge) bukaankan jiifka ah?')) return;
    setIsDischarging(true);
    try {
      const { error } = await supabase
        .from('inpatients')
        .update({
          status: 'Discharged',
          discharge_date: new Date().toISOString(),
        })
        .eq('id', inpatientId);

      if (error) throw error;
      
      // Update locally
      setInpatients(prev => prev.map(item => 
        item.id === inpatientId 
          ? { ...item, status: 'Discharged', discharge_date: new Date().toISOString() } 
          : item
      ));
    } catch (err) {
      console.error('Discharge error:', err);
      alert('Khalad ayaa dhacay markii la fasaxayay bukaanka.');
    } finally {
      setIsDischarging(false);
    }
  };

  const openDetailsModal = async (inpatient) => {
    setSelectedInpatient(inpatient);
    setIsDetailsModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const patientId = inpatient.patient_id;
      const [encsRes, presRes, labsRes, invRes, triageRes] = await Promise.all([
        supabase.from('encounters').select('*').eq('patient_id', patientId).order('visit_date', { ascending: false }),
        supabase.from('prescriptions').select('*, medicines(name, generic_name), profiles!doctor_id(full_name)').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('lab_requests').select('*, lab_catalog(test_name, category), profiles!doctor_id(full_name)').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*, profiles!doctor_id(full_name)').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('triage_records').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
      ]);

      // Client-side doctor name mapping for encounters
      const { data: docs } = await supabase.from('profiles').select('id, full_name');
      const docMap = docs ? Object.fromEntries(docs.map(d => [d.id, d])) : {};
      const formattedEncs = (encsRes.data || []).map(e => ({
        ...e,
        profiles: docMap[e.doctor_id] || null
      }));

      setClinicalHistory({
        encounters: formattedEncs,
        prescriptions: presRes.data || [],
        labs: labsRes.data || [],
        invoices: invRes.data || [],
        triage: triageRes.data || []
      });
    } catch (err) {
      console.error('Error loading clinical history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getStayDuration = (admission, discharge) => {
    const start = new Date(admission);
    const end = discharge ? new Date(discharge) : new Date();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0 || diffDays === 1) return '1 Day';
    return `${diffDays} Days`;
  };

  // Header statistics
  const activeAdmissions = inpatients.filter(i => i.status === 'Admitted').length;
  const dischargedCount = inpatients.filter(i => i.status === 'Discharged').length;
  const totalInpatients = inpatients.length;

  return (
    <div className="inpatients-page">
      <div className="inpatients-header">
        <div>
          <h2>Inpatient Management (Bukaanada Jiifka)</h2>
          <p className="breadcrumb-path">Dashboard / Inpatients</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="inpatients-kpis">
        <div className="kpi-card blue">
          <div className="kpi-icon-wrapper"><Bed size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">Active Admissions</span>
            <h3>{activeAdmissions}</h3>
            <span className="kpi-subtitle">Currently occupying beds</span>
          </div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-icon-wrapper"><CheckCircle size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">Discharged</span>
            <h3>{dischargedCount}</h3>
            <span className="kpi-subtitle">Successfully completed stay</span>
          </div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-icon-wrapper"><Users size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Inpatients</span>
            <h3>{totalInpatients}</h3>
            <span className="kpi-subtitle">All-time admissions</span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="inpatients-toolbar">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by name, ID, room or bed..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-group">
          <div className="filter-dropdown">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Admitted">Admitted (Active)</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>
          <button className="refresh-btn" onClick={fetchInpatients}>
            <Clock size={16} /> Reload
          </button>
        </div>
      </div>

      {/* Inpatients Table Grid */}
      <div className="table-card">
        {isLoading ? (
          <div className="loading-state">
            <Loader2 className="spinner animate-spin" size={32} color="var(--primary-brand)" />
            <p>Loading inpatient files...</p>
          </div>
        ) : filteredInpatients.length === 0 ? (
          <div className="empty-state">
            <Bed size={48} className="empty-icon" />
            <h3>No inpatient profiles found</h3>
            <p>There are no patients matching your current filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="inpatients-table">
              <thead>
                <tr>
                  <th>PATIENT</th>
                  <th>ROOM / BED</th>
                  <th>ADMISSION DATE</th>
                  <th>DISCHARGE DATE</th>
                  <th>STAY DURATION</th>
                  <th>ADMITTING DOCTOR</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredInpatients.map((item) => {
                  const patient = item.patients;
                  const doctor = item.profiles;
                  const initials = patient?.full_name ? patient.full_name.charAt(0).toUpperCase() : '?';

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="patient-cell">
                          <div className="patient-avatar">{initials}</div>
                          <div>
                            <div className="patient-name">{patient?.full_name}</div>
                            <div className="patient-meta">
                              {patient?.patient_id} · {patient?.gender} · {patient?.age ? `${patient.age}y` : ''} · <span className="blood-type">{patient?.blood_group}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="room-bed-badge">
                          <span>🚪 {item.room_number || 'Room N/A'}</span>
                          <span>🛏️ {item.bed_number || 'Bed N/A'}</span>
                        </div>
                      </td>
                      <td>{new Date(item.admission_date).toLocaleString()}</td>
                      <td>{item.discharge_date ? new Date(item.discharge_date).toLocaleString() : '—'}</td>
                      <td>{getStayDuration(item.admission_date, item.discharge_date)}</td>
                      <td>Dr. {doctor?.full_name || 'Aisha Ibrahim'}</td>
                      <td>
                        <span className={`status-badge ${item.status.toLowerCase()}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn-icon view" 
                            title="View Clinical File & Work Done"
                            onClick={() => openDetailsModal(item)}
                          >
                            <Eye size={16} /> Clinical File
                          </button>
                          
                          {item.status === 'Admitted' && (
                            <button 
                              className="btn-icon discharge" 
                              title="Discharge Patient"
                              disabled={isDischarging}
                              onClick={() => handleDischarge(item.id)}
                            >
                              <UserX size={16} /> Discharge
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

      {/* Clinical File & Work Done Details Modal */}
      {isDetailsModalOpen && selectedInpatient && (
        <div className="modal-overlay" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="patient-header-details">
                <div className="modal-avatar">
                  {selectedInpatient.patients?.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2>Clinical Record: {selectedInpatient.patients?.full_name}</h2>
                  <p>
                    {selectedInpatient.patients?.patient_id} · {selectedInpatient.patients?.gender} · {selectedInpatient.patients?.age ? `${selectedInpatient.patients.age}y` : ''} · Blood Group: <strong style={{ color: '#EF4444' }}>{selectedInpatient.patients?.blood_group}</strong>
                  </p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsDetailsModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="modal-body">
              {/* Stay Summary Panel */}
              <div className="stay-summary-panel">
                <h3>Stay Details</h3>
                <div className="stay-grid">
                  <div className="stay-info-item"><label>Status</label><span className={`status-badge ${selectedInpatient.status.toLowerCase()}`}>{selectedInpatient.status}</span></div>
                  <div className="stay-info-item"><label>Room & Bed</label><span>🚪 {selectedInpatient.room_number} · 🛏️ {selectedInpatient.bed_number}</span></div>
                  <div className="stay-info-item"><label>Admitting Doctor</label><span>Dr. {selectedInpatient.profiles?.full_name}</span></div>
                  <div className="stay-info-item"><label>Stay Period</label><span>{new Date(selectedInpatient.admission_date).toLocaleDateString()} to {selectedInpatient.discharge_date ? new Date(selectedInpatient.discharge_date).toLocaleDateString() : 'Present'} ({getStayDuration(selectedInpatient.admission_date, selectedInpatient.discharge_date)})</span></div>
                </div>
                {selectedInpatient.notes && (
                  <div className="admission-notes-display">
                    <strong>Admission Notes:</strong>
                    <p>{selectedInpatient.notes}</p>
                  </div>
                )}
              </div>

              {isLoadingHistory ? (
                <div className="history-loader">
                  <Loader2 className="spinner animate-spin" size={32} color="var(--primary-brand)" />
                  <p>Aggregating completed medical logs...</p>
                </div>
              ) : (
                <div className="clinical-history-sections">
                  <h2>Clinical Work Performed (Shaqooyinka loo Qabtay)</h2>

                  {/* 1. Clinical Encounters History */}
                  <div className="history-section">
                    <h3 className="section-title"><ClipboardList size={18} /> Clinical Encounters ({clinicalHistory.encounters?.length || 0})</h3>
                    {!clinicalHistory.encounters || clinicalHistory.encounters.length === 0 ? (
                      <p className="no-data-msg">No clinical encounters recorded.</p>
                    ) : (
                      <div className="vitals-timeline">
                        {clinicalHistory.encounters.map(enc => (
                          <div key={enc.id} className="history-item-card" style={{ marginBottom: '12px', borderLeft: '3px solid var(--primary-brand)' }}>
                            <div className="item-meta">Dr. {enc.profiles?.full_name || 'Unassigned'} on {new Date(enc.visit_date + 'T' + enc.visit_time).toLocaleString()} · status: <strong>{enc.status}</strong></div>
                            <div style={{ margin: '8px 0', fontSize: '0.9rem' }}>
                              <strong>Encounter #:</strong> {enc.encounter_number}
                            </div>
                            {enc.chief_complaint && <div className="detail-row"><strong>Chief Complaint:</strong> {enc.chief_complaint}</div>}
                            {enc.diagnosis && <div className="detail-row"><strong>Diagnosis:</strong> {enc.diagnosis} {enc.icd_code ? `(ICD: ${enc.icd_code})` : ''}</div>}
                            {enc.treatment_plan && <div className="detail-row"><strong>Treatment Plan:</strong> {enc.treatment_plan}</div>}
                            {enc.doctor_notes && <div className="detail-row"><strong>Doctor Notes:</strong> {enc.doctor_notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 1.1 Triage & Vital Signs History */}
                  <div className="history-section" style={{ marginTop: '16px' }}>
                    <h3 className="section-title"><Activity size={18} /> Triage & Vital Signs Logs ({clinicalHistory.triage?.length || 0})</h3>
                    {!clinicalHistory.triage || clinicalHistory.triage.length === 0 ? (
                      <p className="no-data-msg">No triage records found for this inpatient stay.</p>
                    ) : (
                      <div className="vitals-timeline">
                        {clinicalHistory.triage.map(t => (
                          <div key={t.id} className="history-item-card" style={{ borderLeft: '3px solid var(--accent-orange)' }}>
                            <div className="item-meta">Recorded on {new Date(t.created_at).toLocaleString()}</div>
                            <div className="vitals-badges" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
                              {t.blood_pressure && <span className="vital-badge" style={{ background: 'var(--bg-body)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>BP: {t.blood_pressure}</span>}
                              {t.temperature && <span className="vital-badge" style={{ background: 'var(--bg-body)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>Temp: {t.temperature} °C</span>}
                              {t.pulse_rate && <span className="vital-badge" style={{ background: 'var(--bg-body)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>Pulse: {t.pulse_rate} bpm</span>}
                              {t.oxygen_saturation && <span className="vital-badge" style={{ background: 'var(--bg-body)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>SpO2: {t.oxygen_saturation} %</span>}
                              {t.bmi && <span className="vital-badge" style={{ background: 'var(--bg-body)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>BMI: {t.bmi}</span>}
                            </div>
                            {t.triage_notes && <div className="detail-row"><strong>Triage Notes:</strong> {t.triage_notes}</div>}
                            {t.allergy_warning && <div className="detail-row" style={{ color: 'var(--accent-red)' }}><strong>Allergies:</strong> {t.allergy_warning}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Prescriptions History */}
                  <div className="history-section">
                    <h3 className="section-title"><Pill size={18} /> Medication & Prescriptions ({clinicalHistory.prescriptions.length})</h3>
                    {clinicalHistory.prescriptions.length === 0 ? (
                      <p className="no-data-msg">No medications prescribed.</p>
                    ) : (
                      <div className="prescriptions-history-list">
                        {clinicalHistory.prescriptions.map(p => (
                          <div key={p.id} className="history-item-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>{p.medicines?.name} {p.medicines?.generic_name ? `(${p.medicines.generic_name})` : ''}</strong>
                              <span className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</span>
                            </div>
                            <div className="item-meta">Prescribed by Dr. {p.profiles?.full_name} on {new Date(p.created_at).toLocaleDateString()}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                              <span><strong>Dosage:</strong> {p.dosage}</span> · <span><strong>Duration:</strong> {p.duration}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Lab Tests History */}
                  <div className="history-section">
                    <h3 className="section-title"><TestTube size={18} /> Laboratory Investigations ({clinicalHistory.labs.length})</h3>
                    {clinicalHistory.labs.length === 0 ? (
                      <p className="no-data-msg">No lab tests requested.</p>
                    ) : (
                      <div className="labs-history-list">
                        {clinicalHistory.labs.map(l => (
                          <div key={l.id} className="history-item-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>{l.lab_catalog?.test_name} ({l.lab_catalog?.category})</strong>
                              <span className={`status-badge ${l.status.toLowerCase()}`}>{l.status}</span>
                            </div>
                            <div className="item-meta">Requested by Dr. {l.profiles?.full_name} on {new Date(l.created_at).toLocaleDateString()}</div>
                            {l.status === 'Completed' ? (
                              <div className="lab-result-box">
                                <strong>Findings:</strong> {l.result_text || 'No results entered'}
                                {l.notes && <div className="result-note">Note: {l.notes}</div>}
                              </div>
                            ) : (
                              <div className="lab-result-box pending">Waiting for Lab Tech result input.</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. Billing & Invoices */}
                  <div className="history-section">
                    <h3 className="section-title"><DollarSign size={18} /> Financial & Invoices ({clinicalHistory.invoices.length})</h3>
                    {clinicalHistory.invoices.length === 0 ? (
                      <p className="no-data-msg">No financial invoices found.</p>
                    ) : (
                      <div className="invoices-history-list">
                        {clinicalHistory.invoices.map(inv => {
                          const bal = parseFloat(inv.total_amount) - parseFloat(inv.amount_paid);
                          return (
                            <div key={inv.id} className="history-item-card">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>Invoice {inv.invoice_number}</strong>
                                <span className={`status-badge ${inv.status.toLowerCase()}`}>{inv.status}</span>
                              </div>
                              <div className="item-meta">Issued on {new Date(inv.issue_date).toLocaleDateString()}</div>
                              <div className="invoice-money-breakdown">
                                <span><strong>Total Bill:</strong> ${parseFloat(inv.total_amount).toFixed(2)}</span>
                                <span style={{ color: 'var(--primary-brand)' }}><strong>Paid:</strong> ${parseFloat(inv.amount_paid).toFixed(2)}</span>
                                <span style={{ color: bal > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}><strong>Balance:</strong> ${bal.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="premium-btn-outline" onClick={() => setIsDetailsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inpatients;
