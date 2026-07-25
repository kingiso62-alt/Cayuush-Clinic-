import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import {
  Search, Plus, Printer, Trash2, ShieldAlert,
  Calendar, FileText, FileSignature, ArrowRightLeft,
  Clock, CheckCircle, XCircle, ArrowUpRight, HelpCircle, X, Loader2
} from 'lucide-react';
import './Referrals.css';

const Referrals = () => {
  const { user } = useAuth();
  
  // Lists
  const [referrals, setReferrals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  // Loading & UI
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [selectedReferral, setSelectedReferral] = useState(null);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form State
  const initialFormState = {
    patient_id: '',
    referral_type: 'Internal Department',
    referring_doctor_id: '',
    receiving_doctor_id: '',
    receiving_facility: '',
    department_id: '',
    referral_reason: '',
    clinical_summary: '',
    diagnosis: '',
    priority: 'Routine',
    referral_date: new Date().toISOString().split('T')[0],
    appointment_date: '',
    attached_results: '',
    status: 'Draft',
    outcome: '',
    follow_up_instructions: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchReferrals();
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (user?.id) {
      setFormData(prev => ({ ...prev, referring_doctor_id: user.id }));
    }
  }, [user]);

  const fetchDropdowns = async () => {
    try {
      const [patRes, docRes, deptRes] = await Promise.all([
        supabase.from('patients').select('id, full_name, patient_id').order('full_name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'Doctor').order('full_name'),
        supabase.from('departments').select('id, name').order('name')
      ]);
      setPatients(patRes.data || []);
      setDoctors(docRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (err) {
      console.error('Error fetching dropdowns:', err);
    }
  };

  const fetchReferrals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          patients (id, patient_id, full_name, age, gender),
          referring_doctor:profiles!referring_doctor_id (full_name),
          receiving_doctor:profiles!receiving_doctor_id (full_name),
          departments (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferrals(data || []);
    } catch (err) {
      console.error('Error fetching referrals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      ...initialFormState,
      referring_doctor_id: user?.id || ''
    });
    setModalMode('add');
    setIsModalOpen(true);
  };

  const openEditModal = (ref) => {
    setSelectedReferral(ref);
    setFormData({
      patient_id: ref.patient_id || '',
      referral_type: ref.referral_type || 'Internal Department',
      referring_doctor_id: ref.referring_doctor_id || '',
      receiving_doctor_id: ref.receiving_doctor_id || '',
      receiving_facility: ref.receiving_facility || '',
      department_id: ref.department_id || '',
      referral_reason: ref.referral_reason || '',
      clinical_summary: ref.clinical_summary || '',
      diagnosis: ref.diagnosis || '',
      priority: ref.priority || 'Routine',
      referral_date: ref.referral_date || new Date().toISOString().split('T')[0],
      appointment_date: ref.appointment_date || '',
      attached_results: ref.attached_results || '',
      status: ref.status || 'Draft',
      outcome: ref.outcome || '',
      follow_up_instructions: ref.follow_up_instructions || ''
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modalMode === 'add') {
        const countRes = await supabase.from('referrals').select('id', { count: 'exact', head: true });
        const currentCount = countRes.count || 0;
        const refNumber = `REF-${10001 + currentCount}`;

        const payload = {
          ...formData,
          referral_number: refNumber,
          receiving_doctor_id: formData.receiving_doctor_id || null,
          department_id: formData.department_id || null,
          appointment_date: formData.appointment_date || null
        };

        const { error } = await supabase.from('referrals').insert([payload]);
        if (error) throw error;
      } else {
        const payload = {
          ...formData,
          receiving_doctor_id: formData.receiving_doctor_id || null,
          department_id: formData.department_id || null,
          appointment_date: formData.appointment_date || null
        };

        const { error } = await supabase
          .from('referrals')
          .update(payload)
          .eq('id', selectedReferral.id);

        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchReferrals();
    } catch (err) {
      console.error('Error saving referral:', err);
      alert('Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this referral?')) {
      try {
        const { error } = await supabase.from('referrals').delete().eq('id', id);
        if (error) throw error;
        setReferrals(prev => prev.filter(r => r.id !== id));
      } catch (err) {
        console.error('Error deleting referral:', err);
        alert('Failed to delete referral.');
      }
    }
  };

  // Status flow helper
  const handleUpdateStatus = async (ref, newStatus) => {
    try {
      const { error } = await supabase
        .from('referrals')
        .update({ status: newStatus })
        .eq('id', ref.id);
      if (error) throw error;
      setReferrals(prev => prev.map(r => r.id === ref.id ? { ...r, status: newStatus } : r));
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Printable action
  const handlePrint = (ref) => {
    setSelectedReferral(ref);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Search and Filter logic
  const filteredReferrals = useMemo(() => {
    return referrals.filter(r => {
      const term = searchTerm.toLowerCase();
      const patientName = r.patients?.full_name?.toLowerCase() || '';
      const patientId = r.patients?.patient_id?.toLowerCase() || '';
      const refNum = r.referral_number?.toLowerCase() || '';

      const matchesSearch = patientName.includes(term) || patientId.includes(term) || refNum.includes(term);
      const matchesType = typeFilter === 'All' || r.referral_type === typeFilter;
      const matchesPriority = priorityFilter === 'All' || r.priority === priorityFilter;
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;

      return matchesSearch && matchesType && matchesPriority && matchesStatus;
    });
  }, [referrals, searchTerm, typeFilter, priorityFilter, statusFilter]);

  // Statistics calculations
  const stats = useMemo(() => {
    return {
      total: referrals.length,
      pending: referrals.filter(r => r.status === 'Sent' || r.status === 'Draft').length,
      scheduled: referrals.filter(r => r.status === 'Scheduled').length,
      completed: referrals.filter(r => r.status === 'Completed').length
    };
  }, [referrals]);

  return (
    <div className="referrals-container">
      
      {/* NORMAL VIEW */}
      <div className="referrals-layout no-print">
        <div className="referrals-header-row">
          <div className="referrals-header-left">
            <h1>Patient Referral Management</h1>
            <p className="referrals-subtitle">Create, monitor and output printable patient referral sheets.</p>
          </div>
          <button className="premium-btn" onClick={openAddModal}>
            <Plus size={16} /> Add Referral
          </button>
        </div>

        {/* Stats Ribbon */}
        <div className="referrals-stats-grid">
          <div className="referrals-stat-card">
            <div className="referrals-stat-icon total"><FileText size={20} /></div>
            <div className="referrals-stat-info">
              <h3>{stats.total}</h3>
              <p>Total Referrals</p>
            </div>
          </div>
          <div className="referrals-stat-card">
            <div className="referrals-stat-icon pending"><Clock size={20} /></div>
            <div className="referrals-stat-info">
              <h3>{stats.pending}</h3>
              <p>Pending / Draft</p>
            </div>
          </div>
          <div className="referrals-stat-card">
            <div className="referrals-stat-icon scheduled"><ArrowRightLeft size={20} /></div>
            <div className="referrals-stat-info">
              <h3>{stats.scheduled}</h3>
              <p>Scheduled</p>
            </div>
          </div>
          <div className="referrals-stat-card">
            <div className="referrals-stat-icon completed"><CheckCircle size={20} /></div>
            <div className="referrals-stat-info">
              <h3>{stats.completed}</h3>
              <p>Completed</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="referrals-toolbar">
          <div className="referrals-search-input">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search patient, ID, referral number..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <select className="referrals-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="All">All Types</option>
            <option value="Internal Department">Internal Department</option>
            <option value="Doctor to Doctor">Doctor to Doctor</option>
            <option value="External Hospital">External Hospital</option>
            <option value="Specialist">Specialist</option>
            <option value="Laboratory">Laboratory</option>
            <option value="Radiology">Radiology</option>
          </select>

          <select className="referrals-filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="All">All Priorities</option>
            <option value="Routine">Routine</option>
            <option value="Urgent">Urgent</option>
            <option value="Emergency">Emergency</option>
          </select>

          <select className="referrals-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button className="referrals-reset-btn" onClick={() => {
            setSearchTerm('');
            setTypeFilter('All');
            setPriorityFilter('All');
            setStatusFilter('All');
          }}>Reset</button>
        </div>

        {/* Referrals Cards Grid */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <Loader2 className="spinner" size={32} color="var(--primary-brand)" />
          </div>
        ) : filteredReferrals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <HelpCircle size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>No Referrals Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>Try adjusting your search queries or add a new patient referral.</p>
          </div>
        ) : (
          <div className="referrals-grid">
            {filteredReferrals.map(ref => (
              <div key={ref.id} className="referrals-card">
                <div className="referrals-card-header">
                  <span className="referrals-card-number">{ref.referral_number}</span>
                  <span className={`referrals-priority-badge ${ref.priority.toLowerCase()}`}>{ref.priority}</span>
                </div>

                <div className="referrals-card-patient">
                  <h3>{ref.patients?.full_name}</h3>
                  <p>{ref.patients?.patient_id} · {ref.patients?.gender} · {ref.patients?.age ? `${ref.patients.age}y` : ''}</p>
                </div>

                <div className="referrals-card-details">
                  <div className="referrals-detail-row">
                    <span className="referrals-detail-label">Type:</span>
                    <span className="referrals-detail-value">{ref.referral_type}</span>
                  </div>
                  <div className="referrals-detail-row">
                    <span className="referrals-detail-label">Ref. Doctor:</span>
                    <span className="referrals-detail-value">Dr. {ref.referring_doctor?.full_name || 'Clinic'}</span>
                  </div>
                  <div className="referrals-detail-row">
                    <span className="referrals-detail-label">Target:</span>
                    <span className="referrals-detail-value">{ref.receiving_facility || `Dr. ${ref.receiving_doctor?.full_name || '—'}`}</span>
                  </div>
                </div>

                <div className="referrals-card-reason">
                  <h4>Referral Reason</h4>
                  <p>{ref.referral_reason}</p>
                </div>

                <div className="referrals-card-footer">
                  <span className={`referrals-status-badge ${ref.status.toLowerCase()}`}>
                    {ref.status}
                  </span>

                  <div className="referrals-actions">
                    <button className="referrals-action-btn print" onClick={() => handlePrint(ref)} title="Print Referral Letter">
                      <Printer size={14} />
                    </button>
                    <button className="referrals-action-btn" onClick={() => openEditModal(ref)} title="Edit Referral">
                      <FileSignature size={14} />
                    </button>
                    <button className="referrals-action-btn" style={{ color: 'var(--accent-red)' }} onClick={() => handleDelete(ref.id)} title="Delete Referral">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      {isModalOpen && (
        <div className="modal-overlay no-print" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content referrals-form-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '➕ Create Patient Referral' : '📝 Edit Patient Referral'}</h2>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="referrals-grid-2col">
                  {/* Patient selection */}
                  <div className="form-group">
                    <label>Select Patient *</label>
                    <select className="premium-input" name="patient_id" value={formData.patient_id} onChange={handleInputChange} required>
                      <option value="">-- Choose Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>
                      ))}
                    </select>
                  </div>

                  {/* Referral type */}
                  <div className="form-group">
                    <label>Referral Type *</label>
                    <select className="premium-input" name="referral_type" value={formData.referral_type} onChange={handleInputChange} required>
                      <option value="Internal Department">Internal Department</option>
                      <option value="Doctor to Doctor">Doctor to Doctor</option>
                      <option value="External Hospital">External Hospital</option>
                      <option value="Specialist">Specialist</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Radiology">Radiology</option>
                    </select>
                  </div>
                </div>

                <div className="referrals-grid-2col">
                  {/* Referring Doctor */}
                  <div className="form-group">
                    <label>Referring Doctor *</label>
                    <select className="premium-input" name="referring_doctor_id" value={formData.referring_doctor_id} onChange={handleInputChange} required>
                      <option value="">-- Select Doctor --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div className="form-group">
                    <label>Priority *</label>
                    <select className="premium-input" name="priority" value={formData.priority} onChange={handleInputChange}>
                      <option value="Routine">Routine</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>
                </div>

                <div className="referrals-grid-2col">
                  {/* Receiving Doctor */}
                  <div className="form-group">
                    <label>Receiving Doctor (Internal)</label>
                    <select className="premium-input" name="receiving_doctor_id" value={formData.receiving_doctor_id} onChange={handleInputChange}>
                      <option value="">-- Optional Internal Doctor --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Department */}
                  <div className="form-group">
                    <label>Internal Department</label>
                    <select className="premium-input" name="department_id" value={formData.department_id} onChange={handleInputChange}>
                      <option value="">-- Optional Internal Dept --</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="referrals-grid-2col">
                  {/* Receiving Facility */}
                  <div className="form-group">
                    <label>Receiving Facility / Hospital (External)</label>
                    <input
                      type="text"
                      className="premium-input"
                      name="receiving_facility"
                      value={formData.receiving_facility}
                      onChange={handleInputChange}
                      placeholder="e.g. Mogadishu City Hospital"
                    />
                  </div>

                  {/* Status */}
                  <div className="form-group">
                    <label>Status *</label>
                    <select className="premium-input" name="status" value={formData.status} onChange={handleInputChange} required>
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="referrals-grid-2col">
                  {/* Referral Date */}
                  <div className="form-group">
                    <label>Referral Date *</label>
                    <input
                      type="date"
                      className="premium-input"
                      name="referral_date"
                      value={formData.referral_date}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Appointment Date */}
                  <div className="form-group">
                    <label>Target Appointment Date</label>
                    <input
                      type="date"
                      className="premium-input"
                      name="appointment_date"
                      value={formData.appointment_date}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Reason */}
                <div className="form-group">
                  <label>Referral Reason *</label>
                  <input
                    type="text"
                    className="premium-input"
                    name="referral_reason"
                    value={formData.referral_reason}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. Further evaluation of cardiomegaly"
                  />
                </div>

                {/* Diagnosis */}
                <div className="form-group">
                  <label>Diagnosis</label>
                  <input
                    type="text"
                    className="premium-input"
                    name="diagnosis"
                    value={formData.diagnosis}
                    onChange={handleInputChange}
                    placeholder="e.g. Hypertension secondary to renal stenosis"
                  />
                </div>

                {/* Clinical Summary */}
                <div className="form-group">
                  <label>Clinical Summary</label>
                  <textarea
                    className="premium-input"
                    name="clinical_summary"
                    rows={3}
                    value={formData.clinical_summary}
                    onChange={handleInputChange}
                    placeholder="Presenting symptoms, investigations done..."
                  />
                </div>

                {/* Follow up instructions */}
                <div className="form-group">
                  <label>Follow-up Instructions</label>
                  <input
                    type="text"
                    className="premium-input"
                    name="follow_up_instructions"
                    value={formData.follow_up_instructions}
                    onChange={handleInputChange}
                    placeholder="Instructions for receiving facility or next checks"
                  />
                </div>

                <div className="modal-footer" style={{ padding: '16px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Referral'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINTABLE REFERRAL LETTER ── */}
      {selectedReferral && (
        <div className="printable-letter-container">
          <div className="printable-letter-header">
            <div className="clinic-logo-text">
              <h1>CAYUSH CLINIC</h1>
              <p>Electronic Medical Referral Letter</p>
            </div>
            <div className="clinic-contact-details">
              <strong>Cayush Specialist Hospital</strong><br />
              Ex-control Afgoye, Mogadishu, Somalia<br />
              Email: info@cayushclinic.com · Tel: +252 61 9639994
            </div>
          </div>

          <div className="letter-title">
            <h2>PATIENT REFERRAL LETTER</h2>
            <p><strong>Referral No:</strong> {selectedReferral.referral_number} · <strong>Date:</strong> {selectedReferral.referral_date}</p>
          </div>

          <div className="letter-info-block">
            <div className="letter-info-section">
              <h3>PATIENT DETAILS</h3>
              <p><strong>Name:</strong> {selectedReferral.patients?.full_name}</p>
              <p><strong>Patient ID:</strong> {selectedReferral.patients?.patient_id}</p>
              <p><strong>Age / Gender:</strong> {selectedReferral.patients?.age ? `${selectedReferral.patients.age} yrs` : 'N/A'} / {selectedReferral.patients?.gender}</p>
            </div>

            <div className="letter-info-section">
              <h3>REFERRAL DETAILS</h3>
              <p><strong>Type:</strong> {selectedReferral.referral_type}</p>
              <p><strong>Priority:</strong> <span style={{ color: selectedReferral.priority === 'Emergency' ? 'red' : 'black', fontWeight: 'bold' }}>{selectedReferral.priority}</span></p>
              <p><strong>Target Destination:</strong> {selectedReferral.receiving_facility || `Dr. ${selectedReferral.receiving_doctor?.full_name || '—'} (${selectedReferral.departments?.name || 'General'})`}</p>
            </div>
          </div>

          <div className="letter-body">
            <div className="letter-body-section">
              <h4>1. REASON FOR REFERRAL</h4>
              <p>{selectedReferral.referral_reason}</p>
            </div>

            {selectedReferral.diagnosis && (
              <div className="letter-body-section">
                <h4>2. WORKING DIAGNOSIS</h4>
                <p>{selectedReferral.diagnosis}</p>
              </div>
            )}

            {selectedReferral.clinical_summary && (
              <div className="letter-body-section">
                <h4>3. CLINICAL SUMMARY &amp; HISTORY</h4>
                <p>{selectedReferral.clinical_summary}</p>
              </div>
            )}

            {selectedReferral.follow_up_instructions && (
              <div className="letter-body-section">
                <h4>4. SPECIAL INSTRUCTIONS / FOLLOW-UP</h4>
                <p>{selectedReferral.follow_up_instructions}</p>
              </div>
            )}
          </div>

          <div className="letter-footer-block">
            <div className="letter-signature">
              <div style={{ height: '40px' }}></div>
              <div className="letter-signature-line">Referring Doctor</div>
              <div>Dr. {selectedReferral.referring_doctor?.full_name || 'Attending Physician'}</div>
            </div>

            {/* QR Verification Block */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <QRCodeSVG value={`https://cayushclinic.com/verify/referral/${selectedReferral.referral_number}`} size={85} />
              <span style={{ fontSize: '0.65rem', color: '#666' }}>Scan to verify referral</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Referrals;
