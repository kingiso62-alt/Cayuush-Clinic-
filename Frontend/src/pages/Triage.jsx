import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Trash2, Printer, AlertTriangle, ShieldAlert } from 'lucide-react';
import './Triage.css';

const Triage = () => {
  const { user } = useAuth();
  const [triageRecords, setTriageRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    patient_id: '',
    encounter_id: '',
    blood_pressure: '',
    temperature: '',
    pulse_rate: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    weight: '',
    height: '',
    bmi: '',
    blood_glucose: '',
    pain_score: '0',
    consciousness_level: 'Alert',
    pregnancy_status: false,
    triage_notes: '',
    allergy_warning: '',
    emergency_flag: false
  });

  // Calculate BMI client-side
  useEffect(() => {
    if (formData.weight && formData.height) {
      const w = parseFloat(formData.weight);
      const h = parseFloat(formData.height) / 100; // convert cm to m
      if (h > 0) {
        const calculatedBmi = (w / (h * h)).toFixed(1);
        setFormData(prev => ({ ...prev, bmi: calculatedBmi }));
      }
    } else {
      setFormData(prev => ({ ...prev, bmi: '' }));
    }
  }, [formData.weight, formData.height]);

  useEffect(() => {
    fetchTriageRecords();
    supabase.from('patients').select('id, full_name, patient_id').order('full_name').then(({ data }) => setPatients(data || []));
  }, []);

  const handlePatientChange = async (patientId) => {
    setFormData(prev => ({ ...prev, patient_id: patientId, encounter_id: '' }));
    if (patientId) {
      const { data } = await supabase
        .from('encounters')
        .select('id, encounter_number')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      setEncounters(data || []);
    } else {
      setEncounters([]);
    }
  };

  const fetchTriageRecords = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('triage_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: pats } = await supabase.from('patients').select('id, full_name, patient_id');
      const { data: encs } = await supabase.from('encounters').select('id, encounter_number');

      const patMap = pats ? Object.fromEntries(pats.map(p => [p.id, p])) : {};
      const encMap = encs ? Object.fromEntries(encs.map(e => [e.id, e])) : {};

      const formatted = (data || []).map(t => ({
        ...t,
        patients: patMap[t.patient_id] || null,
        encounters: encMap[t.encounter_id] || null
      }));

      setTriageRecords(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        temperature: formData.temperature ? parseFloat(formData.temperature) : null,
        pulse_rate: formData.pulse_rate ? parseInt(formData.pulse_rate) : null,
        respiratory_rate: formData.respiratory_rate ? parseInt(formData.respiratory_rate) : null,
        oxygen_saturation: formData.oxygen_saturation ? parseInt(formData.oxygen_saturation) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        bmi: formData.bmi ? parseFloat(formData.bmi) : null,
        blood_glucose: formData.blood_glucose ? parseInt(formData.blood_glucose) : null,
        pain_score: parseInt(formData.pain_score),
        encounter_id: formData.encounter_id || null,
        recorded_by: user?.id || null
      };

      const { error } = await supabase.from('triage_records').insert([payload]);
      if (error) throw error;

      setFormData({
        patient_id: '',
        encounter_id: '',
        blood_pressure: '',
        temperature: '',
        pulse_rate: '',
        respiratory_rate: '',
        oxygen_saturation: '',
        weight: '',
        height: '',
        bmi: '',
        blood_glucose: '',
        pain_score: '0',
        consciousness_level: 'Alert',
        pregnancy_status: false,
        triage_notes: '',
        allergy_warning: '',
        emergency_flag: false
      });
      fetchTriageRecords();
    } catch (err) {
      alert('Failed to save triage details: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Ma hubtaa inaad tirtirto diiwaankan triage-ka?')) {
      await supabase.from('triage_records').delete().eq('id', id);
      fetchTriageRecords();
    }
  };

  // Evaluate abnormal conditions
  const getWarnings = (v) => {
    const list = [];
    const t = parseFloat(v.temperature);
    if (t > 38.0) list.push({ text: `High Temperature: ${t}°C`, level: 'danger' });
    if (t < 35.5 && t > 0) list.push({ text: `Low Temperature: ${t}°C`, level: 'warning' });

    const o2 = parseInt(v.oxygen_saturation);
    if (o2 < 95 && o2 > 0) list.push({ text: `Low Oxygen Saturation: ${o2}%`, level: 'danger' });

    const pain = parseInt(v.pain_score);
    if (pain >= 7) list.push({ text: `Severe Pain: Score ${pain}/10`, level: 'danger' });

    const glu = parseInt(v.blood_glucose);
    if (glu > 200) list.push({ text: `High Glucose Reading: ${glu} mg/dL`, level: 'danger' });
    if (glu < 70 && glu > 0) list.push({ text: `Low Glucose Reading: ${glu} mg/dL`, level: 'danger' });

    const bmiVal = parseFloat(v.bmi);
    if (bmiVal > 25.0) list.push({ text: `High BMI (Overweight): ${bmiVal}`, level: 'warning' });
    if (bmiVal < 18.5 && bmiVal > 0) list.push({ text: `Low BMI (Underweight): ${bmiVal}`, level: 'warning' });

    return list;
  };

  const handlePrintSlip = (rec) => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    printWindow.document.write(`
      <html>
        <head>
          <title>Triage Slip - ${rec.patients?.full_name}</title>
          <style>
            body { font-family: sans-serif; color: #334155; padding: 30px; line-height: 1.5; }
            .slip-header { text-align: center; border-bottom: 2px solid #b01d5d; padding-bottom: 15px; margin-bottom: 20px; }
            .slip-header h2 { margin: 0; color: #800000; }
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .vitals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
            .vital-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .vital-box strong { display: block; font-size: 12px; color: #64748b; text-transform: uppercase; }
            .vital-box span { font-size: 18px; font-weight: bold; color: #0f172a; }
            .warning-banner { margin-top: 20px; background: #fef2f2; border: 1px solid #fee2e2; color: #ef4444; padding: 12px; border-radius: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="slip-header">
            <h2>CAYUUSH CLINIC & HOSPITAL</h2>
            <p>Triage Slip / Diiwaanka Hordhaca ah</p>
          </div>

          <div class="meta-row">
            <span><strong>Patient:</strong> ${rec.patients?.full_name} (${rec.patients?.patient_id})</span>
            <span><strong>Date:</strong> ${new Date(rec.created_at).toLocaleString()}</span>
          </div>

          ${rec.emergency_flag ? '<div class="warning-banner">⚠️ EMERGENCY VISIT / XAALAD DEG-DEG AH</div>' : ''}

          <div class="vitals-grid">
            <div class="vital-box"><strong>Blood Pressure</strong><span>${rec.blood_pressure || '—'}</span></div>
            <div class="vital-box"><strong>Temperature</strong><span>${rec.temperature ? rec.temperature + '°C' : '—'}</span></div>
            <div class="vital-box"><strong>Pulse Rate</strong><span>${rec.pulse_rate ? rec.pulse_rate + ' bpm' : '—'}</span></div>
            <div class="vital-box"><strong>Oxygen Saturation (SpO2)</strong><span>${rec.oxygen_saturation ? rec.oxygen_saturation + '%' : '—'}</span></div>
            <div class="vital-box"><strong>Weight / Height</strong><span>${rec.weight || '—'} kg / ${rec.height || '—'} cm</span></div>
            <div class="vital-box"><strong>BMI</strong><span>${rec.bmi || '—'}</span></div>
            <div class="vital-box"><strong>Blood Glucose</strong><span>${rec.blood_glucose ? rec.blood_glucose + ' mg/dL' : '—'}</span></div>
            <div class="vital-box"><strong>Pain Score</strong><span>${rec.pain_score}/10</span></div>
          </div>

          <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            <strong>Triage Notes:</strong>
            <p style="margin: 5px 0 0 0; font-size: 14px;">${rec.triage_notes || 'No notes.'}</p>
          </div>

          ${rec.allergy_warning ? `
            <div style="margin-top: 15px; background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 6px; color: #d97706; font-size: 14px;">
              <strong>⚠️ Allergy Alert:</strong> ${rec.allergy_warning}
            </div>
          ` : ''}

          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filtered = triageRecords.filter(t => 
    t.patients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.patients?.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="triage-page">
      <div className="triage-header">
        <div>
          <h1>🩺 Triage &amp; Vital Signs Station</h1>
          <p>Diiwaangeli calaamadaha nolosha bukaanka (Vitals) ka hor inta uusan u tegin dhakhtarka</p>
        </div>
      </div>

      <div className="triage-grid">
        {/* Form Panel */}
        <div className="triage-form-card">
          <h3>Diiwaangeli Vitals</h3>
          <form onSubmit={handleSubmit} className="triage-form">
            <div className="triage-group">
              <label>Bukaanka / Patient *</label>
              <select required value={formData.patient_id} onChange={e => {
                setFormData({ ...formData, patient_id: e.target.value });
                handlePatientChange(e.target.value);
              }}>
                <option value="">-- Dooro Bukaanka --</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
              </select>
            </div>

            <div className="triage-group">
              <label>Link to Active Encounter</label>
              <select value={formData.encounter_id} onChange={e => setFormData({ ...formData, encounter_id: e.target.value })}>
                <option value="">-- No Active Encounter --</option>
                {encounters.map(enc => (
                  <option key={enc.id} value={enc.id}>{enc.encounter_number}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="triage-group">
                <label>Blood Pressure (BP)</label>
                <input type="text" placeholder="120/80" value={formData.blood_pressure} onChange={e => setFormData({ ...formData, blood_pressure: e.target.value })} />
              </div>
              <div className="triage-group">
                <label>Temp (°C)</label>
                <input type="number" step="0.1" placeholder="36.5" value={formData.temperature} onChange={e => setFormData({ ...formData, temperature: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="triage-group">
                <label>Pulse Rate (PR bpm)</label>
                <input type="number" placeholder="80" value={formData.pulse_rate} onChange={e => setFormData({ ...formData, pulse_rate: e.target.value })} />
              </div>
              <div className="triage-group">
                <label>Resp Rate (RR /min)</label>
                <input type="number" placeholder="18" value={formData.respiratory_rate} onChange={e => setFormData({ ...formData, respiratory_rate: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="triage-group">
                <label>Oxygen Sat (SpO2 %)</label>
                <input type="number" placeholder="98" value={formData.oxygen_saturation} onChange={e => setFormData({ ...formData, oxygen_saturation: e.target.value })} />
              </div>
              <div className="triage-group">
                <label>Pain Score (0-10)</label>
                <select value={formData.pain_score} onChange={e => setFormData({ ...formData, pain_score: e.target.value })}>
                  {[...Array(11).keys()].map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div className="triage-group">
                <label>Weight (kg)</label>
                <input type="number" step="0.1" placeholder="70" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} />
              </div>
              <div className="triage-group">
                <label>Height (cm)</label>
                <input type="number" step="0.1" placeholder="175" value={formData.height} onChange={e => setFormData({ ...formData, height: e.target.value })} />
              </div>
              <div className="triage-group">
                <label>BMI (Auto)</label>
                <input type="text" readOnly disabled value={formData.bmi} style={{ background: 'var(--bg-hover)' }} />
              </div>
            </div>

            <div className="triage-group">
              <label>Blood Glucose (mg/dL)</label>
              <input type="number" placeholder="100" value={formData.blood_glucose} onChange={e => setFormData({ ...formData, blood_glucose: e.target.value })} />
            </div>

            <div className="triage-group">
              <label>Consciousness Level</label>
              <select value={formData.consciousness_level} onChange={e => setFormData({ ...formData, consciousness_level: e.target.value })}>
                <option>Alert</option>
                <option>Voice (Jawaab hadal)</option>
                <option>Pain (Jawaab xanuun)</option>
                <option>Unresponsive (Kooma)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '16px', margin: '6px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.pregnancy_status} onChange={e => setFormData({ ...formData, pregnancy_status: e.target.checked })} />
                Pregnancy (Uur leh)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 'bold' }}>
                <input type="checkbox" checked={formData.emergency_flag} onChange={e => setFormData({ ...formData, emergency_flag: e.target.checked })} />
                🚨 EMERGENCY (Deg-deg)
              </label>
            </div>

            <div className="triage-group">
              <label>Allergies / Xasaasiyad</label>
              <input type="text" placeholder="Tusaale: Penicillin, Peanuts" value={formData.allergy_warning} onChange={e => setFormData({ ...formData, allergy_warning: e.target.value })} />
            </div>

            <div className="triage-group">
              <label>Triage Notes</label>
              <textarea placeholder="Qor faahfaahin dheeri ah..." value={formData.triage_notes} onChange={e => setFormData({ ...formData, triage_notes: e.target.value })} rows={2} />
            </div>

            {/* Instant Warnings Evaluator */}
            {getWarnings(formData).length > 0 && (
              <div className="triage-warnings-box">
                {getWarnings(formData).map((w, idx) => (
                  <div key={idx} className={`triage-warning-item ${w.level}`}>
                    ⚠️ {w.text}
                  </div>
                ))}
              </div>
            )}

            <button type="submit" className="premium-btn" style={{ width: '100%', marginTop: '10px' }}>➕ Save Vitals</button>
          </form>
        </div>

        {/* List Card */}
        <div className="triage-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Diiwaanka Vitals-ka Bukaannada</h3>
            <div className="enc-search-bar" style={{ maxWidth: '260px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input type="text" placeholder="Raadi bukaan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="triage-table-wrap">
            {isLoading ? <p>Loading triage records...</p> : (
              <table className="triage-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Encounter</th>
                    <th>BP</th>
                    <th>Temp</th>
                    <th>SpO2</th>
                    <th>BMI</th>
                    <th>Alerts</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const warnings = getWarnings(t);
                    return (
                      <tr key={t.id} style={{ borderLeft: t.emergency_flag ? '4px solid var(--accent-red)' : 'none' }}>
                        <td style={{ fontWeight: 'bold' }}>{t.patients?.full_name}</td>
                        <td>{t.encounters?.encounter_number || '—'}</td>
                        <td>{t.blood_pressure || '—'}</td>
                        <td>{t.temperature ? `${t.temperature}°C` : '—'}</td>
                        <td>{t.oxygen_saturation ? `${t.oxygen_saturation}%` : '—'}</td>
                        <td>{t.bmi || '—'}</td>
                        <td>
                          {warnings.length > 0 ? (
                            <span className="triage-vital-badge danger" title={warnings.map(w => w.text).join(', ')}>
                              {warnings.length} Warnings
                            </span>
                          ) : (
                            <span className="triage-vital-badge normal">Normal</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="enc-icon-btn" onClick={() => handlePrintSlip(t)} title="Daabac Slip">
                              <Printer size={14} />
                            </button>
                            <button className="enc-icon-btn" onClick={() => handleDelete(t.id)} title="Tirtir" style={{ color: 'var(--accent-red)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Muu jiro wax diiwaan triage ah oo la helay.</td>
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

export default Triage;
