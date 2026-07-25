import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Printer, Trash2, ShieldAlert, Award, Search, Calendar, FileText } from 'lucide-react';
import './Certificates.css';

const Certificates = () => {
  const { user } = useAuth();
  const [certs, setCerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: user?.id || '',
    type: 'Sick Leave',
    issue_date: new Date().toISOString().split('T')[0],
    start_date: '',
    end_date: '',
    diagnosis: '',
    description: ''
  });

  useEffect(() => {
    fetchCertificates();
    supabase.from('patients').select('id, full_name, patient_id').order('full_name').then(({ data }) => setPatients(data || []));
    supabase.from('profiles').select('id, full_name').eq('role', 'Doctor').then(({ data }) => setDoctors(data || []));
  }, []);

  const fetchCertificates = async () => {
    setIsLoading(true);
    try {
      // Fetch certificates
      const { data: certData, error: certError } = await supabase
        .from('medical_certificates')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (certError) throw certError;

      // Fetch patients and profiles for mapping
      const { data: patientsList } = await supabase.from('patients').select('id, full_name, patient_id, age, gender');
      const { data: profilesList } = await supabase.from('profiles').select('id, full_name, specialty');

      const patMap = patientsList ? Object.fromEntries(patientsList.map(p => [p.id, p])) : {};
      const profMap = profilesList ? Object.fromEntries(profilesList.map(p => [p.id, p])) : {};

      const formatted = (certData || []).map(c => ({
        ...c,
        patients: patMap[c.patient_id] || null,
        profiles: profMap[c.doctor_id] || null
      }));

      setCerts(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('medical_certificates').insert([{
      ...formData,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null
    }]);

    if (!error) {
      setFormData({
        patient_id: '',
        doctor_id: user?.id || '',
        type: 'Sick Leave',
        issue_date: new Date().toISOString().split('T')[0],
        start_date: '',
        end_date: '',
        diagnosis: '',
        description: ''
      });
      fetchCertificates();
    } else {
      alert('Failed to save certificate: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Ma hubtaa inaad tirtirto warqadan?')) {
      await supabase.from('medical_certificates').delete().eq('id', id);
      fetchCertificates();
    }
  };

  const handlePrint = (cert) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    
    const detailsHtml = cert.type === 'Sick Leave' ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 10px 0; color: #005f54; font-size: 14px; text-transform: uppercase;">Medical Leave Duration</h3>
        <p style="margin: 4px 0; font-size: 15px;"><strong>Start Date:</strong> ${new Date(cert.start_date).toLocaleDateString()}</p>
        <p style="margin: 4px 0; font-size: 15px;"><strong>End Date:</strong> ${new Date(cert.end_date).toLocaleDateString()}</p>
        <p style="margin: 4px 0; font-size: 15px;"><strong>Diagnosis:</strong> ${cert.diagnosis || 'General Medical Condition'}</p>
      </div>
    ` : `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 10px 0; color: #005f54; font-size: 14px; text-transform: uppercase;">Certificate / Consent Details</h3>
        <p style="margin: 4px 0; font-size: 15px;"><strong>Purpose:</strong> ${cert.diagnosis || 'Medical Clearance / Fitness'}</p>
        <p style="margin: 4px 0; font-size: 15px;"><strong>Details:</strong> ${cert.description || 'Verified clear for standard duties.'}</p>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>${cert.type} - ${cert.patients?.full_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; color: #334155; margin: 50px; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #b01d5d; padding-bottom: 24px; margin-bottom: 40px; }
            .clinic-details h1 { margin: 0; font-size: 26px; color: #800000; font-weight: 800; }
            .clinic-details p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
            .cert-title { text-align: right; }
            .cert-title h2 { margin: 0; font-size: 20px; color: #b01d5d; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
            .cert-title p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
            .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 30px; }
            .meta-box h3 { margin: 0 0 12px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #005f54; letter-spacing: 0.5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; }
            .meta-box p { margin: 6px 0; font-size: 14px; }
            .body-text { font-size: 16px; margin-bottom: 40px; color: #1e293b; text-align: justify; }
            .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 100px; }
            .sig-line { height: 1px; background: #94a3b8; width: 220px; margin-bottom: 6px; }
            .bottom-bar { text-align: center; margin-top: 80px; font-size: 12px; color: #94a3b8; border-top: 2px dashed #e2e8f0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-details">
              <h1>CAYUUSH CLINIC & HOSPITAL</h1>
              <p>Ex-control Afgoye, Mogadishu · Tel: +252 61 9639994 · info@cayushclinic.com</p>
            </div>
            <div class="cert-title">
              <h2>${cert.type}</h2>
              <p>Date: ${new Date(cert.issue_date).toLocaleDateString()}</p>
            </div>
          </div>

          <div class="meta-box">
            <h3>Patient Information / Macmiilka</h3>
            <p><strong>Full Name:</strong> ${cert.patients?.full_name}</p>
            <p><strong>Patient ID:</strong> ${cert.patients?.patient_id}</p>
            <p><strong>Age / Gender:</strong> ${cert.patients?.age || 'N/A'} yrs / ${cert.patients?.gender || 'N/A'}</p>
          </div>

          <div class="body-text">
            This is to certify that the patient above has been examined at Cayuush Clinic & Hospital by the undersigned medical officer.
            Based on the clinical evaluation, the following recommendations and details are declared:
          </div>

          ${detailsHtml}

          <div style="font-size: 15px; margin-bottom: 40px; line-height: 1.8;">
            <strong>Additional Notes:</strong><br />
            ${cert.description || 'No additional restrictions are recorded.'}
          </div>

          <div class="footer">
            <div>
              <p style="font-size: 13px; color: #64748b; margin: 0 0 40px 0;">Official Stamp</p>
            </div>
            <div style="text-align: center;">
              <div class="sig-line"></div>
              <strong style="color: #0f172a; font-size: 14px;">Dr. ${cert.profiles?.full_name || 'Cayush Doctor'}</strong><br />
              <span style="font-size: 12px; color: #64748b;">Attending Physician</span>
            </div>
          </div>

          <div class="bottom-bar">
            Cayuush Clinic & Hospital · Ex-control Afgoye, Mogadishu · Tel: +252 61 9639994
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredCerts = certs.filter(c => 
    c.patients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.patients?.patient_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="cert-container">
      {/* Header */}
      <div className="cert-header">
        <h1>📝 Consent Forms &amp; Medical Certificates</h1>
        <p>Soo saarista iyo maaraynta waraaqaha cudur-daarka (Sick Leave) iyo ogolaanshaha qalliinka</p>
      </div>

      <div className="cert-grid">
        {/* Record Form */}
        <div className="cert-panel-card">
          <h3>Abuur Warqad Cusub</h3>
          <form onSubmit={handleSubmit} className="cert-form">
            <div className="cert-field">
              <label>Bukaanka / Patient *</label>
              <select required value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })}>
                <option value="">-- Dooro Bukaanka --</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
              </select>
            </div>
            <div className="cert-field">
              <label>Doctor / Dhakhtarka *</label>
              <select required value={formData.doctor_id} onChange={e => setFormData({ ...formData, doctor_id: e.target.value })}>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div className="cert-field">
              <label>Nooca Warqada / Type *</label>
              <select required value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                <option>Sick Leave</option>
                <option>Surgery Consent Form</option>
                <option>Medical Fitness Certificate</option>
              </select>
            </div>

            {formData.type === 'Sick Leave' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="cert-field">
                  <label>Start Date</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="cert-field">
                  <label>End Date</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
            )}

            <div className="cert-field">
              <label>Diagnosis / Sababta *</label>
              <input type="text" placeholder="Tusaale: Severe Malaria, Surgery Clearance" required value={formData.diagnosis} onChange={e => setFormData({ ...formData, diagnosis: e.target.value })} />
            </div>

            <div className="cert-field">
              <label>Description / Sharaxaad</label>
              <textarea placeholder="Sharaxaad dheeri ah..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>

            <button type="submit" className="premium-btn" style={{ width: '100%', marginTop: '10px' }}>➕ Generate Certificate</button>
          </form>
        </div>

        {/* List Card (Grid of cards layout) */}
        <div className="cert-panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Waraaqaha la Soo Saaray</h3>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', width: '260px' }}>
              <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
              <input 
                type="text" 
                placeholder="Raadi bukaan ama nooc..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-main)', width: '100%', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {isLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading certificates...</p>
          ) : (
            <div className="cert-cards-grid">
              {filteredCerts.map(c => (
                <div className="cert-item-card" key={c.id}>
                  <div className="cert-badge-type">{c.type}</div>
                  <div>
                    <h4 className="cert-patient-name">{c.patients?.full_name}</h4>
                    <p className="cert-patient-sub">ID: {c.patients?.patient_id} · {c.patients?.age || '—'} yrs · {c.patients?.gender || '—'}</p>
                  </div>
                  <div className="cert-divider"></div>
                  <div className="cert-meta-row">
                    <span>Attending:</span>
                    <span style={{ fontWeight: 600 }}>Dr. {c.profiles?.full_name || '—'}</span>
                  </div>
                  <div className="cert-meta-row">
                    <span>Reason:</span>
                    <span style={{ fontWeight: 600 }}>{c.diagnosis}</span>
                  </div>
                  {c.type === 'Sick Leave' && c.start_date && (
                    <div className="cert-meta-row" style={{ color: 'var(--accent-orange)' }}>
                      <span>Leave:</span>
                      <span style={{ fontWeight: 600 }}>{new Date(c.start_date).toLocaleDateString()} - {new Date(c.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="cert-divider"></div>
                  <div className="cert-card-actions">
                    <button onClick={() => handlePrint(c)} className="cert-btn print" title="Print Certificate">
                      <Printer size={15} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="cert-btn delete" title="Tirtir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {filteredCerts.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <FileText size={40} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p>Muu jiro wax warqad caafimaad ah oo la helay.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Certificates;
