import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const PortalLogin = () => {
  const [form, setForm] = useState({ patient_id: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizePhone = (phone) => phone.replace(/[\s\-()]/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Step 1: Find patient by Patient ID
      const { data, error: dbErr } = await supabase
        .from('patients')
        .select('id, full_name, patient_id, phone, dob, gender, blood_group, address, age')
        .eq('patient_id', form.patient_id.trim().toUpperCase())
        .maybeSingle();

      if (dbErr) throw dbErr;

      if (!data) {
        setError('Patient ID-ka lama helin. Fadlan hubi oo mar labaad isku day.');
        return;
      }

      // Step 2: Validate phone client-side (flexible matching)
      const enteredPhone = normalizePhone(form.phone.trim());
      const storedPhone  = normalizePhone(data.phone || '');

      if (!storedPhone || !storedPhone.includes(enteredPhone.slice(-8))) {
        setError('Lambarka telefoonka khaldan. Fadlan mar labaad isku day.');
        return;
      }

      // Store patient session in sessionStorage
      sessionStorage.setItem('portal_patient', JSON.stringify(data));
      window.location.href = '/portal/dashboard';
    } catch (err) {
      console.error(err);
      setError('Khalad ayaa dhacay. Fadlan mar labaad isku day.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f766e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', 'Segoe UI', sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0f766e, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(15,118,110,0.5)'
          }}>
            <span style={{ fontSize: '2.2rem' }}>🏥</span>
          </div>
          <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 800, margin: 0 }}>Cayush Clinic</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: '1rem' }}>Patient Health Portal</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 700 }}>Welcome Back</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 32px 0', fontSize: '0.9rem' }}>
            Xogtaada caafimaadka u gal isticmaalaya Patient ID-gaaga iyo lambarka telefoonkaaga.
          </p>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 24,
              color: '#fca5a5', fontSize: '0.88rem'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>
                Patient ID
              </label>
              <input
                type="text"
                placeholder="e.g. PT-001"
                value={form.patient_id}
                onChange={e => setForm({ ...form, patient_id: e.target.value })}
                required
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+252 61 XXXXXXX"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                required
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '15px', borderRadius: 12,
                background: isLoading ? 'rgba(15,118,110,0.5)' : 'linear-gradient(135deg, #0f766e, #3b82f6)',
                color: 'white', border: 'none', fontSize: '1rem', fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', boxShadow: '0 4px 16px rgba(15,118,110,0.4)'
              }}
            >
              {isLoading ? '⏳ Checking...' : '🔐 Access My Records'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', marginTop: 24, fontSize: '0.82rem' }}>
            Dhibaato ma haysataa? Tel: <a href="tel:+252619639994" style={{ color: '#6ee7b7', textDecoration: 'none' }}>+252 61 9639994</a>
          </p>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', marginTop: 20, fontSize: '0.78rem' }}>
          © 2024 Cayush Clinic. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default PortalLogin;
