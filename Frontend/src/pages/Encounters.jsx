import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Edit2, Trash2, ShieldAlert, Award, FileText, ChevronRight, UserPlus } from 'lucide-react';
import './Encounters.css';

const Encounters = () => {
  const { user } = useAuth();
  const [encounters, setEncounters] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    id: '',
    encounter_number: '',
    patient_id: '',
    doctor_id: '',
    department: 'General OPD',
    visit_type: 'OPD',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: new Date().toTimeString().split(' ')[0],
    chief_complaint: '',
    hpi: '',
    previous_illnesses: '',
    family_history: '',
    allergies: '',
    current_medications: '',
    physical_examination: '',
    doctor_notes: '',
    diagnosis: '',
    icd_code: '',
    treatment_plan: '',
    follow_up_date: '',
    status: 'Waiting'
  });

  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'

  useEffect(() => {
    fetchEncounters();
    fetchPatientsAndDoctors();
  }, []);

  const fetchPatientsAndDoctors = async () => {
    const { data: pats } = await supabase.from('patients').select('id, full_name, patient_id').order('full_name');
    setPatients(pats || []);

    const { data: docs } = await supabase.from('profiles').select('id, full_name').eq('role', 'Doctor').order('full_name');
    setDoctors(docs || []);
  };

  const fetchEncounters = async () => {
    setIsLoading(true);
    try {
      const { data: encs, error } = await supabase
        .from('encounters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map client-side to avoid relation caching issues
      const { data: pats } = await supabase.from('patients').select('id, full_name, patient_id');
      const { data: docs } = await supabase.from('profiles').select('id, full_name');

      const patMap = pats ? Object.fromEntries(pats.map(p => [p.id, p])) : {};
      const docMap = docs ? Object.fromEntries(docs.map(d => [d.id, d])) : {};

      const formatted = (encs || []).map(e => ({
        ...e,
        patients: patMap[e.patient_id] || null,
        profiles: docMap[e.doctor_id] || null
      }));

      setEncounters(formatted);
    } catch (err) {
      console.error('Error fetching encounters:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const encNum = formData.encounter_number || `ENC-${Math.floor(10000 + Math.random() * 90000)}`;
    
    const payload = {
      encounter_number: encNum,
      patient_id: formData.patient_id,
      doctor_id: formData.doctor_id || null,
      department: formData.department,
      visit_type: formData.visit_type,
      visit_date: formData.visit_date,
      visit_time: formData.visit_time,
      chief_complaint: formData.chief_complaint,
      hpi: formData.hpi,
      previous_illnesses: formData.previous_illnesses,
      family_history: formData.family_history,
      allergies: formData.allergies,
      current_medications: formData.current_medications,
      physical_examination: formData.physical_examination,
      doctor_notes: formData.doctor_notes,
      diagnosis: formData.diagnosis,
      icd_code: formData.icd_code,
      treatment_plan: formData.treatment_plan,
      follow_up_date: formData.follow_up_date || null,
      status: formData.status,
      created_by: user?.id || null,
      completed_by: formData.status === 'Completed' ? user?.id : null
    };

    try {
      if (modalMode === 'add') {
        const { error } = await supabase.from('encounters').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('encounters').update(payload).eq('id', formData.id);
        if (error) throw error;
      }

      setFormData({
        id: '',
        encounter_number: '',
        patient_id: '',
        doctor_id: '',
        department: 'General OPD',
        visit_type: 'OPD',
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: new Date().toTimeString().split(' ')[0],
        chief_complaint: '',
        hpi: '',
        previous_illnesses: '',
        family_history: '',
        allergies: '',
        current_medications: '',
        physical_examination: '',
        doctor_notes: '',
        diagnosis: '',
        icd_code: '',
        treatment_plan: '',
        follow_up_date: '',
        status: 'Waiting'
      });
      setModalMode('add');
      fetchEncounters();
    } catch (err) {
      alert('Ma badbaadin karin diiwaanka clinical encounter: ' + err.message);
    }
  };

  const handleEdit = (enc) => {
    setFormData({
      id: enc.id,
      encounter_number: enc.encounter_number,
      patient_id: enc.patient_id,
      doctor_id: enc.doctor_id || '',
      department: enc.department || 'General OPD',
      visit_type: enc.visit_type || 'OPD',
      visit_date: enc.visit_date,
      visit_time: enc.visit_time,
      chief_complaint: enc.chief_complaint || '',
      hpi: enc.hpi || '',
      previous_illnesses: enc.previous_illnesses || '',
      family_history: enc.family_history || '',
      allergies: enc.allergies || '',
      current_medications: enc.current_medications || '',
      physical_examination: enc.physical_examination || '',
      doctor_notes: enc.doctor_notes || '',
      diagnosis: enc.diagnosis || '',
      icd_code: enc.icd_code || '',
      treatment_plan: enc.treatment_plan || '',
      follow_up_date: enc.follow_up_date || '',
      status: enc.status
    });
    setModalMode('edit');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Ma hubtaa inaad tirtirto Clinical Encounter-kan?')) {
      await supabase.from('encounters').delete().eq('id', id);
      fetchEncounters();
    }
  };

  const filtered = encounters.filter(e => 
    e.encounter_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.patients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const waitingCount = encounters.filter(e => e.status === 'Waiting').length;
  const consultationCount = encounters.filter(e => e.status === 'In Consultation').length;
  const completedCount = encounters.filter(e => e.status === 'Completed').length;

  return (
    <div className="encounters-page">
      <div className="enc-header">
        <div>
          <h1>📝 Clinical Encounter Manager &amp; EMR</h1>
          <p>La soco bukaan-socodka, baaritaanada caafimaadka, iyo diiwaanada dhakhaatiirta</p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="enc-stats-grid">
        <div className="enc-stat-card">
          <div className="enc-stat-icon" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }}>⌛</div>
          <div className="enc-stat-info">
            <h3>{waitingCount}</h3>
            <p>Waiting Queue</p>
          </div>
        </div>
        <div className="enc-stat-card">
          <div className="enc-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>🩺</div>
          <div className="enc-stat-info">
            <h3>{consultationCount}</h3>
            <p>In Consultation</p>
          </div>
        </div>
        <div className="enc-stat-card">
          <div className="enc-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>✅</div>
          <div className="enc-stat-info">
            <h3>{completedCount}</h3>
            <p>Completed Visits</p>
          </div>
        </div>
      </div>

      <div className="enc-layout">
        {/* Form Panel */}
        <div className="enc-form-panel">
          <h3>{modalMode === 'add' ? 'Abuur Encounter Cusub' : 'Wax ka beddel Encounter-ka'}</h3>
          <form onSubmit={handleSubmit} className="enc-form">
            <div className="enc-form-group">
              <label>Bukaanka / Patient *</label>
              <select required value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })}>
                <option value="">-- Dooro Bukaanka --</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
              </select>
            </div>
            <div className="enc-form-group">
              <label>Doctor / Dhakhtarka *</label>
              <select required value={formData.doctor_id} onChange={e => setFormData({ ...formData, doctor_id: e.target.value })}>
                <option value="">-- Dooro Dhakhtarka --</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div className="enc-form-group">
              <label>Department / Qaybta</label>
              <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                <option>General OPD</option>
                <option>Pediatrics</option>
                <option>Gynecology</option>
                <option>Internal Medicine</option>
                <option>Dental Clinic</option>
              </select>
            </div>
            <div className="enc-form-group">
              <label>Visit Type / Nooca Booqashada</label>
              <select value={formData.visit_type} onChange={e => setFormData({ ...formData, visit_type: e.target.value })}>
                <option>OPD</option>
                <option>Emergency</option>
                <option>Routine Checkup</option>
                <option>Follow-up</option>
              </select>
            </div>
            <div className="enc-form-group">
              <label>Encounter Status</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                <option>Waiting</option>
                <option>In Consultation</option>
                <option>Awaiting Laboratory</option>
                <option>Awaiting Radiology</option>
                <option>Awaiting Pharmacy</option>
                <option>Follow-up Required</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div className="enc-form-group">
              <label>Chief Complaint / Cabashada Bukaanka</label>
              <textarea value={formData.chief_complaint} onChange={e => setFormData({ ...formData, chief_complaint: e.target.value })} rows={2} placeholder="Maxuu ka cabanayaa..." />
            </div>
            <div className="enc-form-group">
              <label>History of Present Illness (HPI)</label>
              <textarea value={formData.hpi} onChange={e => setFormData({ ...formData, hpi: e.target.value })} rows={2} placeholder="Halkuu ka bilaawday..." />
            </div>
            <div className="enc-form-group">
              <label>Diagnosis / Cudurka</label>
              <input type="text" value={formData.diagnosis} onChange={e => setFormData({ ...formData, diagnosis: e.target.value })} placeholder="Diagnosis" />
            </div>
            <div className="enc-form-group">
              <label>ICD-Ready Code</label>
              <input type="text" value={formData.icd_code} onChange={e => setFormData({ ...formData, icd_code: e.target.value })} placeholder="Tusaale: A09 (Gastroenteritis)" />
            </div>
            <div className="enc-form-group">
              <label>Treatment Plan / Qorshaha Daawaynta</label>
              <textarea value={formData.treatment_plan} onChange={e => setFormData({ ...formData, treatment_plan: e.target.value })} rows={2} placeholder="Plan" />
            </div>
            <button type="submit" className="premium-btn" style={{ width: '100%' }}>➕ Save Encounter</button>
          </form>
        </div>

        {/* List Panel */}
        <div className="enc-list-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Diiwaanka Clinical Encounters</h3>
            <div className="enc-search-bar">
              <Search size={16} color="var(--text-muted)" />
              <input type="text" placeholder="Raadi encounter..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="enc-table-wrap">
            {isLoading ? <p>Loading encounters...</p> : (
              <table className="enc-table">
                <thead>
                  <tr>
                    <th>Encounter #</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Department</th>
                    <th>Diagnosis</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 'bold' }}>{e.encounter_number}</td>
                      <td>{e.patients?.full_name || '—'}</td>
                      <td>Dr. {e.profiles?.full_name || '—'}</td>
                      <td>{e.department}</td>
                      <td>{e.diagnosis || '—'}</td>
                      <td>
                        <span className={`enc-status-badge ${e.status.toLowerCase().replace(' ', '-')}`}>
                          {e.status}
                        </span>
                      </td>
                      <td>
                        <div className="enc-action-btns">
                          <button className="enc-icon-btn" onClick={() => handleEdit(e)} title="Wax ka beddel">
                            <Edit2 size={14} />
                          </button>
                          <button className="enc-icon-btn" onClick={() => handleDelete(e.id)} title="Tirtir" style={{ color: 'var(--accent-red)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Muu jiro wax encounter ah oo la helay.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Encounters;
