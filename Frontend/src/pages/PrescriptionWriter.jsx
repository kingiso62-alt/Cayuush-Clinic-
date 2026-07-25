import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, X, Printer, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import './PrescriptionWriter.css';

const PrescriptionWriter = () => {
  const { user, profile } = useAuth();
  const [doctors, setDoctors]   = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientData, setSelectedPatientData] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    doctor_id:    user?.id || '',
    patient_id:   '',
    patient_name: '',
    patient_age:  '',
    patient_gender: 'Female',
    diagnosis:    '',
    date:         today,
    next_visit:   '',
    medications:  [{ name: '', dosage: '', frequency: '' }],
  });

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, specialty').then(({ data }) => setDoctors(data || []));
    supabase.from('patients').select('id, full_name, age, gender, patient_id, allergies, drug_allergies').order('full_name').then(({ data }) => setPatients(data || []));
  }, []);

  const selectedDoctor = doctors.find(d => d.id === form.doctor_id) || profile;

  const handleField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleMed = (idx, field, value) => {
    const meds = [...form.medications];
    meds[idx] = { ...meds[idx], [field]: value };
    setForm(f => ({ ...f, medications: meds }));
  };

  const addMed = () => setForm(f => ({ ...f, medications: [...f.medications, { name: '', dosage: '', frequency: '' }] }));
  const removeMed = (idx) => setForm(f => ({ ...f, medications: f.medications.filter((_, i) => i !== idx) }));

  const reset = () => {
    setForm({
      doctor_id: user?.id || '',
      patient_id: '',
      patient_name: '', patient_age: '', patient_gender: 'Female',
      diagnosis: '', date: today, next_visit: '',
      medications: [{ name: '', dosage: '', frequency: '' }],
    });
    setSelectedPatientData(null);
  };

  const handlePatientSelect = (e) => {
    const pid = e.target.value;
    const pat = patients.find(p => p.id === pid);
    if (pat) {
      setSelectedPatientData(pat);
      setForm(f => ({ 
        ...f, 
        patient_id: pat.id,
        patient_name: pat.full_name, 
        patient_age: pat.age || '', 
        patient_gender: pat.gender || 'Female' 
      }));
    } else {
      setSelectedPatientData(null);
    }
  };

  // AI Safety Analysis: Check Allergies and Drug-Drug Interactions
  const safetyWarnings = React.useMemo(() => {
    const warnings = [];
    const meds = form.medications.map(m => m.name.trim().toLowerCase()).filter(Boolean);

    // 1. Allergy Warning
    if (selectedPatientData) {
      const patientAllergiesStr = [
        selectedPatientData.allergies,
        selectedPatientData.drug_allergies
      ].filter(Boolean).join(', ').toLowerCase();

      meds.forEach(medName => {
        if (patientAllergiesStr.includes(medName)) {
          warnings.push({
            type: 'allergy',
            severity: 'CRITICAL',
            message: `⚠️ ALLERGY WARNING: Bukaanku wuxuu xasaasiyad u leeyahay daroogada: ${medName.toUpperCase()}!`
          });
        }
      });
    }

    // 2. Drug-Drug Interactions Checks
    const pairs = [];
    for (let i = 0; i < meds.length; i++) {
      for (let j = i + 1; j < meds.length; j++) {
        pairs.push([meds[i], meds[j]]);
      }
    }

    pairs.forEach(([m1, m2]) => {
      const contains = (n1, n2) => (m1.includes(n1) && m2.includes(n2)) || (m1.includes(n2) && m2.includes(n1));

      if (contains('aspirin', 'warfarin')) {
        warnings.push({
          type: 'interaction',
          severity: 'CRITICAL',
          message: '❌ interaction: Aspirin + Warfarin. Halis aad u sareysa oo dhiig-bax ah (Severe Bleeding Risk)!'
        });
      }
      if (contains('ibuprofen', 'aspirin')) {
        warnings.push({
          type: 'interaction',
          severity: 'WARNING',
          message: '⚠️ interaction: Ibuprofen + Aspirin. Waxay kordhisaa cilladaha caloosha iyo boogaha (GI toxicity)!'
        });
      }
      if (contains('sildenafil', 'nitroglycerin')) {
        warnings.push({
          type: 'interaction',
          severity: 'CRITICAL',
          message: '❌ interaction: Sildenafil + Nitroglycerin. Waxay keentaa dhiig-kar aad u hooseeya oo khatar ah (Severe Hypotension)!'
        });
      }
      if (contains('clopidogrel', 'omeprazole')) {
        warnings.push({
          type: 'interaction',
          severity: 'WARNING',
          message: '⚠️ interaction: Clopidogrel + Omeprazole. Omeprazole-ku wuxuu yareeyaa waxtarka Clopidogrel!'
        });
      }
    });

    return warnings;
  }, [form.medications, selectedPatientData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="prx-root">
      {/* ─── LEFT PANEL: FORM ─── */}
      <aside className="prx-form-panel no-print">
        <div className="prx-form-header">
          <h2>✍️ Prescription Writer</h2>
          <p>Cayush Clinic System</p>
        </div>

        <div className="prx-form-body">
          
          {/* AI Clinical Safety Dashboard */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
              <ShieldCheck size={16} color="#0f766e" />
              <span>AI SAFETY WATCH</span>
            </div>
            {safetyWarnings.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Ma jiraan wax is-diido dawo ama xasaasiyad ah oo la helay.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {safetyWarnings.map((w, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      fontSize: '0.76rem', padding: '8px', borderRadius: '6px',
                      background: w.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                      color: w.severity === 'CRITICAL' ? '#991b1b' : '#92400e',
                      borderLeft: `3px solid ${w.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`
                    }}
                  >
                    {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Doctor */}
          <div className="prx-field">
            <label>Doctor</label>
            <select value={form.doctor_id} onChange={e => handleField('doctor_id', e.target.value)}>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} {d.specialty ? `— ${d.specialty}` : ''}</option>)}
            </select>
          </div>

          {/* Patient quick-select */}
          <div className="prx-field">
            <label>Select Patient (optional)</label>
            <select onChange={handlePatientSelect} defaultValue="">
              <option value="">— Type manually or select —</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
            </select>
          </div>

          {/* Patient Name */}
          <div className="prx-field">
            <label>Magaca Bukaanka / Patient Name</label>
            <input type="text" placeholder="Example: Amina Abdi Warsame" value={form.patient_name} onChange={e => handleField('patient_name', e.target.value)} />
          </div>

          {/* Age + Gender row */}
          <div className="prx-row-2">
            <div className="prx-field">
              <label>Da'da / Age</label>
              <input type="number" placeholder="28" value={form.patient_age} onChange={e => handleField('patient_age', e.target.value)} />
            </div>
            <div className="prx-field">
              <label>Gender/Gender</label>
              <select value={form.patient_gender} onChange={e => handleField('patient_gender', e.target.value)}>
                <option value="Female">Female / Dumar</option>
                <option value="Male">Male / Lab</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div className="prx-field">
            <label>Taariikhda / Date</label>
            <input type="date" value={form.date} onChange={e => handleField('date', e.target.value)} />
          </div>

          {/* Diagnosis */}
          <div className="prx-field">
            <label>Disease/Diagnosis</label>
            <input type="text" placeholder="Example: UTI" value={form.diagnosis} onChange={e => handleField('diagnosis', e.target.value)} />
          </div>

          {/* Medications */}
          <div className="prx-section-title">Medications/Medications</div>
          {form.medications.map((med, idx) => (
            <div key={idx} className="prx-med-row">
              <input type="text" placeholder="Medicine name (e.g. Aspirin)" value={med.name} onChange={e => handleMed(idx, 'name', e.target.value)} />
              <input type="text" placeholder="Dosage (500mg)" value={med.dosage} onChange={e => handleMed(idx, 'dosage', e.target.value)} />
              <input type="text" placeholder="Time (3x/day)" value={med.frequency} onChange={e => handleMed(idx, 'frequency', e.target.value)} />
              <button className="prx-remove-btn" onClick={() => removeMed(idx)} disabled={form.medications.length === 1}><X size={14} /></button>
            </div>
          ))}
          <button className="prx-add-btn" onClick={addMed}><Plus size={14} /> Add medicine</button>

          {/* Next Visit */}
          <div className="prx-field" style={{ marginTop: 16 }}>
            <label>Next Visit</label>
            <input type="text" placeholder="Example: 2 weeks" value={form.next_visit} onChange={e => handleField('next_visit', e.target.value)} />
          </div>

          {/* Actions */}
          <button className="prx-print-btn" onClick={handlePrint}>
            <Printer size={16} /> Print Prescription
          </button>
          <button className="prx-reset-btn" onClick={reset}>
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </aside>

      {/* ─── RIGHT PANEL: PREVIEW ─── */}
      <main className="prx-preview-panel" id="prx-printable">
        {/* Header */}
        <div className="prx-preview-header">
          <div className="prx-clinic-info">
            <img src="/logo.png" alt="Cayush Clinic" className="prx-logo" />
            <div>
              <h1 className="prx-doctor-name" style={{ color: '#800000', fontFamily: 'serif', fontSize: '1.7rem', fontWeight: 'bold', margin: 0 }}>
                {selectedDoctor?.full_name || 'Dr Aisho Ibrahim Hoji, MBBS, MD'}
              </h1>
              <p className="prx-specialty" style={{ color: '#555', fontSize: '1rem', fontStyle: 'normal', fontWeight: 'bold', margin: '4px 0 2px 0' }}>
                {selectedDoctor?.specialty || 'Obstetrics, Gynaecology & Infertility'}
              </p>
              <p className="prx-location" style={{ color: '#777', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                Mogadishu, Somalia
              </p>
            </div>
          </div>
          <div className="prx-contact-block" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=CayushClinic-${form.patient_name || 'Patient'}&color=000000&bgcolor=ffffff`}
              alt="QR"
              className="prx-qr"
              style={{ width: '65px', height: '65px', marginBottom: '4px' }}
            />
            <span className="prx-phone" style={{ fontSize: '0.8rem', color: '#111', fontWeight: 'bold' }}>+252 61 9639994</span>
          </div>
        </div>

        {/* Divider */}
        <div className="prx-divider" style={{ height: '4px', background: '#b01d5d', border: 'none', margin: '10px 0 24px 0' }} />

        {/* Rx Title */}
        <div className="prx-rx-title" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '24px', borderBottom: '1px solid #ddd', paddingBottom: '12px' }}>
          <span className="prx-rx-symbol" style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#b01d5d', fontFamily: 'serif' }}>R</span>
          <span className="prx-rx-word" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#005f54', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>Prescription</span>
        </div>

        {/* Patient Info Grid */}
        <div className="prx-info-grid" style={{ gap: '16px', marginBottom: '30px' }}>
          <div className="prx-info-row" style={{ display: 'flex', width: '100%', gap: '20px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
              <span className="prx-info-label" style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px' }}>Patient:</span>
              <span className="prx-info-value" style={{ fontWeight: '500' }}>{form.patient_name || '—'}</span>
            </div>
            <div style={{ width: '220px', display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
              <span className="prx-info-label" style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px' }}>Date:</span>
              <span className="prx-info-value">{form.date || '—'}</span>
            </div>
          </div>

          <div className="prx-info-row" style={{ display: 'flex', width: '100%', gap: '20px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
              <span className="prx-info-label" style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px' }}>Age:</span>
              <span className="prx-info-value">{form.patient_age || '—'}</span>
            </div>
            <div style={{ width: '220px', display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
              <span className="prx-info-label" style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px' }}>Gender:</span>
              <span className="prx-info-value">{form.patient_gender}</span>
            </div>
          </div>

          <div className="prx-info-row" style={{ display: 'flex', width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
              <span className="prx-info-label" style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px' }}>Diagnosis:</span>
              <span className="prx-info-value">{form.diagnosis || '—'}</span>
            </div>
          </div>
        </div>

        {/* Rx Body */}
        <div className="prx-rx-body" style={{ minHeight: '260px' }}>
          <div className="prx-rx-italic" style={{ fontSize: '3rem', color: '#b01d5d', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginBottom: '8px' }}>Rx</div>
          {form.medications.every(m => !m.name) ? (
            <p className="prx-placeholder" style={{ color: '#999', fontSize: '0.95rem', fontStyle: 'italic' }}>(Medications will be listed here)</p>
          ) : (
            <div style={{ paddingLeft: '24px' }}>
              {form.medications.filter(m => m.name).map((m, i) => (
                <div key={i} style={{ marginBottom: '14px', fontSize: '1.1rem', color: '#222', display: 'flex', gap: '15px' }}>
                  <span style={{ fontWeight: 'bold', color: '#b01d5d' }}>{i + 1}.</span>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{m.name}</span> 
                    {m.dosage && <span style={{ marginLeft: '10px', color: '#444' }}>({m.dosage})</span>}
                    {m.frequency && <span style={{ marginLeft: '15px', color: '#005f54', fontStyle: 'italic', fontSize: '0.95rem' }}>— {m.frequency}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="prx-preview-footer">
          <div className="prx-next-visit">
            <span>Next visit: </span>
            <span className="prx-underline prx-next-val">{form.next_visit || '—'}</span>
          </div>
          <div className="prx-signature">
            <div className="prx-sig-line" />
            <span>Saxiixa Dhakhtarka / Doctor's Signature &amp; Stamp</span>
          </div>
        </div>

        <div className="prx-bottom-bar">
          Cayush Clinic • +252 61 9639994 • Mogadishu, Somalia
        </div>
      </main>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .prx-root { display: block !important; }
          .prx-preview-panel { box-shadow: none !important; border: none !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default PrescriptionWriter;
