import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, Clock, CheckCircle, XCircle, RefreshCw, ChevronRight, Wifi,
  Stethoscope, Pill, TestTube, DollarSign, ClipboardList, Plus, Trash2,
  Activity, Thermometer, Weight, Heart, X, Save, ChevronLeft, Bed, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Queue.css';

// ─── CONSULTATION MODAL ────────────────────────────────────────────────────
const ConsultationModal = ({ appointment, onClose, onComplete }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('vitals');
  const [isSaving, setIsSaving] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [labCatalog, setLabCatalog] = useState([]);
  
  // Patient Lab History state
  const [patientLabHistory, setPatientLabHistory] = useState([]);
  const [isLoadingLabHistory, setIsLoadingLabHistory] = useState(false);

  // Inpatient Admission State
  const [admitInpatient, setAdmitInpatient] = useState(false);
  const [inpatientDetails, setInpatientDetails] = useState({
    room_number: '',
    bed_number: '',
    notes: ''
  });

  // Tab 1 — Vitals & History
  const [vitals, setVitals] = useState({
    chief_complaint: '', symptoms: '', diagnosis: '', treatment_plan: '',
    bp_systolic: '', bp_diastolic: '', temperature: '', weight: '', height: '', notes: ''
  });

  // Tab 2 — Prescriptions
  const [prescriptions, setPrescriptions] = useState([
    { medicine_id: '', dosage: '', duration: '' }
  ]);

  // Tab 3 — Lab Tests
  const [labOrders, setLabOrders] = useState([]);
  const [selectedLabTest, setSelectedLabTest] = useState('');

  // Tab 4 — Billing
  const [billing, setBilling] = useState({
    consultation_fee: '20',
    extra_items: [{ description: '', amount: '' }],
    notes: ''
  });

  const patient = appointment?.patients;

  const [triageData, setTriageData] = useState(null);

  useEffect(() => {
    fetchMedicines();
    fetchLabCatalog();
    fetchPatientLabHistory();
    fetchPatientTriage();
  }, []);

  const fetchPatientTriage = async () => {
    if (!appointment?.patient_id) return;
    try {
      const { data, error } = await supabase
        .from('triage_records')
        .select('*')
        .eq('patient_id', appointment.patient_id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        const tr = data[0];
        setTriageData(tr);
        // Automatically prefill doctor vitals
        let systolic = '', diastolic = '';
        if (tr.blood_pressure && tr.blood_pressure.includes('/')) {
          const parts = tr.blood_pressure.split('/');
          systolic = parts[0];
          diastolic = parts[1];
        }
        setVitals(prev => ({
          ...prev,
          bp_systolic: systolic || prev.bp_systolic,
          bp_diastolic: diastolic || prev.bp_diastolic,
          temperature: tr.temperature?.toString() || prev.temperature,
          weight: tr.weight?.toString() || prev.weight,
          height: tr.height?.toString() || prev.height,
          chief_complaint: tr.triage_notes || prev.chief_complaint
        }));
      }
    } catch (err) {
      console.error('Error fetching patient triage:', err);
    }
  };

  const fetchPatientLabHistory = async () => {
    if (!appointment?.patient_id) return;
    setIsLoadingLabHistory(true);
    try {
      const { data, error } = await supabase
        .from('lab_requests')
        .select('*, lab_catalog(test_name, category), profiles!doctor_id(full_name)')
        .eq('patient_id', appointment.patient_id)
        .order('created_at', { ascending: false });
      if (!error) {
        setPatientLabHistory(data || []);
      }
    } catch (err) {
      console.error('Error fetching lab history:', err);
    } finally {
      setIsLoadingLabHistory(false);
    }
  };

  const fetchMedicines = async () => {
    const { data } = await supabase.from('medicines').select('id, name, generic_name, unit_price').order('name');
    setMedicines(data || []);
  };

  const fetchLabCatalog = async () => {
    const { data } = await supabase.from('lab_catalog').select('id, test_name, category, price').order('test_name');
    setLabCatalog(data || []);
  };

  // ── Prescription handlers
  const addPrescriptionRow = () =>
    setPrescriptions([...prescriptions, { medicine_name: '', dosage: '', duration: '', instructions: '' }]);
  const removePrescriptionRow = (i) =>
    setPrescriptions(prescriptions.filter((_, idx) => idx !== i));
  const updatePrescription = (i, field, val) =>
    setPrescriptions(prescriptions.map((p, idx) => idx === i ? { ...p, [field]: val } : p));

  // ── Lab handlers
  const addLabTest = () => {
    if (!selectedLabTest) return;
    const test = labCatalog.find(t => t.id === selectedLabTest);
    if (!test || labOrders.find(o => o.id === test.id)) return;
    setLabOrders([...labOrders, test]);
    setSelectedLabTest('');
  };
  const removeLabTest = (id) => setLabOrders(labOrders.filter(t => t.id !== id));

  // ── Billing helpers
  const addBillingItem = () =>
    setBilling({ ...billing, extra_items: [...billing.extra_items, { description: '', amount: '' }] });
  const removeBillingItem = (i) =>
    setBilling({ ...billing, extra_items: billing.extra_items.filter((_, idx) => idx !== i) });
  const updateBillingItem = (i, field, val) =>
    setBilling({ ...billing, extra_items: billing.extra_items.map((it, idx) => idx === i ? { ...it, [field]: val } : it) });

  const totalAmount = () => {
    const fee = parseFloat(billing.consultation_fee) || 0;
    const extras = billing.extra_items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
    const labs = labOrders.reduce((s, t) => s + (parseFloat(t.price) || 0), 0);
    return fee + extras + labs;
  };

  // ── SAVE ALL & COMPLETE
  const handleSaveAndComplete = async () => {
    if (admitInpatient && (!inpatientDetails.room_number || !inpatientDetails.bed_number)) {
      alert('Fadlan geli Room Number iyo Bed Number si aad u jiifiso bukaanka.');
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Create a Clinical Encounter (replacing visit_notes)
      const encNum = `ENC-${Math.floor(10000 + Math.random() * 90000)}`;
      const { data: encData, error: encError } = await supabase.from('encounters').insert([{
        encounter_number: encNum,
        patient_id: appointment.patient_id,
        doctor_id: user.id,
        department: appointment.department || 'General OPD',
        visit_type: appointment.visit_type || 'OPD',
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: new Date().toTimeString().split(' ')[0],
        chief_complaint: vitals.chief_complaint || '',
        hpi: vitals.symptoms || '',
        previous_illnesses: '',
        family_history: '',
        allergies: '',
        current_medications: '',
        physical_examination: '',
        doctor_notes: vitals.notes || '',
        diagnosis: vitals.diagnosis || '',
        icd_code: '',
        treatment_plan: vitals.treatment_plan || '',
        status: 'Completed',
        created_by: user.id,
        completed_by: user.id
      }]).select().single();

      if (encError) throw encError;
      const encounterId = encData.id;

      // Also save legacy visit_notes to keep backward compatibility
      if (vitals.chief_complaint || vitals.diagnosis) {
        await supabase.from('visit_notes').insert([{
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          doctor_id: user.id,
          ...vitals,
          bp_systolic: vitals.bp_systolic ? parseInt(vitals.bp_systolic) : null,
          bp_diastolic: vitals.bp_diastolic ? parseInt(vitals.bp_diastolic) : null,
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
          weight: vitals.weight ? parseFloat(vitals.weight) : null,
          height: vitals.height ? parseFloat(vitals.height) : null,
        }]);
      }

      // Link any active triage_record to this encounter
      if (triageData) {
        await supabase.from('triage_records').update({ encounter_id: encounterId }).eq('id', triageData.id);
      }

      // 2. Save Prescriptions
      const validPrescriptions = prescriptions.filter(p => p.medicine_id && p.dosage);
      for (const p of validPrescriptions) {
        await supabase.from('prescriptions').insert([{
          patient_id: appointment.patient_id,
          doctor_id: user.id,
          medicine_id: p.medicine_id,
          dosage: p.dosage,
          duration: p.duration,
          status: 'Pending',
          encounter_id: encounterId
        }]);
      }

      // 3. Save Lab Requests
      for (const test of labOrders) {
        await supabase.from('lab_requests').insert([{
          patient_id: appointment.patient_id,
          doctor_id: user.id,
          test_id: test.id,
          status: 'Pending',
          encounter_id: encounterId
        }]);
      }

      // 4. Create Invoice
      if (totalAmount() > 0) {
        const invNumber = `INV-${Date.now().toString().slice(-6)}`;
        const items = [
          { item_description: 'Consultation Fee', quantity: 1, unit_price: parseFloat(billing.consultation_fee) || 0, total_price: parseFloat(billing.consultation_fee) || 0 },
          ...billing.extra_items.filter(it => it.description && it.amount).map(it => ({
            item_description: it.description,
            quantity: 1,
            unit_price: parseFloat(it.amount),
            total_price: parseFloat(it.amount),
          })),
          ...labOrders.map(t => ({
            item_description: `Lab: ${t.test_name}`,
            quantity: 1,
            unit_price: parseFloat(t.price) || 0,
            total_price: parseFloat(t.price) || 0,
          })),
        ];
        const subtotal = items.reduce((s, it) => s + it.total_price, 0);
        const { data: invData } = await supabase.from('invoices').insert([{
          invoice_number: invNumber,
          patient_id: appointment.patient_id,
          doctor_id: user.id,
          subtotal,
          total_amount: subtotal,
          status: 'Unpaid',
          notes: billing.notes,
          created_by: user.id,
          encounter_id: encounterId
        }]).select().single();

        if (invData) {
          for (const item of items) {
            await supabase.from('invoice_items').insert([{ invoice_id: invData.id, ...item }]);
          }
        }
      }

      // 5. Admit Inpatient if checked
      if (admitInpatient) {
        const { error: inpatientError } = await supabase.from('inpatients').insert([{
          patient_id: appointment.patient_id,
          doctor_id: user.id,
          room_number: inpatientDetails.room_number,
          bed_number: inpatientDetails.bed_number,
          notes: inpatientDetails.notes,
          status: 'Admitted',
          encounter_id: encounterId
        }]);

        if (inpatientError) throw inpatientError;
      }

      // 6. Mark appointment as completed & link encounter_id
      await supabase.from('appointments').update({ status: 'completed', encounter_id: encounterId }).eq('id', appointment.id);

      onComplete();
      onClose();
    } catch (err) {
      console.error('Error saving consultation:', err);
      alert('Khalad yar ayaa dhacay. Isku day mar kale.\n' + (err.message || JSON.stringify(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { key: 'vitals', label: 'Taariikhda', icon: <ClipboardList size={16} /> },
    { key: 'prescriptions', label: 'Daawo', icon: <Pill size={16} /> },
    { key: 'lab', label: 'Lab Tests', icon: <TestTube size={16} /> },
    { key: 'billing', label: 'Lacagta', icon: <DollarSign size={16} /> },
    { key: 'inpatient', label: 'Inpatient Admission', icon: <Bed size={16} /> },
  ];

  return (
    <div className="consult-overlay" onClick={onClose}>
      <div className="consult-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="consult-header">
          <div className="consult-patient-info">
            <div className="consult-avatar">
              {patient?.full_name?.charAt(0)?.toUpperCase() || 'P'}
            </div>
            <div>
              <h2>{patient?.full_name || 'Patient'}</h2>
              <p>{patient?.patient_id} · {patient?.gender} · {patient?.age ? `${patient.age}y` : ''} · <span style={{ color: '#EF4444' }}>{patient?.blood_group}</span></p>
            </div>
          </div>
          <button className="consult-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="consult-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`consult-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="consult-body">
          {/* Critical Patient Medical Warning Banner */}
          {patient && (patient.drug_allergies || patient.food_allergies || patient.chronic_conditions || patient.pregnancy_warning || patient.previous_severe_reactions || patient.infectious_disease_warning || patient.special_care_instructions) && (
            <div className="consult-critical-warnings-banner" style={{ background: '#FEF2F2', border: '2px dashed #EF4444', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: '800', fontSize: '0.9rem', marginBottom: '8px' }}>
                <AlertTriangle size={18} /> CRITICAL MEDICAL ALERT FOR THIS PATIENT
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.8rem' }}>
                {patient.drug_allergies && <span style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '4px 8px', borderRadius: '4px' }}><strong>Allergies:</strong> {patient.drug_allergies}</span>}
                {patient.food_allergies && <span style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', padding: '4px 8px', borderRadius: '4px' }}><strong>Food Allergies:</strong> {patient.food_allergies}</span>}
                {patient.chronic_conditions && <span style={{ background: '#EEF2F6', border: '1px solid #E2E8F0', color: '#1E293B', padding: '4px 8px', borderRadius: '4px' }}><strong>Chronic:</strong> {patient.chronic_conditions}</span>}
                {patient.pregnancy_warning && <span style={{ background: '#FCE7F3', border: '1px solid #FBCFE8', color: '#9D174D', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>🤰 PREGNANT</span>}
                {patient.previous_severe_reactions && <span style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '4px 8px', borderRadius: '4px' }}><strong>Severe Reaction:</strong> {patient.previous_severe_reactions}</span>}
                {patient.infectious_disease_warning && <span style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>☣️ Infectious: {patient.infectious_disease_warning}</span>}
                {patient.special_care_instructions && <span style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '4px 8px', borderRadius: '4px' }}><strong>Special Care:</strong> {patient.special_care_instructions}</span>}
              </div>
            </div>
          )}

          {/* ── TAB 1: Vitals & History */}
          {activeTab === 'vitals' && (
            <div className="consult-section fade-in">
              {triageData && (() => {
                const warnings = [];
                if (triageData.blood_pressure && triageData.blood_pressure.includes('/')) {
                  const parts = triageData.blood_pressure.split('/');
                  const sys = parseInt(parts[0]);
                  const dia = parseInt(parts[1]);
                  if (sys > 140 || dia > 90) warnings.push(`High Blood Pressure (${triageData.blood_pressure} mmHg)`);
                  if (sys < 90 || dia < 60) warnings.push(`Low Blood Pressure (${triageData.blood_pressure} mmHg)`);
                }
                if (triageData.temperature) {
                  const temp = parseFloat(triageData.temperature);
                  if (temp > 38.0) warnings.push(`High Temperature (${temp}°C)`);
                  if (temp < 35.0) warnings.push(`Low Temperature (${temp}°C)`);
                }
                if (triageData.oxygen_saturation && parseInt(triageData.oxygen_saturation) < 95) {
                  warnings.push(`Low Oxygen Saturation (${triageData.oxygen_saturation}%)`);
                }
                if (triageData.blood_glucose) {
                  const gl = parseInt(triageData.blood_glucose);
                  if (gl > 200 || gl < 70) warnings.push(`Dangerous Glucose Level (${gl} mg/dL)`);
                }
                if (triageData.pain_score && parseInt(triageData.pain_score) >= 7) {
                  warnings.push(`Severe Pain Score (${triageData.pain_score}/10)`);
                }
                if (triageData.bmi) {
                  const bmiVal = parseFloat(triageData.bmi);
                  if (bmiVal > 25.0 || bmiVal < 18.5) warnings.push(`Abnormal BMI (${bmiVal})`);
                }
                if (triageData.emergency_flag) {
                  warnings.push("EMERGENCY FLAG ACTIVATED AT TRIAGE!");
                }
                if (warnings.length === 0) return null;
                return (
                  <div className="triage-warnings-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 'bold' }}>
                      <AlertTriangle size={18} /> Visual Warnings from Triage Station:
                    </div>
                    <ul style={{ margin: '4px 0 0 20px', padding: 0, color: '#b91c1c', fontSize: '0.85rem' }}>
                      {warnings.map((w, idx) => <li key={idx} style={{ marginBottom: '2px' }}>{w}</li>)}
                    </ul>
                  </div>
                );
              })()}

              <h3 className="section-title"><Activity size={18} /> Vital Signs</h3>
              <div className="vitals-grid">
                <div className="vital-input-group">
                  <label><Heart size={14} /> Blood Pressure (mmHg)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="premium-input" type="number" placeholder="Systolic" value={vitals.bp_systolic}
                      onChange={e => setVitals({ ...vitals, bp_systolic: e.target.value })} />
                    <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>/</span>
                    <input className="premium-input" type="number" placeholder="Diastolic" value={vitals.bp_diastolic}
                      onChange={e => setVitals({ ...vitals, bp_diastolic: e.target.value })} />
                  </div>
                </div>
                <div className="vital-input-group">
                  <label><Thermometer size={14} /> Temperature (°C)</label>
                  <input className="premium-input" type="number" step="0.1" placeholder="e.g. 37.2" value={vitals.temperature}
                    onChange={e => setVitals({ ...vitals, temperature: e.target.value })} />
                </div>
                <div className="vital-input-group">
                  <label><Weight size={14} /> Weight (kg)</label>
                  <input className="premium-input" type="number" step="0.1" placeholder="e.g. 70" value={vitals.weight}
                    onChange={e => setVitals({ ...vitals, weight: e.target.value })} />
                </div>
                <div className="vital-input-group">
                  <label>Height (cm)</label>
                  <input className="premium-input" type="number" placeholder="e.g. 170" value={vitals.height}
                    onChange={e => setVitals({ ...vitals, height: e.target.value })} />
                </div>
              </div>

              <h3 className="section-title" style={{ marginTop: 24 }}><ClipboardList size={18} /> History & Diagnosis</h3>
              <div className="history-fields">
                <div className="form-group">
                  <label>Chief Complaint (Dhibaatada ugu weyn)</label>
                  <textarea className="premium-input" rows={2} placeholder="Bukaan maxuu ka cabbanayaa?" value={vitals.chief_complaint}
                    onChange={e => setVitals({ ...vitals, chief_complaint: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Symptoms (Calaamadaha)</label>
                  <textarea className="premium-input" rows={2} placeholder="Calaamadaha la arkay..." value={vitals.symptoms}
                    onChange={e => setVitals({ ...vitals, symptoms: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Diagnosis (Xanuunka)</label>
                  <textarea className="premium-input" rows={2} placeholder="Xanuunka la go'aamiyay..." value={vitals.diagnosis}
                    onChange={e => setVitals({ ...vitals, diagnosis: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Treatment Plan (Qorshaha daaweynta)</label>
                  <textarea className="premium-input" rows={2} placeholder="Qorshaha daaweynta..." value={vitals.treatment_plan}
                    onChange={e => setVitals({ ...vitals, treatment_plan: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Additional Notes</label>
                  <textarea className="premium-input" rows={2} placeholder="Wax kale oo muhiim ah..." value={vitals.notes}
                    onChange={e => setVitals({ ...vitals, notes: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: Prescriptions */}
          {activeTab === 'prescriptions' && (
            <div className="consult-section fade-in">
              <div className="section-header-row">
                <h3 className="section-title"><Pill size={18} /> Daawooyinka la Qorayaa</h3>
                <button className="add-row-btn" onClick={addPrescriptionRow}><Plus size={14} /> Kudar</button>
              </div>

              <div className="prescription-table">
                <div className="presc-header-row">
                  <span>Dooro Daawada</span>
                  <span>Dosis</span>
                  <span>Mudada</span>
                  <span></span>
                </div>
                {prescriptions.map((p, i) => (
                  <div key={i} className="presc-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 36px' }}>
                    <select className="premium-input" value={p.medicine_id}
                      onChange={e => updatePrescription(i, 'medicine_id', e.target.value)}>
                      <option value="">— Dooro Daawada —</option>
                      {medicines.map(m => (
                        <option key={m.id} value={m.id}>{m.name} {m.generic_name ? `(${m.generic_name})` : ''}</option>
                      ))}
                    </select>
                    <input className="premium-input" placeholder="1 tablet" value={p.dosage}
                      onChange={e => updatePrescription(i, 'dosage', e.target.value)} />
                    <input className="premium-input" placeholder="7 days" value={p.duration}
                      onChange={e => updatePrescription(i, 'duration', e.target.value)} />
                    <button className="remove-row-btn" onClick={() => removePrescriptionRow(i)} disabled={prescriptions.length === 1}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pharmacy-note">
                <Pill size={14} /> Daawooyinkan si toos ah ayay ugu muuqan doonaan <strong>Pharmacy</strong> page-ka
              </div>
            </div>
          )}

          {/* ── TAB 3: Lab Tests */}
          {activeTab === 'lab' && (
            <div className="consult-section fade-in">
              <div className="section-header-row">
                <h3 className="section-title"><TestTube size={18} /> Lab Tests la Codsanayo</h3>
              </div>

              <div className="lab-add-row">
                <select className="premium-input" value={selectedLabTest}
                  onChange={e => setSelectedLabTest(e.target.value)}>
                  <option value="">— Dooro Test —</option>
                  {labCatalog.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.test_name} ({t.category}) {t.price ? `— $${t.price}` : ''}
                    </option>
                  ))}
                </select>
                <button className="add-lab-btn" onClick={addLabTest}><Plus size={14} /> Kudar</button>
              </div>

              {labOrders.length === 0 ? (
                <div className="empty-lab-state">
                  <TestTube size={32} color="var(--text-muted)" />
                  <p>Wali test la ma codsanin</p>
                </div>
              ) : (
                <div className="lab-orders-list">
                  {labOrders.map((t, i) => (
                    <div key={i} className="lab-order-item">
                      <div className="lab-order-info">
                        <TestTube size={16} color="var(--accent-blue)" />
                        <div>
                          <strong>{t.test_name}</strong>
                          <span>{t.category}</span>
                        </div>
                      </div>
                      <div className="lab-order-right">
                        {t.price && <span className="lab-price">${parseFloat(t.price).toFixed(2)}</span>}
                        <button className="remove-row-btn" onClick={() => removeLabTest(t.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pharmacy-note" style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.2)', color: '#6366F1' }}>
                <TestTube size={14} /> Tests-kan si toos ah ayay ugu muuqan doonaan <strong>Laboratory</strong> page-ka
              </div>

              {/* Lab History Section */}
              <h3 className="section-title" style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <ClipboardList size={18} /> Lab Results & History
              </h3>
              {isLoadingLabHistory ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <Loader2 className="spinner animate-spin" size={24} color="var(--primary-brand)" />
                </div>
              ) : patientLabHistory.length === 0 ? (
                <div className="empty-lab-state" style={{ padding: '20px' }}>
                  <p>No previous lab records found for this patient.</p>
                </div>
              ) : (
                <div className="lab-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {patientLabHistory.map((h) => (
                    <div key={h.id} className={`lab-history-card ${h.status.toLowerCase()}`} style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: h.status === 'Completed' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(245, 158, 11, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{h.lab_catalog?.test_name}</span>
                        <span className={`status-badge ${h.status === 'Completed' ? 'success' : 'warning'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                          {h.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Requested by: {h.profiles?.full_name || 'Doctor'} on {new Date(h.created_at).toLocaleDateString()}
                      </div>
                      {h.status === 'Completed' && (
                        <div style={{ marginTop: '8px', padding: '10px', background: 'var(--bg-card)', borderRadius: '6px', borderLeft: '3px solid var(--primary-brand)', fontSize: '0.9rem' }}>
                          <strong>Findings:</strong> {h.result_text || 'No results entered'}
                          {h.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Note: {h.notes}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: Billing */}
          {activeTab === 'billing' && (
            <div className="consult-section fade-in">
              <h3 className="section-title"><DollarSign size={18} /> Invoice-ka Bukaanka</h3>

              <div className="billing-form">
                <div className="billing-item-row">
                  <span className="billing-item-label">Consultation Fee</span>
                  <div className="billing-amount-input">
                    <span>$</span>
                    <input type="number" className="premium-input" value={billing.consultation_fee}
                      onChange={e => setBilling({ ...billing, consultation_fee: e.target.value })} />
                  </div>
                </div>

                {labOrders.map((t, i) => (
                  <div key={i} className="billing-item-row auto-item">
                    <span className="billing-item-label">🧪 Lab: {t.test_name}</span>
                    <span className="billing-auto-price">${parseFloat(t.price || 0).toFixed(2)}</span>
                  </div>
                ))}

                <div className="extra-items-header">
                  <span>Kharashaad Kale</span>
                  <button className="add-row-btn" onClick={addBillingItem}><Plus size={12} /> Kudar</button>
                </div>

                {billing.extra_items.map((item, i) => (
                  <div key={i} className="presc-row">
                    <input className="premium-input" placeholder="Magaca adeegga (e.g. Xaaladda guud)" value={item.description}
                      onChange={e => updateBillingItem(i, 'description', e.target.value)} style={{ flex: 2 }} />
                    <div className="billing-amount-input">
                      <span>$</span>
                      <input type="number" className="premium-input" placeholder="0.00" value={item.amount}
                        onChange={e => updateBillingItem(i, 'amount', e.target.value)} />
                    </div>
                    <button className="remove-row-btn" onClick={() => removeBillingItem(i)}><Trash2 size={14} /></button>
                  </div>
                ))}

                <div className="billing-notes">
                  <label>Xusuus / Notes</label>
                  <textarea className="premium-input" rows={2} placeholder="Wax kale oo ku saabsan invoice-ka..." value={billing.notes}
                    onChange={e => setBilling({ ...billing, notes: e.target.value })} />
                </div>

                <div className="billing-total">
                  <span>Wadarta</span>
                  <span className="total-amount">${totalAmount().toFixed(2)}</span>
                </div>
              </div>

              <div className="pharmacy-note" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)', color: '#D97706' }}>
                <DollarSign size={14} /> Invoice-kan si toos ah ayuu ugu muuqi doonaa <strong>Billing</strong> page-ka
              </div>
            </div>
          )}

          {/* ── TAB 5: Inpatient Admission */}
          {activeTab === 'inpatient' && (
            <div className="consult-section fade-in">
              <h3 className="section-title"><Bed size={18} /> Inpatient Admission Details</h3>
              
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: '600' }}>
                  <input 
                    type="checkbox" 
                    checked={admitInpatient}
                    onChange={(e) => setAdmitInpatient(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-brand)' }}
                  />
                  Admit patient as an Inpatient (Saa'idka Jiifka)
                </label>
              </div>

              {admitInpatient && (
                <div className="inpatient-form-fields" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>Room Number *</label>
                      <input 
                        className="premium-input" 
                        type="text" 
                        placeholder="e.g. Ward 3, Room 102"
                        required={admitInpatient}
                        value={inpatientDetails.room_number}
                        onChange={e => setInpatientDetails({ ...inpatientDetails, room_number: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Bed Number *</label>
                      <input 
                        className="premium-input" 
                        type="text" 
                        placeholder="e.g. Bed A, Bed 4"
                        required={admitInpatient}
                        value={inpatientDetails.bed_number}
                        onChange={e => setInpatientDetails({ ...inpatientDetails, bed_number: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Admission Notes & Instructions</label>
                    <textarea 
                      className="premium-input" 
                      rows={3} 
                      placeholder="Add treatment plans, diagnostics or admission reasons..." 
                      value={inpatientDetails.notes}
                      onChange={e => setInpatientDetails({ ...inpatientDetails, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}
              
              <div className="pharmacy-note" style={{ marginTop: '20px', background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.2)', color: '#3B82F6' }}>
                <Bed size={14} /> Admitting the patient will add them to the <strong>Inpatients</strong> active floor list.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="consult-footer">
          <button className="consult-cancel-btn" onClick={onClose}>
            <ChevronLeft size={16} /> Dib u noqo
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="consult-save-btn"
              onClick={handleSaveAndComplete}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="saving-spinner">⏳ Keydinaya...</span>
              ) : (
                <><CheckCircle size={16} /> Dhamee &amp; Save</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN QUEUE PAGE ──────────────────────────────────────────────────────
const Queue = () => {
  const { profile } = useAuth();
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLive, setIsLive] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  
  // Filtering for non-doctors
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('All');
  const [doctorsList, setDoctorsList] = useState([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (profile?.role !== 'Doctor') {
      fetchDoctorsList();
    }
  }, [profile]);

  const fetchDoctorsList = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'Doctor');
      setDoctorsList(data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchQueue = useCallback(async () => {
    try {
      let query = supabase
        .from('appointments')
        .select('*, patients(full_name, patient_id, age, gender, blood_group, allergies, medical_history, drug_allergies, food_allergies, chronic_conditions, pregnancy_warning, previous_severe_reactions, infectious_disease_warning, special_care_instructions)')
        .eq('appointment_date', today);

      if (profile?.role === 'Doctor') {
        query = query.eq('doctor_id', profile.id);
      } else if (selectedDoctorFilter !== 'All') {
        query = query.eq('doctor_id', selectedDoctorFilter);
      }

      const { data, error } = await query.order('appointment_time', { ascending: true });

      if (error) throw error;
      setQueue(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, [today, profile, selectedDoctorFilter]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `appointment_date=eq.${today}` },
        () => fetchQueue()
      )
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    return () => supabase.removeChannel(channel);
  }, [today, fetchQueue]);

  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setQueue(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const waitingCount = queue.filter(q => q.status === 'waiting').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const cancelledCount = queue.filter(q => q.status === 'cancelled').length;

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle size={18} color="var(--primary-brand)" />;
    if (status === 'cancelled') return <XCircle size={18} color="var(--accent-red)" />;
    return <Clock size={18} color="var(--accent-orange)" />;
  };

  return (
    <div className="queue-layout">
      {/* Header */}
      <div className="queue-header">
        <div>
          <h1>Today's Queue</h1>
          <p className="queue-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="queue-header-right">
          {profile?.role !== 'Doctor' && doctorsList.length > 0 && (
            <select 
              value={selectedDoctorFilter} 
              onChange={e => setSelectedDoctorFilter(e.target.value)}
              className="premium-input"
              style={{ width: '180px', height: '36px', padding: '0 8px', fontSize: '0.85rem', marginRight: '12px' }}
            >
              <option value="All">All Doctors</option>
              {doctorsList.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.full_name}</option>
              ))}
            </select>
          )}
          <div className={`live-indicator ${isLive ? 'live' : 'offline'}`}>
            <Wifi size={14} />
            {isLive ? 'Live' : 'Connecting...'}
          </div>
          <button className="refresh-btn" onClick={fetchQueue}>
            <RefreshCw size={16} /> Refresh
          </button>
          <span className="last-updated">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="queue-stats">
        <div className="queue-stat waiting">
          <Clock size={20} />
          <div><h3>{waitingCount}</h3><p>Waiting</p></div>
        </div>
        <div className="queue-stat completed">
          <CheckCircle size={20} />
          <div><h3>{completedCount}</h3><p>Completed</p></div>
        </div>
        <div className="queue-stat cancelled">
          <XCircle size={20} />
          <div><h3>{cancelledCount}</h3><p>Cancelled</p></div>
        </div>
        <div className="queue-stat total">
          <UserCheck size={20} />
          <div><h3>{queue.length}</h3><p>Total Today</p></div>
        </div>
      </div>

      {/* Queue Board */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', fontSize: '1rem', color: 'var(--text-muted)' }}>
          Loading queue...
        </div>
      ) : queue.length === 0 ? (
        <div className="queue-empty">
          <Clock size={48} color="var(--text-muted)" />
          <h3>No appointments scheduled for today</h3>
          <p>Appointments booked for today will appear here automatically in real-time.</p>
        </div>
      ) : (
        <div className="queue-list">
          {queue.map((appt, idx) => {
            const isNext = appt.status === 'waiting' && queue.filter(q => q.status === 'waiting')[0]?.id === appt.id;
            return (
              <div key={appt.id} className={`queue-card ${appt.status} ${isNext ? 'next-up' : ''}`}>
                {isNext && <div className="next-up-banner"><ChevronRight size={14} /> Next Up</div>}

                <div className="queue-card-left">
                  <div className="queue-number">
                    {appt.queue_number || `Q-${String(idx + 1).padStart(2, '0')}`}
                  </div>
                  <div className="queue-time">
                    {appt.appointment_time?.substring(0, 5)}
                  </div>
                </div>

                <div className="queue-card-center">
                  <div className="queue-patient-avatar">
                    {appt.patients?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="queue-patient-info">
                    <h3>{appt.patients?.full_name || 'Unknown Patient'}</h3>
                    <p>{appt.patients?.patient_id} · {appt.patients?.gender}, {appt.patients?.age ? `${appt.patients.age}y` : ''}</p>
                    <p className="queue-notes">{appt.notes || 'General Checkup'}</p>
                  </div>
                </div>

                <div className="queue-card-right">
                  <div className="queue-status-display">
                    {getStatusIcon(appt.status)}
                    <span className={`queue-status-text ${appt.status}`}>
                      {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                    </span>
                  </div>

                  {appt.status !== 'cancelled' && (
                    <div className="queue-actions">
                      <button
                        className="q-btn see-patient"
                        onClick={() => setSelectedAppointment(appt)}
                      >
                        <Stethoscope size={14} /> {appt.status === 'completed' ? 'View/Edit Record' : 'See Patient'}
                      </button>
                      {appt.status === 'waiting' && (
                        <button
                          className="q-btn cancel"
                          onClick={() => updateStatus(appt.id, 'cancelled')}
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Consultation Modal */}
      {selectedAppointment && (
        <ConsultationModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onComplete={() => { fetchQueue(); setSelectedAppointment(null); }}
        />
      )}
    </div>
  );
};

export default Queue;
