import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, TestTube, FileText, DollarSign, AlertCircle, Clock, CheckCircle, Printer, Bed, ShieldAlert, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './PatientRecord.css';

const PatientRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [labRequests, setLabRequests] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [inpatientAdmissions, setInpatientAdmissions] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [triageRecords, setTriageRecords] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Modals for grouped records
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [selectedPrescriptionGroup, setSelectedPrescriptionGroup] = useState(null);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoiceGroup, setSelectedInvoiceGroup] = useState(null);

  useEffect(() => {
    if (id) fetchPatientData();
  }, [id]);

  const fetchPatientData = async () => {
    setIsLoading(true);
    try {
      const [patRes, apptRes, labRes, presRes, invRes, inpatientRes, encRes, triageRes, procRes] = await Promise.all([
        supabase.from('patients').select('*').eq('id', id).single(),
        supabase.from('appointments').select('*').eq('patient_id', id).order('appointment_date', { ascending: false }),
        supabase.from('lab_requests').select('*, lab_catalog(test_name, category)').eq('patient_id', id).order('created_at', { ascending: false }),
        supabase.from('prescriptions').select('*, medicines(name, generic_name)').eq('patient_id', id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
        supabase.from('inpatients').select('*, profiles!doctor_id(full_name)').eq('patient_id', id).order('admission_date', { ascending: false }),
        supabase.from('encounters').select('*').eq('patient_id', id).order('visit_date', { ascending: false }),
        supabase.from('triage_records').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
        supabase.from('procedures').select('*, procedure_catalog(name), profiles:doctor_id(full_name)').eq('patient_id', id).order('scheduled_date', { ascending: false })
      ]);

      if (patRes.data) setPatient(patRes.data);
      setAppointments(apptRes.data || []);
      setLabRequests(labRes.data || []);
      setPrescriptions(presRes.data || []);
      setInvoices(invRes.data || []);
      setInpatientAdmissions(inpatientRes.data || []);
      setTriageRecords(triageRes.data || []);
      setProcedures(procRes.data || []);

      // Map doctors client-side for encounters
      const { data: docs } = await supabase.from('profiles').select('id, full_name');
      const docMap = docs ? Object.fromEntries(docs.map(d => [d.id, d])) : {};

      const formattedEncs = (encRes.data || []).map(e => ({
        ...e,
        profiles: docMap[e.doctor_id] || null
      }));

      setEncounters(formattedEncs);
    } catch (err) {
      console.error('Error fetching patient record:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Group Prescriptions by Date
  const groupedPrescriptions = React.useMemo(() => {
    const groups = {};
    prescriptions.forEach(p => {
      const dateStr = new Date(p.created_at).toLocaleDateString();
      if (!groups[dateStr]) groups[dateStr] = { date: dateStr, items: [], status: 'Dispensed' };
      groups[dateStr].items.push(p);
      if (p.status === 'Pending') groups[dateStr].status = 'Pending';
    });
    return Object.values(groups);
  }, [prescriptions]);

  // Group Invoices by Date
  const groupedInvoices = React.useMemo(() => {
    const groups = {};
    invoices.forEach(inv => {
      const dateStr = new Date(inv.created_at).toLocaleDateString();
      if (!groups[dateStr]) groups[dateStr] = { date: dateStr, items: [], total: 0, paid: 0, status: 'Paid' };
      groups[dateStr].items.push(inv);
      groups[dateStr].total += parseFloat(inv.total_amount || 0);
      groups[dateStr].paid += parseFloat(inv.amount_paid || 0);
      if (inv.status === 'UNPAID') groups[dateStr].status = 'UNPAID';
      else if (inv.status === 'Partial' && groups[dateStr].status !== 'UNPAID') groups[dateStr].status = 'Partial';
    });
    return Object.values(groups);
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="page-layout" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="spinner" style={{ width: 40, height: 40, border: '4px solid var(--border-color)', borderTopColor: 'var(--primary-brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page-layout" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <AlertCircle size={48} color="var(--text-muted)" />
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Patient not found.</p>
        <button className="premium-btn" style={{ marginTop: 16 }} onClick={() => navigate('/patients')}>Back to Patients</button>
      </div>
    );
  }

  const initials = patient.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
  const avatarColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
  const avatarColor = avatarColors[patient.full_name?.charCodeAt(0) % avatarColors.length];

  const totalBilled = invoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.amount_paid || 0), 0);



  return (
    <div className="page-layout">
      {/* Action Row */}
      <div className="patient-record-actions-row">
        <button className="back-btn" onClick={() => navigate('/patients')}>
          <ArrowLeft size={18} /> Back to Patients
        </button>
        <button className="print-record-btn" onClick={() => window.print()}>
          <Printer size={16} /> Print Patient Record
        </button>
      </div>

      {/* Patient Hero Card */}
      <div className="patient-hero-card">
        <div className="patient-hero-left">
          <div className="hero-avatar" style={{ background: avatarColor }}>{initials}</div>
          <div className="hero-info">
            <h1>{patient.full_name}</h1>
            <div className="hero-meta">
              <span className="meta-badge">{patient.patient_id}</span>
              <span className="meta-badge">{patient.gender}</span>
              <span className="meta-badge">{patient.age ? `${patient.age} yrs` : 'Age N/A'}</span>
              <span className="meta-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{patient.blood_group}</span>
              {inpatientAdmissions.some(adm => adm.status === 'Admitted') && (
                <span className="meta-badge" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent-orange)', fontWeight: 'bold' }}>
                  🏥 Admitted: Room {inpatientAdmissions.find(adm => adm.status === 'Admitted').room_number}
                </span>
              )}
            </div>
            <div className="hero-contact">
              <span>📞 {patient.phone || 'No phone'}</span>
              <span>📍 {patient.address || 'No address'}</span>
            </div>
          </div>
        </div>
        <div className="patient-hero-right">
          <div className="hero-stat">
            <h3>{appointments.length}</h3>
            <p>Visits</p>
          </div>
          <div className="hero-stat">
            <h3>{labRequests.length}</h3>
            <p>Lab Tests</p>
          </div>
          <div className="hero-stat">
            <h3>${totalPaid.toFixed(0)}</h3>
            <p>Paid</p>
          </div>
          <div className="hero-stat">
            <h3 style={{ color: totalBilled - totalPaid > 0 ? 'var(--accent-red)' : 'var(--primary-brand)' }}>
              ${(totalBilled - totalPaid).toFixed(0)}
            </h3>
            <p>Balance</p>
          </div>
        </div>
      </div>

      {/* Permanent Medical Alert Section */}
      {(patient.drug_allergies || patient.food_allergies || patient.chronic_conditions || patient.pregnancy_warning || patient.previous_severe_reactions || patient.infectious_disease_warning || patient.special_care_instructions) && (
        <div className="patient-medical-alerts-banner" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '2px solid #EF4444', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '12px' }}>
            <ShieldAlert size={24} />
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.025em' }}>CRITICAL MEDICAL ALERTS &amp; WARNINGS</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {patient.drug_allergies && (
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #EF4444' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)' }}>💊 Drug Allergies</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#B91C1C' }}>{patient.drug_allergies}</p>
              </div>
            )}
            {patient.food_allergies && (
              <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #F59E0B' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)' }}>🍎 Food Allergies</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#D97706' }}>{patient.food_allergies}</p>
              </div>
            )}
            {patient.chronic_conditions && (
              <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #6366F1' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)' }}>🩺 Chronic Conditions</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#4F46E5' }}>{patient.chronic_conditions}</p>
              </div>
            )}
            {patient.pregnancy_warning && (
              <div style={{ background: 'rgba(236, 72, 153, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #EC4899' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)' }}>🤰 Pregnancy Warning</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#DB2777' }}>Patient is currently PREGNANT</p>
              </div>
            )}
            {patient.previous_severe_reactions && (
              <div style={{ background: 'rgba(220, 38, 38, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #DC2626' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)' }}>⚠️ Previous Severe Reactions</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#991B1B' }}>{patient.previous_severe_reactions}</p>
              </div>
            )}
            {patient.infectious_disease_warning && (
              <div style={{ background: 'rgba(220, 38, 38, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #DC2626' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)' }}>☣️ Infectious Disease Alert</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#B91C1C' }}>{patient.infectious_disease_warning}</p>
              </div>
            )}
            {patient.special_care_instructions && (
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #10B981' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)' }}>📋 Special Care Instructions</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#059669' }}>{patient.special_care_instructions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="record-tabs">
        {[
          { key: 'overview', label: 'Overview', icon: <User size={16} /> },
          { key: 'encounters', label: `Encounters (${encounters.length})`, icon: <FileText size={16} /> },
          { key: 'appointments', label: `Appointments (${appointments.length})`, icon: <Calendar size={16} /> },
          { key: 'inpatient', label: `Inpatient Stay (${inpatientAdmissions.length})`, icon: <Bed size={16} /> },
          { key: 'lab', label: `Lab Results (${labRequests.length})`, icon: <TestTube size={16} /> },
          { key: 'prescriptions', label: `Prescriptions (${prescriptions.length})`, icon: <FileText size={16} /> },
          { key: 'procedures', label: `Procedures (${procedures.length})`, icon: <ClipboardList size={16} /> },
          { key: 'billing', label: `Billing (${invoices.length})`, icon: <DollarSign size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            className={`record-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="record-content fade-in">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="overview-grid">
            <div className="info-section">
              <h3>Personal Information</h3>
              <div className="info-grid">
                <div className="info-item"><label>Full Name</label><span>{patient.full_name}</span></div>
                <div className="info-item"><label>Date of Birth</label><span>{patient.dob || 'N/A'}</span></div>
                <div className="info-item"><label>Marital Status</label><span>{patient.marital_status}</span></div>
                <div className="info-item"><label>Emergency Contact</label><span>{patient.emergency_contact || 'N/A'}</span></div>
              </div>
            </div>
            <div className="info-section">
              <h3>Medical Information</h3>
              <div className="info-grid">
                <div className="info-item"><label>Blood Group</label><span style={{ color: '#EF4444', fontWeight: 700 }}>{patient.blood_group}</span></div>
                <div className="info-item"><label>Allergies</label><span>{patient.allergies || 'None recorded'}</span></div>
                {patient.gender === 'Female' && (
                  <div className="info-item full"><label>Pregnancy History</label><span>{patient.pregnancy_history || 'N/A'}</span></div>
                )}
                <div className="info-item full">
                  <label>Medical History</label>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{patient.medical_history || 'No history recorded'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Encounters EMR Timeline Tab */}
        {activeTab === 'encounters' && (
          encounters.length === 0 ? (
            <div className="empty-state">No clinical encounters recorded for this patient.</div>
          ) : (
            <div className="timeline" style={{ padding: '10px 0' }}>
              {encounters.map(enc => (
                <div key={enc.id} className="timeline-item" style={{ marginBottom: '30px' }}>
                  <div className="timeline-dot" style={{ backgroundColor: 'var(--primary-brand)' }}></div>
                  <div className="timeline-body" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-brand)' }}>{enc.encounter_number}</span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          📅 {new Date(enc.visit_date).toLocaleDateString()} at {enc.visit_time?.substring(0, 5)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`status-pill status-${enc.status.toLowerCase().replace(' ', '-')}`} style={{ display: 'inline-block' }}>
                          {enc.status}
                        </span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-main)', marginTop: '4px' }}>
                          Attending: Dr. {enc.profiles?.full_name || 'Unassigned'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                      {/* Left: Complaints & Exam */}
                      <div>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chief Complaint</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{enc.chief_complaint || '—'}</p>

                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>History of Present Illness</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{enc.hpi || '—'}</p>

                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Physical Examination</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{enc.physical_examination || '—'}</p>
                      </div>

                      {/* Right: Diagnosis & Plan */}
                      <div>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Diagnosis</h4>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '0 0 16px 0' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{enc.diagnosis || 'No Diagnosis Recorded'}</span>
                          {enc.icd_code && (
                            <span style={{ padding: '2px 8px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              ICD: {enc.icd_code}
                            </span>
                          )}
                        </div>

                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Treatment Plan</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{enc.treatment_plan || '—'}</p>

                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doctor Notes</h4>
                        <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{enc.doctor_notes || '—'}</p>
                      </div>
                    </div>

                    {/* Triage & Vitals section */}
                    {(() => {
                      const t = triageRecords.find(tr => tr.encounter_id === enc.id);
                      if (!t) return null;
                      return (
                        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <h4 style={{ margin: '0', fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Triage Vitals & Signs</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                            <div style={{ background: 'var(--bg-body)', padding: '8px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Blood Pressure</div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{t.blood_pressure || '—'}</div>
                            </div>
                            <div style={{ background: 'var(--bg-body)', padding: '8px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Temperature</div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{t.temperature ? `${t.temperature}°C` : '—'}</div>
                            </div>
                            <div style={{ background: 'var(--bg-body)', padding: '8px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pulse Rate</div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{t.pulse_rate ? `${t.pulse_rate} bpm` : '—'}</div>
                            </div>
                            <div style={{ background: 'var(--bg-body)', padding: '8px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resp. Rate</div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{t.respiratory_rate ? `${t.respiratory_rate}/min` : '—'}</div>
                            </div>
                            <div style={{ background: 'var(--bg-body)', padding: '8px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>O2 Saturation</div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{t.oxygen_saturation ? `${t.oxygen_saturation}%` : '—'}</div>
                            </div>
                            <div style={{ background: 'var(--bg-body)', padding: '8px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BMI</div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{t.bmi || '—'}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          appointments.length === 0 ? (
            <div className="empty-state">No appointments found for this patient.</div>
          ) : (
            <div className="timeline">
              {appointments.map(appt => (
                <div key={appt.id} className="timeline-item">
                  <div className={`timeline-dot ${appt.status}`}></div>
                  <div className="timeline-body">
                    <div className="timeline-header">
                      <span className="timeline-date">{appt.appointment_date} at {appt.appointment_time?.substring(0, 5)}</span>
                      <span className={`status-pill status-${appt.status}`}>{appt.status}</span>
                    </div>
                    <p className="timeline-note">{appt.notes || 'General Checkup'}</p>
                    <p className="timeline-meta">Queue: {appt.queue_number || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Lab Results Tab */}
        {activeTab === 'lab' && (
          labRequests.length === 0 ? (
            <div className="empty-state">No lab tests requested for this patient.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {labRequests.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: 600 }}>{req.lab_catalog?.test_name || 'Unknown'}</td>
                      <td>{req.lab_catalog?.category}</td>
                      <td>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-pill ${req.status === 'Completed' ? 'status-completed' : 'status-waiting'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {req.result_text ? req.result_text.substring(0, 60) + (req.result_text.length > 60 ? '...' : '') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          groupedPrescriptions.length === 0 ? (
            <div className="empty-state">No prescriptions found for this patient.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Medicines Prescribed</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedPrescriptions.map(group => (
                    <tr key={group.date}>
                      <td style={{ fontWeight: 600 }}>{group.date}</td>
                      <td>{group.items.length} Medicines</td>
                      <td>
                        <span className={`status-pill ${group.status === 'Dispensed' ? 'status-completed' : 'status-waiting'}`}>
                          {group.status}
                        </span>
                      </td>
                      <td>
                        <button className="premium-btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => {
                          setSelectedPrescriptionGroup(group);
                          setIsPrescriptionModalOpen(true);
                        }}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Procedures Tab */}
        {activeTab === 'procedures' && (
          procedures.length === 0 ? (
            <div className="empty-state">No surgeries or procedures recorded for this patient.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Procedure</th>
                    <th>Surgeon / Assistants</th>
                    <th>Anaesthesia</th>
                    <th>Status</th>
                    <th>Complications & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {procedures.map(proc => (
                    <tr key={proc.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{proc.scheduled_date}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{proc.scheduled_time?.substring(0, 5)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{proc.procedure_catalog?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Room: {proc.procedure_room || 'N/A'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>Dr. {proc.profiles?.full_name}</div>
                        {proc.assistants && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Asst: {proc.assistants}</div>}
                      </td>
                      <td>{proc.anaesthesia_type}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: proc.status === 'Completed' ? '#D1FAE5' : '#DBEAFE',
                          color: proc.status === 'Completed' ? '#065F46' : '#1E40AF'
                        }}>
                          {proc.status}
                        </span>
                      </td>
                      <td>
                        {proc.complications ? <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem' }}><strong>Complications:</strong> {proc.complications}</div> : null}
                        {proc.procedure_notes ? <div style={{ fontSize: '0.8rem' }}>{proc.procedure_notes}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          groupedInvoices.length === 0 ? (
            <div className="empty-state">No invoices found for this patient.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Billed</th>
                    <th>Total Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInvoices.map(group => {
                    const bal = group.total - group.paid;
                    return (
                      <tr key={group.date}>
                        <td style={{ fontWeight: 600 }}>{group.date}</td>
                        <td>${group.total.toFixed(2)}</td>
                        <td style={{ color: 'var(--primary-brand)' }}>${group.paid.toFixed(2)}</td>
                        <td style={{ color: bal > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>${bal.toFixed(2)}</td>
                        <td>
                          <span className={`status-pill ${group.status === 'Paid' ? 'status-completed' : group.status === 'Partial' ? 'status-waiting' : 'status-cancelled'}`}>
                            {bal > 0 ? 'UNPAID' : 'PAID'}
                          </span>
                        </td>
                        <td>
                          <button className="premium-btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => {
                            setSelectedInvoiceGroup(group);
                            setIsInvoiceModalOpen(true);
                          }}>
                            View {group.items.length} Invoices
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Inpatient Admissions Tab */}
        {activeTab === 'inpatient' && (
          inpatientAdmissions.length === 0 ? (
            <div className="empty-state">No inpatient admissions found for this patient.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room & Bed</th>
                    <th>Admission Date</th>
                    <th>Discharge Date</th>
                    <th>Status</th>
                    <th>Admitting Doctor</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {inpatientAdmissions.map(adm => (
                    <tr key={adm.id}>
                      <td style={{ fontWeight: 600 }}>
                        🚪 {adm.room_number} <br />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🛏️ {adm.bed_number}</span>
                      </td>
                      <td>{new Date(adm.admission_date).toLocaleString()}</td>
                      <td>{adm.discharge_date ? new Date(adm.discharge_date).toLocaleString() : '—'}</td>
                      <td>
                        <span className={`status-pill ${adm.status === 'Admitted' ? 'status-waiting' : 'status-completed'}`} style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: adm.status === 'Admitted' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: adm.status === 'Admitted' ? 'var(--accent-orange)' : 'var(--primary-brand)'
                        }}>
                          {adm.status}
                        </span>
                      </td>
                      <td>Dr. {adm.profiles?.full_name || 'Aisha Ibrahim'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{adm.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        </div>

      {/* ══ PRESCRIPTION DETAILS MODAL (Premium Digital Letter) ══ */}
      {isPrescriptionModalOpen && selectedPrescriptionGroup && (
        <div className="modal-overlay" onClick={() => setIsPrescriptionModalOpen(false)}>
          <div className="modal-content prescription-pad-modal" style={{ maxWidth: 650, width: '100%', padding: 0, overflow: 'hidden', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
            
            {/* Pad Header */}
            <div style={{ background: 'var(--primary-brand)', color: 'white', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <h2 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '1px', fontWeight: 800 }}>Cayush Clinic</h2>
                  <p style={{ margin: '6px 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>Ex-control Afgoye, Mogadishu | Tel: +252 61 9639994</p>
               </div>
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=PT-${patient?.patient_id}-RX-${selectedPrescriptionGroup.date}&color=ffffff&bgcolor=0F766E`} alt="QR Code" style={{ borderRadius: '8px', border: '3px solid rgba(255,255,255,0.2)', width: 64, height: 64 }} />
            </div>

            {/* Pad Info */}
            <div style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-main)', borderBottom: '2px dashed var(--border-color)' }}>
               <div>
                 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Patient Details</div>
                 <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-main)', marginTop: 4 }}>{patient?.full_name}</div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>ID: {patient?.patient_id}</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Prescription Info</div>
                 <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-main)', marginTop: 4 }}>{selectedPrescriptionGroup.date}</div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>Dr. {selectedPrescriptionGroup.items[0]?.profiles?.full_name || 'Cayush'}</div>
               </div>
            </div>

            {/* Pad Body */}
            <div style={{ padding: '32px', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: '3.5rem', fontFamily: 'serif', fontWeight: 'bold', color: 'var(--primary-brand)', lineHeight: 1, marginBottom: '24px', opacity: 0.9 }}>Rx</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {selectedPrescriptionGroup.items.map((p, index) => (
                  <div key={p.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(15, 118, 110, 0.1)', color: 'var(--primary-brand)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 800, fontSize: '0.9rem', marginTop: 2, flexShrink: 0 }}>{index + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 700 }}>{p.medicines?.name}</h4>
                        <span className={`status-pill ${p.status === 'Dispensed' ? 'status-completed' : 'status-waiting'}`} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>{p.status}</span>
                      </div>
                      {p.medicines?.generic_name && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.medicines.generic_name}</div>}
                      <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg-main)', borderRadius: 8, borderLeft: '4px solid var(--accent-blue)', display: 'inline-block' }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>Sig:</span> <span style={{ color: 'var(--text-main)' }}>Take <strong>{p.dosage}</strong> for <strong>{p.duration}</strong></span>
                      </div>
                      {p.notes && <div style={{ fontSize: '0.85rem', color: 'var(--accent-orange)', marginTop: 8 }}><em>Note: {p.notes}</em></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 16, padding: '24px 32px', background: 'var(--bg-main)', borderTop: '1px solid var(--border-color)' }}>
              <button className="premium-btn-outline" style={{ flex: 1, padding: '12px' }} onClick={() => setIsPrescriptionModalOpen(false)}>Close</button>
              <button className="premium-btn" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px' }} onClick={() => {
                document.body.classList.add('printing-prescription');
                window.print();
                setTimeout(() => document.body.classList.remove('printing-prescription'), 500);
              }}>
                <Printer size={18} /> Print Prescription
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🖨️ PRINTABLE PRESCRIPTION LAYER (Hidden by default) */}
      {isPrescriptionModalOpen && selectedPrescriptionGroup && (
        <div className="printable-prescription">
          <div className="clinic-header" style={{ position: 'relative' }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=PT-${patient?.patient_id}-RX-${selectedPrescriptionGroup.date}`} alt="QR Code" style={{ position: 'absolute', right: 0, top: 0, width: '60px', height: '60px' }} />
            <h1>Cayush Clinic</h1>
            <p>Ex-control Afgoye, Mogadishu, Somalia | Tel: +252 61 9639994</p>
          </div>
          <div className="patient-info-print">
            <div>
              <p><strong>Patient Name:</strong> {patient?.full_name}</p>
              <p><strong>Patient ID:</strong> {patient?.patient_id}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Date:</strong> {selectedPrescriptionGroup.date}</p>
              <p><strong>Doctor:</strong> Dr. {selectedPrescriptionGroup.items[0]?.profiles?.full_name || 'Cayush'}</p>
            </div>
          </div>
          <div className="rx-symbol">Rx</div>
          <div className="rx-items">
            {selectedPrescriptionGroup.items.map(p => (
              <div key={p.id} className="rx-item">
                <h4>{p.medicines?.name} {p.medicines?.generic_name ? `(${p.medicines.generic_name})` : ''}</h4>
                <p>Sig: Take {p.dosage} for {p.duration}</p>
              </div>
            ))}
          </div>
          <div className="rx-footer">
            <p>Doctor's Signature</p>
            <div style={{ width: '200px', borderBottom: '1px solid black', marginLeft: 'auto', marginTop: '30px' }}></div>
          </div>
        </div>
      )}

      {/* ══ INVOICE DETAILS MODAL (Premium Receipt Letter) ══ */}
      {isInvoiceModalOpen && selectedInvoiceGroup && (
        <div className="modal-overlay" onClick={() => setIsInvoiceModalOpen(false)}>
          <div className="modal-content receipt-modal" style={{ maxWidth: 850, width: '100%', padding: '40px', overflowY: 'auto', maxHeight: '90vh', background: 'white', color: '#333' }} onClick={e => e.stopPropagation()}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=PT-${patient?.patient_id}-INV-${selectedInvoiceGroup.date}`} alt="QR Code" style={{ width: '80px', height: '80px' }} />
                <div>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#1e3a8a', fontFamily: 'serif', letterSpacing: '1px' }}>Cayush</h1>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f97316', fontWeight: 600, letterSpacing: '1px' }}>Clinic & Hospital</h2>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, fontSize: '2rem', color: '#1e3a8a', letterSpacing: '2px', textTransform: 'uppercase' }}>RECEIPT<br/>LETTER</h1>
              </div>
            </div>

            {/* Info Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '0.95rem' }}>
              <div>
                <div style={{ display: 'flex', marginBottom: '8px', alignItems: 'center' }}>
                  <span style={{ width: '80px', fontWeight: 600 }}>Date:</span>
                  <span style={{ background: '#3b82f6', color: 'white', padding: '4px 16px', borderRadius: '16px', fontWeight: 600 }}>{selectedInvoiceGroup.date}</span>
                </div>
                <div style={{ display: 'flex', marginTop: '12px' }}>
                  <span style={{ width: '80px', fontWeight: 600 }}>Patient:</span>
                  <span><strong>{patient?.patient_id}</strong> {patient?.full_name}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontWeight: 600, marginRight: '16px' }}>Ref #:</span>
                  <span style={{ border: '1px solid #3b82f6', color: '#3b82f6', padding: '2px 16px', borderRadius: '12px', fontWeight: 600 }}>{selectedInvoiceGroup.items[0]?.invoice_number || `INV-${Date.now().toString().slice(-5)}`}</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, marginRight: '16px' }}>Tel:</span>
                  <span>+252 61 9639994</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, marginRight: '16px' }}>Age:</span>
                  <span>{patient?.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years old` : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Table Section */}
            <div style={{ marginBottom: '30px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#3b82f6', color: 'white' }}>
                    <th style={{ padding: '12px', textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '12px', textTransform: 'uppercase' }}>Item/Description</th>
                    <th style={{ padding: '12px', textTransform: 'uppercase' }}>Quantity</th>
                    <th style={{ padding: '12px', textTransform: 'uppercase' }}>Unit Cost</th>
                    <th style={{ padding: '12px', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoiceGroup.items.map((inv, idx) => (
                    <tr key={inv.id} style={{ background: idx % 2 === 0 ? '#fce7f3' : 'white' }}>
                      <td style={{ padding: '12px', color: '#555', borderBottom: '1px solid #eee' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', color: '#555', borderBottom: '1px solid #eee' }}>{inv.notes || 'Medical Service / Consultation'}</td>
                      <td style={{ padding: '12px', color: '#555', borderBottom: '1px solid #eee' }}>1.00</td>
                      <td style={{ padding: '12px', color: '#555', borderBottom: '1px solid #eee' }}>${parseFloat(inv.total_amount).toFixed(2)}</td>
                      <td style={{ padding: '12px', color: '#555', borderBottom: '1px solid #eee' }}>${parseFloat(inv.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Signatures and Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <div style={{ fontWeight: 600, color: '#333' }}>Finance Office</div>
                <div style={{ width: '150px', borderBottom: '1px solid #1e3a8a', margin: '10px auto' }}></div>
              </div>

              <div style={{ background: '#3b82f6', color: 'white', padding: '20px', width: '300px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>SUBTOTAL:</span>
                  <span>${selectedInvoiceGroup.total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>DISCOUNT:</span>
                  <span>$0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>GRAND TOTAL:</span>
                  <span>${selectedInvoiceGroup.total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontWeight: 600 }}>AMOUNT PAID:</span>
                  <span>${selectedInvoiceGroup.paid.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontWeight: 'bold' }}>
                  <span>BALANCE:</span>
                  <span>${(selectedInvoiceGroup.total - selectedInvoiceGroup.paid).toFixed(2)}</span>
                </div>
                <div style={{ textAlign: 'center', fontStyle: 'italic', marginTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.5)', paddingTop: '16px' }}>
                  Thank you for visiting our hospital!
                </div>
              </div>
            </div>

            {/* Dotted Line */}
            <div style={{ borderBottom: '2px dashed #ccc', marginBottom: '20px' }}></div>

            {/* Footer Address */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '0.75rem', color: '#555' }}>
              <span>📍 Ex-control Afgoye, Mogadishu</span>
              <span>🌐 www.cayushclinic.com</span>
              <span>📧 info@cayushclinic.com</span>
              <span>📞 +252 61 9639994</span>
            </div>

            {/* Actions (Hidden in Print) */}
            <div className="no-print" style={{ display: 'flex', gap: 16, marginTop: '30px' }}>
              <button className="premium-btn-outline" style={{ flex: 1, padding: '12px' }} onClick={() => setIsInvoiceModalOpen(false)}>Close</button>
              <button className="premium-btn" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px' }} onClick={() => {
                document.body.classList.add('printing-invoice');
                window.print();
                setTimeout(() => document.body.classList.remove('printing-invoice'), 500);
              }}>
                <Printer size={18} /> Print Receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default PatientRecord;
