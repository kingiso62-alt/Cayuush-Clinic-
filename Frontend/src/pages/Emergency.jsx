import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, Loader2, AlertCircle, Clock, Trash2, Edit,
  ShieldAlert, UserCheck, Stethoscope, Eye, Navigation,
  DollarSign, Activity, FileText, X
} from 'lucide-react';
import './Emergency.css';

const Emergency = () => {
  const { user } = useAuth();

  // Lists
  const [cases, setCases] = useState([]);
  const [trips, setTrips] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // UI / Loading
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('cases'); // 'cases', 'ambulance'
  
  // Modals
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Search / Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [triageFilter, setTriageFilter] = useState('All');

  // Form States
  const [caseForm, setCaseForm] = useState({
    patient_id: '', is_unknown: false, unknown_patient_description: '',
    arrival_method: 'Walk-in', arrival_time: new Date().toISOString().substring(0, 16),
    emergency_contact: '', initial_complaint: '', triage_category: 'Green',
    assigned_doctor_id: '', immediate_treatment: '', emergency_medications: '',
    procedures_performed: '', admission_decision: 'Discharged',
    transfer_destination: '', discharge_outcome: ''
  });

  const [tripForm, setTripForm] = useState({
    ambulance_number: '', driver_name: '', medical_staff: '',
    pickup_location: '', destination: 'Cayush Specialist Clinic',
    dispatch_time: new Date().toISOString().substring(0, 16),
    arrival_time: '', trip_status: 'Dispatched',
    patient_condition: '', trip_expense: '', emergency_case_id: ''
  });

  useEffect(() => {
    fetchCases();
    fetchTrips();
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [patRes, docRes] = await Promise.all([
        supabase.from('patients').select('id, full_name, patient_id').order('full_name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'Doctor').order('full_name')
      ]);
      setPatients(patRes.data || []);
      setDoctors(docRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCases = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('emergency_cases')
        .select('*, patients(id, patient_id, full_name, age, gender), profiles:assigned_doctor_id(full_name)')
        .order('arrival_time', { ascending: false });

      if (error) throw error;
      setCases(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrips = async () => {
    try {
      const { data } = await supabase
        .from('ambulance_trips')
        .select('*, emergency_cases(case_number)')
        .order('dispatch_time', { ascending: false });
      setTrips(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCaseSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...caseForm,
        patient_id: caseForm.is_unknown ? null : (caseForm.patient_id || null),
        assigned_doctor_id: caseForm.assigned_doctor_id || null,
        transfer_destination: caseForm.transfer_destination || null
      };
      delete payload.is_unknown;

      if (modalMode === 'add') {
        const countRes = await supabase.from('emergency_cases').select('id', { count: 'exact', head: true });
        const currentCount = countRes.count || 0;
        const caseNo = `ER-${10001 + currentCount}`;

        const { error } = await supabase.from('emergency_cases').insert([{ ...payload, case_number: caseNo }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('emergency_cases').update(payload).eq('id', selectedCase.id);
        if (error) throw error;
      }
      setIsCaseModalOpen(false);
      fetchCases();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTripSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...tripForm,
        arrival_time: tripForm.arrival_time || null,
        trip_expense: parseFloat(tripForm.trip_expense) || 0.00,
        emergency_case_id: tripForm.emergency_case_id || null
      };

      if (modalMode === 'add') {
        const { error } = await supabase.from('ambulance_trips').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ambulance_trips').update(payload).eq('id', selectedTrip.id);
        if (error) throw error;
      }
      setIsTripModalOpen(false);
      fetchTrips();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCase = async (id) => {
    if (window.confirm('Are you sure you want to delete this emergency case?')) {
      try {
        await supabase.from('emergency_cases').delete().eq('id', id);
        setCases(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openCaseAddModal = () => {
    setCaseForm({
      patient_id: '', is_unknown: false, unknown_patient_description: '',
      arrival_method: 'Walk-in', arrival_time: new Date().toISOString().substring(0, 16),
      emergency_contact: '', initial_complaint: '', triage_category: 'Green',
      assigned_doctor_id: '', immediate_treatment: '', emergency_medications: '',
      procedures_performed: '', admission_decision: 'Discharged',
      transfer_destination: '', discharge_outcome: ''
    });
    setModalMode('add');
    setSelectedCase(null);
    setIsCaseModalOpen(true);
  };

  const openCaseEditModal = (ec) => {
    setSelectedCase(ec);
    setCaseForm({
      patient_id: ec.patient_id || '',
      is_unknown: !ec.patient_id,
      unknown_patient_description: ec.unknown_patient_description || '',
      arrival_method: ec.arrival_method || 'Walk-in',
      arrival_time: new Date(ec.arrival_time).toISOString().substring(0, 16),
      emergency_contact: ec.emergency_contact || '',
      initial_complaint: ec.initial_complaint || '',
      triage_category: ec.triage_category || 'Green',
      assigned_doctor_id: ec.assigned_doctor_id || '',
      immediate_treatment: ec.immediate_treatment || '',
      emergency_medications: ec.emergency_medications || '',
      procedures_performed: ec.procedures_performed || '',
      admission_decision: ec.admission_decision || 'Discharged',
      transfer_destination: ec.transfer_destination || '',
      discharge_outcome: ec.discharge_outcome || ''
    });
    setModalMode('edit');
    setIsCaseModalOpen(true);
  };

  const openTripAddModal = () => {
    setTripForm({
      ambulance_number: '', driver_name: '', medical_staff: '',
      pickup_location: '', destination: 'Cayush Specialist Clinic',
      dispatch_time: new Date().toISOString().substring(0, 16),
      arrival_time: '', trip_status: 'Dispatched',
      patient_condition: '', trip_expense: '', emergency_case_id: ''
    });
    setModalMode('add');
    setSelectedTrip(null);
    setIsTripModalOpen(true);
  };

  const openTripEditModal = (t) => {
    setSelectedTrip(t);
    setTripForm({
      ambulance_number: t.ambulance_number || '',
      driver_name: t.driver_name || '',
      medical_staff: t.medical_staff || '',
      pickup_location: t.pickup_location || '',
      destination: t.destination || 'Cayush Specialist Clinic',
      dispatch_time: new Date(t.dispatch_time).toISOString().substring(0, 16),
      arrival_time: t.arrival_time ? new Date(t.arrival_time).toISOString().substring(0, 16) : '',
      trip_status: t.trip_status || 'Dispatched',
      patient_condition: t.patient_condition || '',
      trip_expense: t.trip_expense || '',
      emergency_case_id: t.emergency_case_id || ''
    });
    setModalMode('edit');
    setIsTripModalOpen(true);
  };

  const filteredCases = useMemo(() => {
    return cases.filter(ec => {
      const term = searchTerm.toLowerCase();
      const patientName = ec.patients?.full_name?.toLowerCase() || 'unknown patient';
      const patientId = ec.patients?.patient_id?.toLowerCase() || '';
      const caseNum = ec.case_number?.toLowerCase() || '';

      const matchesSearch = patientName.includes(term) || patientId.includes(term) || caseNum.includes(term);
      const matchesTriage = triageFilter === 'All' || ec.triage_category === triageFilter;

      return matchesSearch && matchesTriage;
    });
  }, [cases, searchTerm, triageFilter]);

  const stats = useMemo(() => {
    return {
      red: cases.filter(c => c.triage_category === 'Red' && c.admission_decision === 'Observation').length,
      orange: cases.filter(c => c.triage_category === 'Orange').length,
      yellow: cases.filter(c => c.triage_category === 'Yellow').length,
      activeTrips: trips.filter(t => t.trip_status !== 'Completed' && t.trip_status !== 'Cancelled').length
    };
  }, [cases, trips]);

  return (
    <div className="emergency-layout">
      {/* Header */}
      <div className="emergency-header-row">
        <div className="emergency-header-left">
          <h1>Emergency & Ambulance dispatch</h1>
          <p className="emergency-subtitle">Admit critical emergencies, perform triage assessment and dispatch ambulance crews.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="premium-btn-outline" onClick={openTripAddModal}>
            <Navigation size={16} /> Dispatch Ambulance
          </button>
          <button className="premium-btn" onClick={openCaseAddModal}>
            <Plus size={16} /> Admit Emergency Case
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="emergency-stats-grid">
        <div className="emergency-stat-card">
          <div className="emergency-stat-icon red"><Activity size={20} /></div>
          <div className="emergency-stat-info">
            <h3>{cases.filter(c => c.triage_category === 'Red').length}</h3>
            <p>Red (Immediate)</p>
          </div>
        </div>
        <div className="emergency-stat-card">
          <div className="emergency-stat-icon orange"><AlertCircle size={20} /></div>
          <div className="emergency-stat-info">
            <h3>{stats.orange}</h3>
            <p>Orange (Very Urgent)</p>
          </div>
        </div>
        <div className="emergency-stat-card">
          <div className="emergency-stat-icon yellow"><Clock size={20} /></div>
          <div className="emergency-stat-info">
            <h3>{stats.yellow}</h3>
            <p>Yellow (Urgent)</p>
          </div>
        </div>
        <div className="emergency-stat-card">
          <div className="emergency-stat-icon ambulance"><Navigation size={20} /></div>
          <div className="emergency-stat-info">
            <h3>{stats.activeTrips}</h3>
            <p>Active Ambulance Trips</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="procedures-tab-pills" style={{ alignSelf: 'flex-start' }}>
        <button className={`procedures-tab-pill ${activeTab === 'cases' ? 'active' : ''}`} onClick={() => setActiveTab('cases')}>Emergency Cases</button>
        <button className={`procedures-tab-pill ${activeTab === 'ambulance' ? 'active' : ''}`} onClick={() => setActiveTab('ambulance')}>Ambulance Dispatch Tracker</button>
      </div>

      {activeTab === 'cases' ? (
        <>
          {/* Toolbar */}
          <div className="emergency-toolbar">
            <div className="emergency-search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search patient name, case number, description..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="emergency-filter-select" value={triageFilter} onChange={e => setTriageFilter(e.target.value)}>
              <option value="All">All Triage Categories</option>
              <option value="Red">Red — Immediate</option>
              <option value="Orange">Orange — Very Urgent</option>
              <option value="Yellow">Yellow — Urgent</option>
              <option value="Green">Green — Standard</option>
              <option value="Blue">Blue — Non-urgent</option>
            </select>
            <button className="emergency-reset-btn" onClick={() => { setSearchTerm(''); setTriageFilter('All'); }}>Reset</button>
          </div>

          {/* Cases List */}
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <Loader2 className="spinner" size={32} color="var(--primary-brand)" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>No emergency cases found.</div>
          ) : (
            <div className="emergency-grid">
              {filteredCases.map(ec => (
                <div key={ec.id} className={`emergency-card ${ec.triage_category.toLowerCase()}`}>
                  <div className="emergency-card-header">
                    <span className="emergency-card-number">{ec.case_number}</span>
                    <span className={`emergency-triage-badge ${ec.triage_category.toLowerCase()}`}>{ec.triage_category}</span>
                  </div>

                  <div className="emergency-card-patient">
                    <h3>{ec.patients?.full_name || 'UNKNOWN PATIENT'}</h3>
                    {ec.unknown_patient_description ? (
                      <p style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>{ec.unknown_patient_description}</p>
                    ) : (
                      <p>{ec.patients?.patient_id} · {ec.patients?.gender} · {ec.patients?.age}y</p>
                    )}
                  </div>

                  <div className="emergency-card-details">
                    <div className="emergency-detail-row">
                      <span className="emergency-detail-label">Arrival Method:</span>
                      <span className="emergency-detail-value">{ec.arrival_method}</span>
                    </div>
                    <div className="emergency-detail-row">
                      <span className="emergency-detail-label">Severity:</span>
                      <span className="emergency-detail-value" style={{ fontWeight: 'bold' }}>{ec.triage_category} Triage</span>
                    </div>
                    <div className="emergency-detail-row">
                      <span className="emergency-detail-label">Attending Doctor:</span>
                      <span className="emergency-detail-value">Dr. {ec.profiles?.full_name || 'Unassigned'}</span>
                    </div>
                  </div>

                  <div className="emergency-card-complaint">
                    <h4>Initial Complaint</h4>
                    <p>{ec.initial_complaint}</p>
                  </div>

                  <div className="emergency-card-footer">
                    <span className={`emergency-decision-badge ${ec.admission_decision.toLowerCase()}`}>
                      {ec.admission_decision}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="maternity-action-btn" onClick={() => openCaseEditModal(ec)}>Update Case</button>
                      <button className="procedures-action-btn" style={{ color: 'var(--accent-red)' }} onClick={() => handleDeleteCase(ec.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        // Ambulance Tracker List
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table className="procedures-data-table">
            <thead>
              <tr>
                <th>Ambulance No</th>
                <th>Driver / Medical Staff</th>
                <th>Pickup Location</th>
                <th>Dispatch Time</th>
                <th>Status</th>
                <th>Condition & Expense</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(trip => (
                <tr key={trip.id}>
                  <td><strong>{trip.ambulance_number}</strong></td>
                  <td>
                    <div>Driver: {trip.driver_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Staff: {trip.medical_staff || 'None'}</div>
                  </td>
                  <td>{trip.pickup_location}</td>
                  <td>{new Date(trip.dispatch_time).toLocaleString()}</td>
                  <td>
                    <span className={`procedures-status-pill ${trip.trip_status.toLowerCase().replace(' ', '-')}`}>{trip.trip_status}</span>
                  </td>
                  <td>
                    <div>Condition: {trip.patient_condition || 'N/A'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary-brand)', fontWeight: 'bold' }}>Cost: ${parseFloat(trip.trip_expense).toFixed(2)}</div>
                  </td>
                  <td>
                    <button className="procedures-action-btn" onClick={() => openTripEditModal(trip)}><Edit size={12} /> Update Trip</button>
                  </td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>No ambulance trips dispatched yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CREATE / EDIT CASE MODAL ── */}
      {isCaseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCaseModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '➕ Admit Emergency Case' : '📝 Update Emergency Record'}</h2>
              <button className="close-modal-btn" onClick={() => setIsCaseModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCaseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="unknown_chk"
                    checked={caseForm.is_unknown}
                    onChange={e => setCaseForm({ ...caseForm, is_unknown: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="unknown_chk" style={{ cursor: 'pointer', margin: 0, fontWeight: 'bold', color: 'var(--accent-red)' }}>Admit as Unknown/Unidentified Patient</label>
                </div>

                {!caseForm.is_unknown ? (
                  <div className="form-group">
                    <label>Select Registered Patient *</label>
                    <select className="premium-input" required={!caseForm.is_unknown} value={caseForm.patient_id} onChange={e => setCaseForm({ ...caseForm, patient_id: e.target.value })}>
                      <option value="">-- Select Patient --</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Unknown Patient Physical Description *</label>
                    <input
                      type="text"
                      className="premium-input"
                      required={caseForm.is_unknown}
                      value={caseForm.unknown_patient_description}
                      onChange={e => setCaseForm({ ...caseForm, unknown_patient_description: e.target.value })}
                      placeholder="e.g. Unconscious male, approx 30 yrs, wearing blue shirt"
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Arrival Method *</label>
                    <select className="premium-input" value={caseForm.arrival_method} onChange={e => setCaseForm({ ...caseForm, arrival_method: e.target.value })}>
                      <option>Walk-in</option>
                      <option>Ambulance</option>
                      <option>Brought by Relative</option>
                      <option>Police</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Triage Category *</label>
                    <select className="premium-input" value={caseForm.triage_category} onChange={e => setCaseForm({ ...caseForm, triage_category: e.target.value })}>
                      <option value="Red">Red — Immediate (Critical)</option>
                      <option value="Orange">Orange — Very Urgent</option>
                      <option value="Yellow">Yellow — Urgent</option>
                      <option value="Green">Green — Standard</option>
                      <option value="Blue">Blue — Non-urgent</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Arrival Time *</label>
                    <input type="datetime-local" className="premium-input" required value={caseForm.arrival_time} onChange={e => setCaseForm({ ...caseForm, arrival_time: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Assigned Emergency Doctor</label>
                    <select className="premium-input" value={caseForm.assigned_doctor_id} onChange={e => setCaseForm({ ...caseForm, assigned_doctor_id: e.target.value })}>
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Initial Complaint *</label>
                  <input type="text" className="premium-input" required value={caseForm.initial_complaint} onChange={e => setCaseForm({ ...caseForm, initial_complaint: e.target.value })} placeholder="e.g. Chest pain radiating to left arm, dyspnea" />
                </div>

                <div className="form-group">
                  <label>Emergency Contact details</label>
                  <input type="text" className="premium-input" value={caseForm.emergency_contact} onChange={e => setCaseForm({ ...caseForm, emergency_contact: e.target.value })} placeholder="Name and Phone number of relative" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Immediate Treatment Given</label>
                    <textarea className="premium-input" rows={2} value={caseForm.immediate_treatment} onChange={e => setCaseForm({ ...caseForm, immediate_treatment: e.target.value })} placeholder="e.g. Oxygen therapy, IV access established" />
                  </div>
                  <div className="form-group">
                    <label>Emergency Medications Administered</label>
                    <textarea className="premium-input" rows={2} value={caseForm.emergency_medications} onChange={e => setCaseForm({ ...caseForm, emergency_medications: e.target.value })} placeholder="e.g. Aspirin 300mg PO, Morphine 2mg IV" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Admission / Exit Decision *</label>
                    <select className="premium-input" value={caseForm.admission_decision} onChange={e => setCaseForm({ ...caseForm, admission_decision: e.target.value })}>
                      <option value="Discharged">Discharged</option>
                      <option value="Admitted">Admitted to Inpatient</option>
                      <option value="Observation">Under Observation</option>
                      <option value="Transferred">Transferred External</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Transfer Destination (if transferred)</label>
                    <input type="text" className="premium-input" value={caseForm.transfer_destination} onChange={e => setCaseForm({ ...caseForm, transfer_destination: e.target.value })} placeholder="e.g. Benadir Hospital" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Discharge Outcome</label>
                  <input type="text" className="premium-input" value={caseForm.discharge_outcome} onChange={e => setCaseForm({ ...caseForm, discharge_outcome: e.target.value })} placeholder="Stable, recovered, referred..." />
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsCaseModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Save Record</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── DISPATCH AMBULANCE MODAL ── */}
      {isTripModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTripModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '🚒 Dispatch Ambulance Crew' : '📝 Update Ambulance Dispatch'}</h2>
              <button className="close-modal-btn" onClick={() => setIsTripModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleTripSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Ambulance Vehicle Number *</label>
                    <input type="text" className="premium-input" required value={tripForm.ambulance_number} onChange={e => setTripForm({ ...tripForm, ambulance_number: e.target.value })} placeholder="e.g. AMB-03" />
                  </div>
                  <div className="form-group">
                    <label>Driver Name *</label>
                    <input type="text" className="premium-input" required value={tripForm.driver_name} onChange={e => setTripForm({ ...tripForm, driver_name: e.target.value })} placeholder="e.g. Omar Abdi" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Medical Staff On Board</label>
                    <input type="text" className="premium-input" value={tripForm.medical_staff} onChange={e => setTripForm({ ...tripForm, medical_staff: e.target.value })} placeholder="e.g. Paramedic Ahmed" />
                  </div>
                  <div className="form-group">
                    <label>Pickup Location *</label>
                    <input type="text" className="premium-input" required value={tripForm.pickup_location} onChange={e => setTripForm({ ...tripForm, pickup_location: e.target.value })} placeholder="e.g. KM4 Intersection, Mogadishu" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Dispatch Time *</label>
                    <input type="datetime-local" className="premium-input" required value={tripForm.dispatch_time} onChange={e => setTripForm({ ...tripForm, dispatch_time: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Arrival Time (at clinic)</label>
                    <input type="datetime-local" className="premium-input" value={tripForm.arrival_time} onChange={e => setTripForm({ ...tripForm, arrival_time: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Trip Status *</label>
                    <select className="premium-input" value={tripForm.trip_status} onChange={e => setTripForm({ ...tripForm, trip_status: e.target.value })}>
                      <option value="Dispatched">Dispatched</option>
                      <option value="En Route">En Route</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trip Expense ($) *</label>
                    <input type="number" step="0.01" className="premium-input" required value={tripForm.trip_expense} onChange={e => setTripForm({ ...tripForm, trip_expense: e.target.value })} placeholder="e.g. 15.00" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Patient Condition Details</label>
                  <input type="text" className="premium-input" value={tripForm.patient_condition} onChange={e => setTripForm({ ...tripForm, patient_condition: e.target.value })} placeholder="e.g. Conscious, severe leg fracture" />
                </div>

                <div className="form-group">
                  <label>Link to Emergency Case (Optional)</label>
                  <select className="premium-input" value={tripForm.emergency_case_id} onChange={e => setTripForm({ ...tripForm, emergency_case_id: e.target.value })}>
                    <option value="">-- Choose Case --</option>
                    {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} · {c.patients?.full_name || 'Unknown'}</option>)}
                  </select>
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsTripModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Dispatch / Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Emergency;
