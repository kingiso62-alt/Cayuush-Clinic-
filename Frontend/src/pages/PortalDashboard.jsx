import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PortalDashboard = () => {
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [prescriptions, setPrescriptions] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('portal_patient');
    if (!stored) { window.location.href = '/portal'; return; }
    const pat = JSON.parse(stored);
    setPatient(pat);
    fetchData(pat.id);
  }, []);

  const fetchData = async (patientId) => {
    setIsLoading(true);
    try {
      const [rxRes, labRes, invRes, apptRes] = await Promise.all([
        supabase.from('prescriptions').select('*, medicines(name, generic_name)').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('lab_requests').select('*, lab_catalog(test_name, category)').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*, profiles!doctor_id(full_name)').eq('patient_id', patientId).order('appointment_date', { ascending: false })
      ]);
      setPrescriptions(rxRes.data || []);
      setLabResults(labRes.data || []);
      setInvoices(invRes.data || []);
      setAppointments(apptRes.data || []);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const logout = () => { sessionStorage.removeItem('portal_patient'); window.location.href = '/portal'; };

  const totalBill = invoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.amount_paid || 0), 0);
  const balance   = totalBill - totalPaid;
  const age = patient?.dob ? `${new Date().getFullYear() - new Date(patient.dob).getFullYear()} yrs` : (patient?.age ? `${patient.age} yrs` : 'N/A');
  const initials = patient?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'P';

  const tabs = [
    { key: 'overview',      label: 'Overview',      emoji: '🏠' },
    { key: 'prescriptions', label: 'Dawooyinka',    emoji: '💊' },
    { key: 'lab',           label: 'Shaybaarada',   emoji: '🧪' },
    { key: 'billing',       label: 'Lacag-bixinta', emoji: '💳' },
    { key: 'appointments',  label: 'Balammada',     emoji: '📅' },
  ];

  const card = {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '20px',
    padding: '24px'
  };

  if (!patient) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0b1120 0%, #0f2744 55%, #0a4a3a 100%)', fontFamily: "'Inter','Segoe UI',sans-serif", color: 'white' }}>

      {/* ── TOP NAV ── */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px', height: 68, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 100 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo.png" alt="Cayush Clinic" style={{ height: 44, objectFit: 'contain', filter: 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(20,184,166,0.5))' }} />
          <div style={{ width: '1px', height: 28, background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px', fontWeight: 500 }}>Patient Health Portal</span>
        </div>
        {/* User Info + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{patient.full_name}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>{patient.patient_id}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>{initials}</div>
          <button onClick={logout} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', padding: '8px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Sign Out</button>
        </div>
      </nav>

      {/* ── TABS ── */}
      <div style={{ padding: '20px 32px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '9px 20px', borderRadius: 50, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontWeight: 600, fontSize: '0.84rem', transition: 'all 0.2s',
            background: activeTab === tab.key ? 'linear-gradient(135deg, #0f766e, #2563eb)' : 'rgba(255,255,255,0.07)',
            color: activeTab === tab.key ? 'white' : 'rgba(255,255,255,0.55)',
            boxShadow: activeTab === tab.key ? '0 4px 16px rgba(15,118,110,0.4)' : 'none'
          }}>{tab.emoji} {tab.label}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ margin: 0 }}>Xogtaada waan soo qaadanayaa...</p>
          </div>
        ) : (
          <>
            {/* ════ OVERVIEW ════ */}
            {activeTab === 'overview' && (
              <div>
                {/* Hero Profile Card */}
                <div style={{ ...card, marginBottom: 24, background: 'linear-gradient(135deg, rgba(15,118,110,0.18), rgba(37,99,235,0.15))', border: '1px solid rgba(15,118,110,0.3)', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, flexShrink: 0, boxShadow: '0 0 0 4px rgba(15,118,110,0.25)' }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h1 style={{ margin: '0 0 10px 0', fontSize: '1.7rem', fontWeight: 800, textTransform: 'capitalize', color: 'white' }}>{patient.full_name}</h1>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[patient.patient_id, patient.gender || 'N/A', patient.blood_group || 'N/A', age].map((b, i) => (
                        <span key={i} style={{ padding: '4px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: 20, fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.12)', fontWeight: 500 }}>{b}</span>
                      ))}
                    </div>
                  </div>
                  {/* QR Code */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${patient.patient_id}&color=ffffff&bgcolor=0b1120`} alt="QR" style={{ borderRadius: 8, border: '2px solid rgba(255,255,255,0.2)', width: 72, height: 72 }} />
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>My Health QR</p>
                  </div>
                </div>

                {/* KPI Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 16, marginBottom: 28 }}>
                  {[
                    { label: 'Prescriptions', value: prescriptions.length,      icon: '💊', color: '#0f766e', sub: 'Dawooyinka la qoray' },
                    { label: 'Lab Tests',      value: labResults.length,         icon: '🧪', color: '#2563eb', sub: 'Baaritaanka shaybaarka' },
                    { label: 'Total Billed',   value: `$${totalBill.toFixed(0)}`,icon: '💰', color: '#d97706', sub: 'Wadarta biilka' },
                    { label: 'Balance Due',    value: `$${balance.toFixed(0)}`,  icon: balance > 0 ? '⚠️' : '✅', color: balance > 0 ? '#ef4444' : '#10b981', sub: balance > 0 ? 'Lacag hadhay' : 'Dhammaan la bixiyay' },
                  ].map((kpi, i) => (
                    <div key={i} style={{ ...card, borderTop: `3px solid ${kpi.color}`, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', right: 16, top: 16, fontSize: '2.2rem', opacity: 0.12 }}>{kpi.icon}</div>
                      <div style={{ fontSize: '2.2rem', fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: 8 }}>{kpi.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Activity 2x2 Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
                  {/* Latest Appointment */}
                  <div style={{ ...card }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ fontSize: '1.2rem' }}>📅</span>
                      <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Latest Appointment</h3>
                    </div>
                    {appointments[0] ? (
                      <>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>{appointments[0].appointment_date}</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>Dr. {appointments[0].profiles?.full_name || 'Cayush'} · {appointments[0].appointment_time || ''}</div>
                        <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', background: appointments[0].status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: appointments[0].status === 'completed' ? '#6ee7b7' : '#fcd34d', border: `1px solid ${appointments[0].status === 'completed' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>{appointments[0].status || 'Waiting'}</span>
                      </>
                    ) : <p style={{ color: 'rgba(255,255,255,0.25)', margin: 0, fontSize: '0.85rem' }}>Balan lama helin</p>}
                  </div>

                  {/* Latest Lab */}
                  <div style={{ ...card }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ fontSize: '1.2rem' }}>🧪</span>
                      <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Latest Lab Result</h3>
                    </div>
                    {labResults[0] ? (
                      <>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>{labResults[0].lab_catalog?.test_name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>{labResults[0].lab_catalog?.category} · {new Date(labResults[0].created_at).toLocaleDateString()}</div>
                        {labResults[0].result_text ? (
                          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid #0f766e', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>{labResults[0].result_text}</div>
                        ) : (
                          <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }}>Pending</span>
                        )}
                      </>
                    ) : <p style={{ color: 'rgba(255,255,255,0.25)', margin: 0, fontSize: '0.85rem' }}>Shaybaarad lama helin</p>}
                  </div>

                  {/* Latest Prescription */}
                  <div style={{ ...card }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ fontSize: '1.2rem' }}>💊</span>
                      <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Latest Prescription</h3>
                    </div>
                    {prescriptions[0] ? (
                      <>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>{prescriptions[0].medicines?.name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>{prescriptions[0].medicines?.generic_name}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(15,118,110,0.15)', color: '#6ee7b7', border: '1px solid rgba(15,118,110,0.3)', fontSize: '0.8rem', fontWeight: 600 }}>Dose: {prescriptions[0].dosage}</span>
                          <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(37,99,235,0.15)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.3)', fontSize: '0.8rem', fontWeight: 600 }}>{prescriptions[0].duration}</span>
                        </div>
                      </>
                    ) : <p style={{ color: 'rgba(255,255,255,0.25)', margin: 0, fontSize: '0.85rem' }}>Daawo lama qorin</p>}
                  </div>

                  {/* Billing Summary */}
                  <div style={{ ...card }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ fontSize: '1.2rem' }}>💳</span>
                      <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Billing Summary</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Grand Total', value: `$${totalBill.toFixed(2)}`,  color: '#d97706' },
                        { label: 'Amount Paid', value: `$${totalPaid.toFixed(2)}`,  color: '#10b981' },
                        { label: 'Balance',     value: `$${balance.toFixed(2)}`,    color: balance > 0 ? '#ef4444' : '#10b981' },
                      ].map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{r.label}</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: r.color }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Banner */}
                <div style={{ marginTop: 24, ...card, background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.2)', display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
                  {[{ icon: '📞', text: '+252 61 9639994' }, { icon: '📍', text: 'Ex-control Afgoye, Mogadishu' }, { icon: '🕐', text: 'Open 24/7' }].map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                      <span>{c.icon}</span><span>{c.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ════ PRESCRIPTIONS ════ */}
            {activeTab === 'prescriptions' && (
              <div>
                {/* Header with Print Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>💊 Dawooyinkii la Qoray ({prescriptions.length})</h2>
                  {prescriptions.length > 0 && (
                    <button
                      onClick={() => { window.print(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 12, background: 'linear-gradient(135deg, #0f766e, #2563eb)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(15,118,110,0.4)' }}
                    >
                      🖨️ Print Prescription
                    </button>
                  )}
                </div>

                {/* ── PRINTABLE PRESCRIPTION LETTER (hidden on screen, visible on print) ── */}
                <div id="rx-print-area" style={{ display: 'none' }}>
                  <div style={{ fontFamily: 'serif', color: '#1a1a1a', padding: '2cm', maxWidth: '800px', margin: '0 auto', background: '#fff' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <img src="/logo.png" alt="Logo" style={{ height: 60, width: 60, objectFit: 'contain' }} />
                        <div>
                          <h1 style={{ color: '#800000', fontFamily: 'serif', fontSize: '1.6rem', fontWeight: 'bold', margin: 0 }}>
                            Dr Aisho Ibrahim Hoji, MBBS, MD
                          </h1>
                          <p style={{ color: '#555', fontSize: '0.95rem', fontWeight: 'bold', margin: '4px 0 2px 0' }}>
                            Obstetrics, Gynaecology &amp; Infertility
                          </p>
                          <p style={{ color: '#777', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>
                            Mogadishu, Somalia
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=CayushClinic-${patient?.full_name || 'Patient'}&color=000000&bgcolor=ffffff`}
                          alt="QR"
                          style={{ width: '60px', height: '60px', marginBottom: '4px' }}
                        />
                        <span style={{ fontSize: '0.78rem', color: '#111', fontWeight: 'bold' }}>+252 61 9639994</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '4px', background: '#b01d5d', margin: '10px 0 20px 0' }} />

                    {/* Rx Title */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                      <span style={{ fontSize: '2.1rem', fontWeight: 'bold', color: '#b01d5d', fontFamily: 'serif' }}>R</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#005f54', letterSpacing: '1px', textTransform: 'uppercase' }}>Prescription</span>
                    </div>

                    {/* Patient Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                          <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Patient:</span>
                          <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{patient?.full_name || '—'}</span>
                        </div>
                        <div style={{ width: '200px', display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                          <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Date:</span>
                          <span style={{ fontSize: '0.95rem' }}>{new Date().toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                          <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Age:</span>
                          <span style={{ fontSize: '0.95rem' }}>{patient?.age || '—'}</span>
                        </div>
                        <div style={{ width: '200px', display: 'flex', alignItems: 'baseline', borderBottom: '1px solid #888', paddingBottom: '4px' }}>
                          <span style={{ color: '#005f54', fontWeight: 'bold', marginRight: '8px', fontSize: '0.9rem' }}>Gender:</span>
                          <span style={{ fontSize: '0.95rem' }}>{patient?.gender || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rx Body */}
                    <div style={{ minHeight: '200px' }}>
                      <div style={{ fontSize: '2.8rem', color: '#b01d5d', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginBottom: '8px' }}>Rx</div>
                      <div style={{ paddingLeft: '20px' }}>
                        {prescriptions.map((p, i) => (
                          <div key={p.id} style={{ marginBottom: '12px', fontSize: '1.05rem', color: '#222', display: 'flex', gap: '15px' }}>
                            <span style={{ fontWeight: 'bold', color: '#b01d5d' }}>{i + 1}.</span>
                            <div>
                              <span style={{ fontWeight: 'bold' }}>{p.medicines?.name}</span> 
                              {p.dosage && <span style={{ marginLeft: '10px', color: '#444' }}>({p.dosage})</span>}
                              {p.duration && <span style={{ marginLeft: '15px', color: '#005f54', fontStyle: 'italic', fontSize: '0.9rem' }}>— {p.duration}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '30px' }}>
                      <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                        <span>Next visit: </span>
                        <span style={{ borderBottom: '1px solid #999', minWidth: '100px', display: 'inline-block' }}>{prescriptions[0]?.notes || '—'}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ height: '1px', background: '#9ca3af', width: '180px', marginBottom: '6px' }} />
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Doctor's Signature &amp; Stamp</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#777', marginTop: '24px', paddingTop: '10px', borderTop: '2px dashed #eee' }}>
                      Cayush Clinic • +252 61 9639994 • Mogadishu, Somalia
                    </div>
                  </div>
                </div>

                {/* Screen card list */}
                {prescriptions.length === 0 ? (
                  <div style={{ ...card, textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}><div style={{ fontSize: '3rem', marginBottom: 12 }}>💊</div><p>Wali daawo laguma qorin.</p></div>
                ) : prescriptions.map(p => (
                  <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700 }}>{p.medicines?.name}</h4>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{p.medicines?.generic_name}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(15,118,110,0.15)', color: '#6ee7b7', border: '1px solid rgba(15,118,110,0.25)', fontSize: '0.78rem', fontWeight: 600 }}>Dose: {p.dosage}</span>
                        <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(37,99,235,0.15)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.25)', fontSize: '0.78rem', fontWeight: 600 }}>{p.duration}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: p.status === 'Dispensed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: p.status === 'Dispensed' ? '#6ee7b7' : '#fcd34d', border: `1px solid ${p.status === 'Dispensed' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>{p.status}</span>
                      <p style={{ margin: '6px 0 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ════ LAB RESULTS ════ */}
            {activeTab === 'lab' && (
              <div>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', fontWeight: 700 }}>🧪 Natiijada Shaybaarka ({labResults.length})</h2>
                {labResults.length === 0 ? (
                  <div style={{ ...card, textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}><div style={{ fontSize: '3rem', marginBottom: 12 }}>🧪</div><p>Wali shaybaarad lama sameynin.</p></div>
                ) : labResults.map(r => (
                  <div key={r.id} style={{ ...card, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: r.result_text ? 14 : 0 }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700 }}>{r.lab_catalog?.test_name}</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{r.lab_catalog?.category} · {new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: r.status === 'Completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: r.status === 'Completed' ? '#6ee7b7' : '#fcd34d', border: `1px solid ${r.status === 'Completed' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, alignSelf: 'flex-start' }}>{r.status}</span>
                    </div>
                    {r.result_text && (
                      <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '12px 16px', borderLeft: '3px solid #0f766e' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '0.72rem', fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Natiijada</p>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{r.result_text}</p>
                        {r.notes && <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Note: {r.notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ════ BILLING ════ */}
            {activeTab === 'billing' && (
              <div>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', fontWeight: 700 }}>💳 Lacag-bixinta ({invoices.length})</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'Total Billed', value: `$${totalBill.toFixed(2)}`, color: '#d97706' },
                    { label: 'Amount Paid',  value: `$${totalPaid.toFixed(2)}`, color: '#10b981' },
                    { label: 'Balance Due',  value: `$${balance.toFixed(2)}`,   color: balance > 0 ? '#ef4444' : '#10b981' }
                  ].map((k, i) => (
                    <div key={i} style={{ ...card, textAlign: 'center', borderTop: `3px solid ${k.color}` }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color }}>{k.value}</div>
                      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
                {invoices.map(inv => (
                  <div key={inv.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700 }}>{inv.invoice_number}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{inv.notes || 'Medical Service'} · {new Date(inv.created_at).toLocaleDateString()}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#d97706' }}>${parseFloat(inv.total_amount).toFixed(2)}</div>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: inv.status === 'Paid' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: inv.status === 'Paid' ? '#6ee7b7' : '#fca5a5' }}>{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ════ APPOINTMENTS ════ */}
            {activeTab === 'appointments' && (
              <div>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', fontWeight: 700 }}>📅 Balammadayda ({appointments.length})</h2>
                {appointments.map(appt => (
                  <div key={appt.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700 }}>{appt.appointment_date}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)' }}>Dr. {appt.profiles?.full_name || 'Cayush'} · {appt.appointment_time || ''}</p>
                      {appt.notes && <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#6ee7b7' }}>{appt.notes}</p>}
                    </div>
                    <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', alignSelf: 'flex-start', background: appt.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: appt.status === 'completed' ? '#6ee7b7' : '#fcd34d', border: `1px solid ${appt.status === 'completed' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>{appt.status || 'Waiting'}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
        © 2024 Cayush Clinic. All rights reserved. &nbsp;|&nbsp; +252 61 9639994
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body > * { display: none !important; }
          body > #root #rx-print-area { display: block !important; }
          nav, .no-print, button { display: none !important; }
          #rx-print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: white; }
        }
      `}</style>
    </div>
  );
};

export default PortalDashboard;
