import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bed, Users, Clock, CheckCircle, Search, Filter, Eye, UserX, Loader2,
  Calendar, ClipboardList, Pill, TestTube, DollarSign, X, CheckSquare,
  ShieldAlert, RefreshCw, LayoutGrid, ArrowRightLeft, Brush, Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Inpatients.css';

const Inpatients = () => {
  const { user } = useAuth();

  // Lists
  const [inpatients, setInpatients] = useState([]);
  const [beds, setBeds] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [wards, setWards] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Admitted'); // 'Admitted', 'Discharged', 'All'
  
  // UI Tabs / Modals
  const [activeView, setActiveView] = useState('patients'); // 'patients', 'map'
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const [selectedInpatient, setSelectedInpatient] = useState(null);
  const [clinicalHistory, setClinicalHistory] = useState({
    encounters: [], prescriptions: [], labs: [], invoices: [], triage: []
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Forms
  const [admitForm, setAdmitForm] = useState({
    patient_id: '', doctor_id: '', bed_id: '', notes: '',
    admission_date: new Date().toISOString().substring(0, 16)
  });

  const [transferForm, setTransferForm] = useState({
    inpatient_id: '', from_bed_id: '', to_bed_id: '', reason: ''
  });

  useEffect(() => {
    fetchInpatients();
    fetchBedsAndRooms();
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

  const fetchBedsAndRooms = async () => {
    try {
      const [bedsRes, roomsRes, wardsRes] = await Promise.all([
        supabase.from('beds').select('*').order('bed_number'),
        supabase.from('rooms').select('*').order('room_number'),
        supabase.from('wards').select('*').order('name')
      ]);
      setBeds(bedsRes.data || []);
      setRooms(roomsRes.data || []);
      setWards(wardsRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInpatients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inpatients')
        .select(`
          *,
          patients (id, patient_id, full_name, age, gender, blood_group, phone, address, allergies, medical_history, drug_allergies, food_allergies, chronic_conditions, pregnancy_warning, previous_severe_reactions, infectious_disease_warning, special_care_instructions),
          profiles!doctor_id (full_name),
          beds(id, bed_number, price_per_day, room_id)
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

  const handleAdmitSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Prevent double bed assignment
      const targetBed = beds.find(b => b.id === admitForm.bed_id);
      if (targetBed && targetBed.availability_status !== 'Available') {
        alert('Bed is not available! Please choose another bed.');
        setIsSubmitting(false);
        return;
      }

      // Find room details
      const targetRoom = rooms.find(r => r.id === targetBed?.room_id);

      const payload = {
        patient_id: admitForm.patient_id,
        doctor_id: admitForm.doctor_id,
        bed_id: admitForm.bed_id,
        room_number: targetRoom?.room_number || 'Room',
        bed_number: targetBed?.bed_number || 'Bed',
        notes: admitForm.notes,
        status: 'Admitted',
        admission_date: admitForm.admission_date
      };

      const { data, error } = await supabase.from('inpatients').insert([payload]).select().single();
      if (error) throw error;

      // 2. Set Bed status to Occupied
      await supabase.from('beds').update({ availability_status: 'Occupied' }).eq('id', admitForm.bed_id);

      setIsAdmitModalOpen(false);
      fetchInpatients();
      fetchBedsAndRooms();
      alert('Patient admitted successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDischarge = async (inpatient) => {
    if (!window.confirm(`Discharge patient: ${inpatient.patients?.full_name}?`)) return;
    setIsSubmitting(true);
    try {
      const dischargeTime = new Date().toISOString();
      const start = new Date(inpatient.admission_date);
      const end = new Date(dischargeTime);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      // Calculate bed charges
      const rate = parseFloat(inpatient.beds?.price_per_day) || 20.00;
      const totalCharge = diffDays * rate;

      // 1. Update Inpatient status
      const { error } = await supabase
        .from('inpatients')
        .update({
          status: 'Discharged',
          discharge_date: dischargeTime,
          total_charge: totalCharge
        })
        .eq('id', inpatient.id);

      if (error) throw error;

      // 2. Mark Bed status for Cleaning
      if (inpatient.bed_id) {
        await supabase.from('beds').update({ availability_status: 'Cleaning' }).eq('id', inpatient.bed_id);
      }

      fetchInpatients();
      fetchBedsAndRooms();
      alert(`Patient discharged. Bed charges: $${totalCharge.toFixed(2)}. Bed set to Cleaning.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTransferModal = (inp) => {
    setTransferForm({
      inpatient_id: inp.id,
      from_bed_id: inp.bed_id || '',
      to_bed_id: '',
      reason: ''
    });
    setSelectedInpatient(inp);
    setIsTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const targetBed = beds.find(b => b.id === transferForm.to_bed_id);
      const targetRoom = rooms.find(r => r.id === targetBed?.room_id);

      // 1. Insert bed transfer log
      await supabase.from('bed_transfers').insert([transferForm]);

      // 2. Update Inpatient record bed links
      await supabase.from('inpatients').update({
        bed_id: transferForm.to_bed_id,
        room_number: targetRoom?.room_number || 'Room',
        bed_number: targetBed?.bed_number || 'Bed'
      }).eq('id', transferForm.inpatient_id);

      // 3. Mark old bed for cleaning, new bed as Occupied
      if (transferForm.from_bed_id) {
        await supabase.from('beds').update({ availability_status: 'Cleaning' }).eq('id', transferForm.from_bed_id);
      }
      await supabase.from('beds').update({ availability_status: 'Occupied' }).eq('id', transferForm.to_bed_id);

      setIsTransferModalOpen(false);
      fetchInpatients();
      fetchBedsAndRooms();
      alert('Patient transferred to new bed successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCleanBed = async (bedId) => {
    try {
      await supabase.from('beds').update({ availability_status: 'Available' }).eq('id', bedId);
      fetchBedsAndRooms();
      alert('Bed cleaned and set to Available!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleMaintenanceBed = async (bedId, isMaintained) => {
    const nextStatus = isMaintained ? 'Available' : 'Maintenance';
    try {
      await supabase.from('beds').update({ availability_status: nextStatus }).eq('id', bedId);
      fetchBedsAndRooms();
    } catch (err) {
      console.error(err);
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
      console.error('Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getStayDuration = (admission, discharge) => {
    const start = new Date(admission);
    const end = discharge ? new Date(discharge) : new Date();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1 ? '1 Day' : `${diffDays} Days`;
  };

  const filteredInpatients = useMemo(() => {
    return inpatients.filter(item => {
      const term = searchTerm.toLowerCase();
      const matchSearch = item.patients?.full_name?.toLowerCase().includes(term) ||
                          item.patients?.patient_id?.toLowerCase().includes(term) ||
                          item.room_number?.toLowerCase().includes(term);
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [inpatients, searchTerm, statusFilter]);

  const activeAdmissions = inpatients.filter(i => i.status === 'Admitted').length;
  const totalBedsCount = beds.length;
  const occupiedBedsCount = beds.filter(b => b.availability_status === 'Occupied').length;

  return (
    <div className="inpatients-page">
      <div className="inpatients-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Inpatient Bed, Ward & Room Management</h2>
          <p className="breadcrumb-path">Dashboard / Facilities & Beds</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="premium-btn-outline" onClick={() => setActiveView(activeView === 'patients' ? 'map' : 'patients')}>
            <LayoutGrid size={16} /> {activeView === 'patients' ? 'Visual Bed Occupancy Map' : 'Inpatient Directory'}
          </button>
          <button className="premium-btn" onClick={() => setIsAdmitModalOpen(true)}>
            <Plus size={16} /> Admit Patient
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="inpatients-kpis">
        <div className="kpi-card blue">
          <div className="kpi-icon-wrapper"><Bed size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">Active Admissions</span>
            <h3>{activeAdmissions}</h3>
            <span className="kpi-subtitle">Occupying beds</span>
          </div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon-wrapper"><CheckCircle size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Beds</span>
            <h3>{totalBedsCount}</h3>
            <span className="kpi-subtitle">Capacity</span>
          </div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon-wrapper"><Users size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">Occupancy Rate</span>
            <h3>{totalBedsCount > 0 ? Math.round((occupiedBedsCount / totalBedsCount) * 100) : 0}%</h3>
            <span className="kpi-subtitle">{occupiedBedsCount} occupied beds</span>
          </div>
        </div>
      </div>

      {activeView === 'patients' ? (
        <>
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
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-dropdown-select">
                <option value="All">All Statuses</option>
                <option value="Admitted">Admitted (Active)</option>
                <option value="Discharged">Discharged</option>
              </select>
              <button className="refresh-btn" onClick={fetchInpatients}>
                <RefreshCw size={16} /> Reload
              </button>
            </div>
          </div>

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
                              <button className="btn-icon view" onClick={() => openDetailsModal(item)}>
                                <Eye size={14} /> File
                              </button>
                              {item.status === 'Admitted' && (
                                <>
                                  <button className="btn-icon view" onClick={() => openTransferModal(item)} style={{ background: '#F59E0B' }}>
                                    <ArrowRightLeft size={14} /> Transfer
                                  </button>
                                  <button className="btn-icon discharge" onClick={() => handleDischarge(item)}>
                                    <UserX size={14} /> Discharge
                                  </button>
                                </>
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
        </>
      ) : (
        // VISUAL OCCUPANCY MAP
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          {wards.map(ward => {
            const wardRooms = rooms.filter(r => r.ward_id === ward.id);
            return (
              <div key={ward.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800 }}>🏠 {ward.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 16px 0' }}>{ward.description}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {wardRooms.map(room => {
                    const roomBeds = beds.filter(b => b.room_id === room.id);
                    return (
                      <div key={room.id} style={{ background: 'var(--bg-body)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6, marginBottom: 12 }}>
                          <strong>Room {room.room_number}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{room.room_type} Room</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {roomBeds.map(bed => {
                            const occPatient = inpatients.find(i => i.bed_id === bed.id && i.status === 'Admitted');
                            return (
                              <div key={bed.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🛏️ {bed.bed_number}</div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rate: ${parseFloat(bed.price_per_day).toFixed(2)}/day</div>
                                  {occPatient && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-red)', fontWeight: 'bold', marginTop: 4 }}>
                                      Occupied: {occPatient.patients?.full_name}
                                    </div>
                                  )}
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 'bold',
                                    background: bed.availability_status === 'Available' ? '#D1FAE5' : bed.availability_status === 'Occupied' ? '#FEE2E2' : '#FEF3C7',
                                    color: bed.availability_status === 'Available' ? '#065F46' : bed.availability_status === 'Occupied' ? '#991B1B' : '#D97706'
                                  }}>{bed.availability_status}</span>
                                  
                                  {bed.availability_status === 'Cleaning' && (
                                    <button className="procedures-action-btn" onClick={() => handleCleanBed(bed.id)} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                      <Brush size={10} /> Mark Clean
                                    </button>
                                  )}
                                  
                                  {bed.availability_status === 'Available' && (
                                    <button className="procedures-action-btn" onClick={() => handleMaintenanceBed(bed.id, false)} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                      <Settings size={10} /> Maintenance
                                    </button>
                                  )}

                                  {bed.availability_status === 'Maintenance' && (
                                    <button className="procedures-action-btn" onClick={() => handleMaintenanceBed(bed.id, true)} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                      <CheckCircle size={10} /> Finish Maint
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADMIT PATIENT MODAL ── */}
      {isAdmitModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAdmitModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>➕ Admit Patient to Ward</h2>
              <button className="close-modal-btn" onClick={() => setIsAdmitModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAdmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Select Patient *</label>
                  <select className="premium-input" required value={admitForm.patient_id} onChange={e => setAdmitForm({ ...admitForm, patient_id: e.target.value })}>
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Select Admitting Doctor *</label>
                  <select className="premium-input" required value={admitForm.doctor_id} onChange={e => setAdmitForm({ ...admitForm, doctor_id: e.target.value })}>
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Select Available Bed *</label>
                  <select className="premium-input" required value={admitForm.bed_id} onChange={e => setAdmitForm({ ...admitForm, bed_id: e.target.value })}>
                    <option value="">-- Choose Bed --</option>
                    {beds.filter(b => b.availability_status === 'Available').map(b => (
                      <option key={b.id} value={b.id}>{b.bed_number} (Price: ${parseFloat(b.price_per_day).toFixed(2)}/day)</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Admission Time *</label>
                  <input type="datetime-local" className="premium-input" required value={admitForm.admission_date} onChange={e => setAdmitForm({ ...admitForm, admission_date: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Admission Notes</label>
                  <textarea className="premium-input" rows={3} value={admitForm.notes} onChange={e => setAdmitForm({ ...admitForm, notes: e.target.value })} placeholder="Diagnosis details, ward orders..." />
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsAdmitModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Confirm Admission</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFER BED MODAL ── */}
      {isTransferModalOpen && selectedInpatient && (
        <div className="modal-overlay" onClick={() => setIsTransferModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>🔄 Transfer Bed: {selectedInpatient.patients?.full_name}</h2>
              <button className="close-modal-btn" onClick={() => setIsTransferModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Current Bed</label>
                  <input type="text" className="premium-input" readOnly value={`${selectedInpatient.bed_number} (${selectedInpatient.room_number})`} style={{ background: 'var(--bg-body)' }} />
                </div>

                <div className="form-group">
                  <label>Select New Available Bed *</label>
                  <select className="premium-input" required value={transferForm.to_bed_id} onChange={e => setTransferForm({ ...transferForm, to_bed_id: e.target.value })}>
                    <option value="">-- Choose New Bed --</option>
                    {beds.filter(b => b.availability_status === 'Available').map(b => (
                      <option key={b.id} value={b.id}>{b.bed_number} (Price: ${parseFloat(b.price_per_day).toFixed(2)}/day)</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Reason for Bed Transfer</label>
                  <textarea className="premium-input" rows={2} required value={transferForm.reason} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })} placeholder="e.g. Patient condition upgraded to ICU" />
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsTransferModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Confirm Transfer</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Clinical File details Modal */}
      {isDetailsModalOpen && selectedInpatient && (
        <div className="modal-overlay" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="patient-header-details">
                <div className="modal-avatar">{selectedInpatient.patients?.full_name?.charAt(0).toUpperCase()}</div>
                <div>
                  <h2>Clinical Record: {selectedInpatient.patients?.full_name}</h2>
                  <p>{selectedInpatient.patients?.patient_id} · {selectedInpatient.patients?.gender}</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsDetailsModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {/* Stay details */}
              <div className="stay-summary-panel">
                <h3>Stay Details</h3>
                <div className="stay-grid">
                  <div className="stay-info-item"><label>Status</label><span className={`status-badge ${selectedInpatient.status.toLowerCase()}`}>{selectedInpatient.status}</span></div>
                  <div className="stay-info-item"><label>Room & Bed</label><span>🚪 {selectedInpatient.room_number} · 🛏️ {selectedInpatient.bed_number}</span></div>
                  <div className="stay-info-item"><label>Admitting Doctor</label><span>Dr. {selectedInpatient.profiles?.full_name}</span></div>
                  <div className="stay-info-item"><label>Stay Period</label><span>{new Date(selectedInpatient.admission_date).toLocaleDateString()} to {selectedInpatient.discharge_date ? new Date(selectedInpatient.discharge_date).toLocaleDateString() : 'Present'}</span></div>
                </div>
              </div>
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
