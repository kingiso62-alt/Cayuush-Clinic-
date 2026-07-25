import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Heart, Calendar, Search, ShieldAlert, Award } from 'lucide-react';
import './Vaccinations.css';

const Vaccinations = () => {
  const { user } = useAuth();
  const [vaccinations, setVaccinations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    patient_id: '',
    vaccine_name: '',
    dose_number: '1st Dose',
    date_administered: new Date().toISOString().split('T')[0],
    next_dose_due: '',
    notes: ''
  });

  useEffect(() => {
    fetchVaccinations();
    supabase.from('patients').select('id, full_name, patient_id').order('full_name').then(({ data }) => setPatients(data || []));
  }, []);

  const fetchVaccinations = async () => {
    setIsLoading(true);
    try {
      const { data: vacData, error: vacError } = await supabase
        .from('vaccinations')
        .select('*')
        .order('created_at', { ascending: false });

      if (vacError) throw vacError;

      const { data: patientsList } = await supabase.from('patients').select('id, full_name, patient_id');
      const patMap = patientsList ? Object.fromEntries(patientsList.map(p => [p.id, p])) : {};

      const formatted = (vacData || []).map(v => ({
        ...v,
        patients: patMap[v.patient_id] || null
      }));

      setVaccinations(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('vaccinations').insert([{
      ...formData,
      administered_by: user.id,
      next_dose_due: formData.next_dose_due || null
    }]);

    if (!error) {
      setFormData({
        patient_id: '',
        vaccine_name: '',
        dose_number: '1st Dose',
        date_administered: new Date().toISOString().split('T')[0],
        next_dose_due: '',
        notes: ''
      });
      fetchVaccinations();
    } else {
      alert('Tirada tallaalka ma guulaysan: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Ma hubtaa inaad tirtirto diiwaankan tallaalka?')) {
      await supabase.from('vaccinations').delete().eq('id', id);
      fetchVaccinations();
    }
  };

  const filteredVaccinations = vaccinations.filter(v => 
    v.patients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vaccine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.patients?.patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todaysDoses = vaccinations.filter(v => v.date_administered === new Date().toISOString().split('T')[0]).length;
  const uniqueVaccinated = new Set(vaccinations.map(v => v.patient_id)).size;

  return (
    <div className="vac-container">
      {/* Header */}
      <div className="vac-header">
        <div className="vac-title">
          <h1>💉 Vaccine &amp; Immunization Tracker</h1>
          <p>Diiwaangelinta iyo la socodka tallaalka bukaanka ee Cayush Hospital</p>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="vac-stats-ribbon">
        <div className="vac-stat-card">
          <div className="vac-stat-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}>🛡️</div>
          <div className="vac-stat-info">
            <h3>{uniqueVaccinated}</h3>
            <p>Total Vaccinated Patients</p>
          </div>
        </div>
        <div className="vac-stat-card">
          <div className="vac-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>💉</div>
          <div className="vac-stat-info">
            <h3>{vaccinations.length}</h3>
            <p>Doses Administered</p>
          </div>
        </div>
        <div className="vac-stat-card">
          <div className="vac-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>📅</div>
          <div className="vac-stat-info">
            <h3>{todaysDoses}</h3>
            <p>Administered Today</p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="vac-grid">
        {/* Record Form */}
        <div className="vac-panel-card">
          <h3>Diiwaangeli Tallaal Cusub</h3>
          <form onSubmit={handleSubmit} className="vac-form">
            <div className="vac-field">
              <label>Bukaanka / Patient *</label>
              <select required value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })}>
                <option value="">-- Dooro Bukaanka --</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>)}
              </select>
            </div>
            <div className="vac-field">
              <label>Magaca Tallaalka / Vaccine Name *</label>
              <input type="text" placeholder="Tusaale: BCG, Polio, HepB" required value={formData.vaccine_name} onChange={e => setFormData({ ...formData, vaccine_name: e.target.value })} />
            </div>
            <div className="vac-field">
              <label>Dose Number *</label>
              <select required value={formData.dose_number} onChange={e => setFormData({ ...formData, dose_number: e.target.value })}>
                <option>1st Dose</option>
                <option>2nd Dose</option>
                <option>3rd Dose</option>
                <option>Booster</option>
              </select>
            </div>
            <div className="vac-field">
              <label>Taariikhda la Siiyey *</label>
              <input type="date" required value={formData.date_administered} onChange={e => setFormData({ ...formData, date_administered: e.target.value })} />
            </div>
            <div className="vac-field">
              <label>Next Dose Due (Optional)</label>
              <input type="date" value={formData.next_dose_due} onChange={e => setFormData({ ...formData, next_dose_due: e.target.value })} />
            </div>
            <div className="vac-field">
              <label>Notes / Faahfaahin</label>
              <textarea placeholder="Faahfaahin dheeri ah..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            <button type="submit" className="premium-btn" style={{ width: '100%', marginTop: '10px' }}>➕ Save Record</button>
          </form>
        </div>

        {/* List Card */}
        <div className="vac-panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Diiwaanka Tallaalada</h3>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', width: '260px' }}>
              <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
              <input 
                type="text" 
                placeholder="Raadi bukaan ama tallaal..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-main)', width: '100%', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <div className="vac-table-wrap">
            {isLoading ? <p style={{ color: 'var(--text-muted)' }}>Loading records...</p> : (
              <table className="vac-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Vaccine</th>
                    <th>Dose</th>
                    <th>Administered Date</th>
                    <th>Next Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVaccinations.map(v => (
                    <tr key={v.id}>
                      <td>
                        <div className="vac-patient-cell">
                          <span className="vac-patient-name">{v.patients?.full_name}</span>
                          <span className="vac-patient-id">{v.patients?.patient_id}</span>
                        </div>
                      </td>
                      <td><span style={{ fontWeight: 700, color: 'var(--primary-brand)' }}>{v.vaccine_name}</span></td>
                      <td><span className="vac-badge dose">{v.dose_number}</span></td>
                      <td>{new Date(v.date_administered).toLocaleDateString()}</td>
                      <td style={{ color: v.next_dose_due ? 'var(--accent-orange)' : 'inherit', fontWeight: v.next_dose_due ? 'bold' : 'normal' }}>
                        {v.next_dose_due ? new Date(v.next_dose_due).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button onClick={() => handleDelete(v.id)} className="vac-action-btn" title="Tirtir">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredVaccinations.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Muu jiro wax diiwaan tallaal ah oo la helay.</td>
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

export default Vaccinations;
