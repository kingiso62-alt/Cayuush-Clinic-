import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Eye, Edit, Trash2, Printer, X, Download, Loader2, Calendar, ChevronDown, UserCheck, UserX, Users, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Patients.css';

const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [ageFilter, setAgeFilter] = useState('All');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'print', 'add', 'edit'
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Form State
  const initialFormState = {
    full_name: '',
    gender: 'Female',
    age: '',
    dob: '',
    phone: '',
    address: '',
    emergency_contact: '',
    blood_group: 'Unknown',
    marital_status: 'Single',
    medical_history: '',
    allergies: '',
    pregnancy_history: '',
    status: 'Active',
    drug_allergies: '',
    food_allergies: '',
    chronic_conditions: '',
    pregnancy_warning: false,
    previous_severe_reactions: '',
    infectious_disease_warning: '',
    special_care_instructions: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [patients, searchTerm, statusFilter, genderFilter, ageFilter]);

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data || []);
      setFilteredPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = patients;

    // Search query
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.full_name?.toLowerCase().includes(term) || 
        p.phone?.includes(term) || 
        p.patient_id?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(p => (p.status || 'Active') === statusFilter);
    }

    // Gender filter
    if (genderFilter !== 'All') {
      result = result.filter(p => p.gender === genderFilter);
    }

    // Age filter
    if (ageFilter !== 'All') {
      result = result.filter(p => {
        const val = parseInt(p.age) || 0;
        if (ageFilter === 'Under 18') return val < 18;
        if (ageFilter === '18-35') return val >= 18 && val <= 35;
        if (ageFilter === '36-50') return val >= 36 && val <= 50;
        if (ageFilter === '50+') return val > 50;
        return true;
      });
    }

    setFilteredPatients(result);
    setCurrentPage(1); // Reset pagination
  };

  const openAddModal = () => {
    setFormData(initialFormState);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const openEditModal = (patient) => {
    setSelectedPatient(patient);
    setFormData({
      full_name: patient.full_name || '',
      gender: patient.gender || 'Female',
      age: patient.age || '',
      dob: patient.dob || '',
      phone: patient.phone || '',
      address: patient.address || '',
      emergency_contact: patient.emergency_contact || '',
      blood_group: patient.blood_group || 'Unknown',
      marital_status: patient.marital_status || 'Single',
      medical_history: patient.medical_history || '',
      allergies: patient.allergies || '',
      pregnancy_history: patient.pregnancy_history || '',
      status: patient.status || 'Active',
      drug_allergies: patient.drug_allergies || '',
      food_allergies: patient.food_allergies || '',
      chronic_conditions: patient.chronic_conditions || '',
      pregnancy_warning: patient.pregnancy_warning || false,
      previous_severe_reactions: patient.previous_severe_reactions || '',
      infectious_disease_warning: patient.infectious_disease_warning || '',
      special_care_instructions: patient.special_care_instructions || ''
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const openViewModal = (patient) => {
    setSelectedPatient(patient);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const openPrintModal = (patient) => {
    setSelectedPatient(patient);
    setModalMode('print');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPatient(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
      try {
        const { error } = await supabase.from('patients').delete().eq('id', id);
        if (error) throw error;
        setPatients(patients.filter(p => p.id !== id));
      } catch (error) {
        console.error("Error deleting patient:", error);
        alert("Failed to delete patient. Ensure no appointments are linked.");
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modalMode === 'add') {
        // Generate Patient ID
        const countRes = await supabase.from('patients').select('id', { count: 'exact', head: true });
        const currentCount = countRes.count || 0;
        const newPatientId = `PT-${1001 + currentCount}`;

        const payload = {
          ...formData,
          patient_id: newPatientId,
          age: parseInt(formData.age) || null,
          created_by: user.id
        };

        let { data, error } = await supabase.from('patients').insert([payload]).select();

        // Fallback: If status column is missing from database schema
        if (error && (error.message?.includes('status') || error.message?.includes('column'))) {
          console.warn('Fallback: status column missing in DB, retrying without status field...');
          const { status, ...fallbackPayload } = payload;
          const retry = await supabase.from('patients').insert([fallbackPayload]).select();
          data = retry.data;
          error = retry.error;
        }

        if (error) throw error;
        setPatients([data[0], ...patients]);
      } else if (modalMode === 'edit') {
        const payload = {
          ...formData,
          age: parseInt(formData.age) || null
        };

        let { data, error } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', selectedPatient.id)
          .select();

        // Fallback: If status column is missing from database schema
        if (error && (error.message?.includes('status') || error.message?.includes('column'))) {
          console.warn('Fallback: status column missing in DB, retrying without status field...');
          const { status, ...fallbackPayload } = payload;
          const retry = await supabase
            .from('patients')
            .update(fallbackPayload)
            .eq('id', selectedPatient.id)
            .select();
          data = retry.data;
          error = retry.error;
        }

        if (error) throw error;
        setPatients(patients.map(p => p.id === selectedPatient.id ? data[0] : p));
      }
      closeModal();
    } catch (error) {
      console.error("Error submitting patient form:", error);
      alert("Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pagination Helper Math
  const totalPatientsCount = filteredPatients.length;
  const totalPages = Math.ceil(totalPatientsCount / pageSize) || 1;
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentItems = filteredPatients.slice(indexOfFirstItem, indexOfLastItem);

  // Statistics Calculation
  const totalAllTime = patients.length;
  const newThisMonth = patients.filter(p => {
    const createdDate = new Date(p.created_at);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
  }).length;
  const activeCount = patients.filter(p => (p.status || 'Active') === 'Active').length;
  const inactiveCount = patients.filter(p => (p.status || 'Active') === 'Inactive').length;

  return (
    <div className="patients-container fade-in">
      
      {/* Title Header Section */}
      <div className="patients-header-section">
        <div className="header-left-title">
          <h2>Patients</h2>
          <p className="breadcrumb-path">Home / Patients</p>
        </div>
        <div className="header-right-buttons">
          <button className="import-patients-btn">
            <Download size={16} />
            <span>Import Patients</span>
          </button>
          <button className="add-new-patient-btn" onClick={openAddModal}>
            <Plus size={16} />
            <span>Add New Patient</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon (4 Cards Row) */}
      <div className="patients-kpi-ribbon">
        <div className="kpi-mini-card">
          <div className="icon-wrapper blue">
            <Users size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Patients</span>
            <h3>{totalAllTime.toLocaleString()}</h3>
            <span className="meta-sub">All time</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper green">
            <UserPlus size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">New This Month</span>
            <h3>{newThisMonth}</h3>
            <span className="trend-sub text-green">↑ 12.5% vs last month</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper purple">
            <UserCheck size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Active Patients</span>
            <h3>{activeCount}</h3>
            <span className="meta-sub">Under treatment</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper orange">
            <UserX size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Inactive Patients</span>
            <h3>{inactiveCount}</h3>
            <span className="meta-sub">Not visited recently</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Action Row */}
      <div className="patients-filters-row">
        <div className="search-bar-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by name, ID or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="select-dropdown-container">
          <div className="filter-dropdown">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>

          <div className="filter-dropdown">
            <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="All">All Gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>

          <div className="filter-dropdown">
            <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
              <option value="All">All Age Groups</option>
              <option value="Under 18">Under 18</option>
              <option value="18-35">18-35</option>
              <option value="36-50">36-50</option>
              <option value="50+">50+</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>
        </div>

        <div className="right-action-buttons">
          <button className="btn-icon-label filter">
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="btn-icon-label export">
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Redesigned Patients Table Card */}
      <div className="patients-table-card">
        {isLoading ? (
          <div className="loading-container-box">
            <Loader2 className="spinner" size={32} />
          </div>
        ) : (
          <div className="table-overflow-wrapper">
            <table className="patients-list-table">
              <thead>
                <tr>
                  <th>PATIENT</th>
                  <th>PATIENT ID</th>
                  <th>GENDER</th>
                  <th>AGE</th>
                  <th>PHONE</th>
                  <th>BLOOD GROUP</th>
                  <th>LAST VISIT</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((patient) => {
                  const initial = patient.full_name ? patient.full_name.charAt(0).toUpperCase() : '?';
                  const bloodColors = {
                    'A+': 'bg-light-red text-red',
                    'A-': 'bg-light-red text-red',
                    'B+': 'bg-light-orange text-orange',
                    'B-': 'bg-light-orange text-orange',
                    'AB+': 'bg-light-purple text-purple',
                    'AB-': 'bg-light-purple text-purple',
                    'O+': 'bg-light-green text-green',
                    'O-': 'bg-light-green text-green',
                    'Unknown': 'bg-light-grey text-grey'
                  };
                  const bloodClass = bloodColors[patient.blood_group] || 'bg-light-grey text-grey';
                  
                  return (
                    <tr key={patient.id}>
                      <td className="patient-avatar-col">
                        <div className="avatar-circle">
                          {initial}
                        </div>
                        <div className="patient-details-box">
                          <span className="p-name">{patient.full_name}</span>
                          <span className="p-addr">{patient.address || 'No Address registered'}</span>
                        </div>
                      </td>
                      <td className="patient-id-col">
                        {patient.patient_id}
                      </td>
                      <td className="patient-gender-col">
                        <span className={`gender-tag ${patient.gender?.toLowerCase()}`}>
                          {patient.gender}
                        </span>
                      </td>
                      <td className="patient-age-col">
                        {patient.age || '25'}
                      </td>
                      <td className="patient-phone-col">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{patient.phone || 'N/A'}</span>
                          {patient.phone && (
                            <button
                              onClick={() => {
                                const msg = prompt('Qor fariinta aad u dirayso ' + patient.full_name + ':', 'Salaamu calaykum ' + patient.full_name + ', waxaan kaa soo xiriiraynaa Cayush Clinic...');
                                if (msg) {
                                  // Clean phone number from spaces/special chars
                                  const cleanPhone = patient.phone.replace(/[\s\+\-()]/g, '');
                                  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                }
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center' }}
                              title="Send WhatsApp Message"
                            >
                              🟢
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="patient-blood-col">
                        <span className={`blood-pill ${bloodClass}`}>
                          {patient.blood_group}
                        </span>
                      </td>
                      <td className="patient-visit-col">
                        <span className="visit-date">{patient.last_visit || 'Never'}</span>
                        <span className="visit-count">Visits: {patient.previous_visits || 0}</span>
                      </td>
                      <td className="patient-status-col">
                        <span className={`status-pill ${(patient.status || 'Active').toLowerCase()}`}>
                          {patient.status || 'Active'}
                        </span>
                      </td>
                      <td className="patient-actions-col">
                        <div className="action-circular-buttons">
                          <button className="circular-btn eye" onClick={() => navigate(`/patients/${patient.id}/records`)} title="View Records">
                            <Eye size={14} />
                          </button>
                          <button className="circular-btn edit" onClick={() => openEditModal(patient)} title="Edit Details">
                            <Edit size={14} />
                          </button>
                          <button className="circular-btn trash" onClick={() => handleDelete(patient.id)} title="Delete Patient">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {currentItems.length === 0 && (
                  <tr>
                    <td colSpan="9" className="no-records-row">
                      No matching patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        <div className="patients-pagination-footer">
          <div className="pagination-count-label">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalPatientsCount)} of {totalPatientsCount} patients
          </div>
          
          <div className="pagination-numbers-row">
            <button 
              className="page-nav-arrow" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              &lt;
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button 
                key={p} 
                className={`page-num-btn ${currentPage === p ? 'active' : ''}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}

            <button 
              className="page-nav-arrow" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              &gt;
            </button>
          </div>

          <div className="pagination-size-select">
            <select value={pageSize} onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setCurrentPage(1);
            }}>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>
        </div>
      </div>

      {/* VIEW / ADD / EDIT MODALS */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'view' && 'Patient Details'}
                {modalMode === 'print' && 'Patient ID Card'}
                {modalMode === 'add' && 'Register New Patient'}
                {modalMode === 'edit' && 'Edit Patient Details'}
              </h2>
              <button className="close-modal-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {/* VIEW PATIENT DETAILS MODE */}
              {modalMode === 'view' && selectedPatient && (
                <div className="patient-view-details">
                  <p><strong>Name:</strong> {selectedPatient.full_name}</p>
                  <p><strong>ID:</strong> {selectedPatient.patient_id}</p>
                  <p><strong>Gender:</strong> {selectedPatient.gender}</p>
                  <p><strong>Age:</strong> {selectedPatient.age}</p>
                  <p><strong>Date of Birth:</strong> {selectedPatient.dob || 'N/A'}</p>
                  <p><strong>Phone:</strong> {selectedPatient.phone || 'N/A'}</p>
                  <p><strong>Address:</strong> {selectedPatient.address || 'N/A'}</p>
                  <p><strong>Emergency Contact:</strong> {selectedPatient.emergency_contact || 'N/A'}</p>
                  <p><strong>Blood Group:</strong> {selectedPatient.blood_group}</p>
                  <p><strong>Marital Status:</strong> {selectedPatient.marital_status}</p>
                  <p><strong>Drug Allergies:</strong> <span style={{ color: selectedPatient.drug_allergies ? 'var(--accent-red)' : 'inherit', fontWeight: selectedPatient.drug_allergies ? 'bold' : 'normal' }}>{selectedPatient.drug_allergies || 'None'}</span></p>
                  <p><strong>Food Allergies:</strong> {selectedPatient.food_allergies || 'None'}</p>
                  <p><strong>Chronic Conditions:</strong> {selectedPatient.chronic_conditions || 'None'}</p>
                  <p><strong>Pregnancy Warning:</strong> {selectedPatient.pregnancy_warning ? <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>⚠️ Active Pregnancy</span> : 'No'}</p>
                  <p><strong>Infectious Disease Warning:</strong> <span style={{ color: selectedPatient.infectious_disease_warning ? 'var(--accent-red)' : 'inherit', fontWeight: selectedPatient.infectious_disease_warning ? 'bold' : 'normal' }}>{selectedPatient.infectious_disease_warning || 'None'}</span></p>
                  <p><strong>Previous Severe Reactions:</strong> {selectedPatient.previous_severe_reactions || 'None'}</p>
                  <p><strong>Special Care Instructions:</strong> {selectedPatient.special_care_instructions || 'None'}</p>
                </div>
              )}

              {/* ADD / EDIT FORM MODE */}
              {(modalMode === 'add' || modalMode === 'edit') && (
                <form onSubmit={handleSubmit} className="add-patient-form">
                  <div className="details-grid">
                    <div className="form-group full-width">
                      <label>Full Name <span style={{color:'red'}}>*</span></label>
                      <input type="text" className="premium-input" name="full_name" value={formData.full_name} onChange={handleFormChange} required />
                    </div>
                    
                    <div className="form-group">
                      <label>Gender <span style={{color:'red'}}>*</span></label>
                      <select className="premium-input" name="gender" value={formData.gender} onChange={handleFormChange}>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Age</label>
                      <input type="number" className="premium-input" name="age" value={formData.age} onChange={handleFormChange} />
                    </div>

                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input type="date" className="premium-input" name="dob" value={formData.dob} onChange={handleFormChange} />
                    </div>

                    <div className="form-group">
                      <label>Phone Number</label>
                      <input type="text" className="premium-input" name="phone" value={formData.phone} onChange={handleFormChange} placeholder="+252 61..." />
                    </div>

                    <div className="form-group">
                      <label>Marital Status</label>
                      <select className="premium-input" name="marital_status" value={formData.marital_status} onChange={handleFormChange}>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Blood Group</label>
                      <select className="premium-input" name="blood_group" value={formData.blood_group} onChange={handleFormChange}>
                        <option value="Unknown">Unknown</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Status</label>
                      <select className="premium-input" name="status" value={formData.status} onChange={handleFormChange}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="form-group full-width">
                      <label>Home Address</label>
                      <input type="text" className="premium-input" name="address" value={formData.address} onChange={handleFormChange} placeholder="e.g. Hodan, Mogadishu" />
                    </div>

                    <div className="form-group full-width">
                      <label>Emergency Contact (Name & Phone)</label>
                      <input type="text" className="premium-input" name="emergency_contact" value={formData.emergency_contact} onChange={handleFormChange} placeholder="e.g. Ali Abdi (+252 61...)" />
                    </div>

                    <div className="form-group full-width">
                      <label>Medical History / Chronic Illnesses</label>
                      <textarea className="premium-input" name="medical_history" value={formData.medical_history} onChange={handleFormChange} rows={3} placeholder="Diabetes, Hypertension, etc."></textarea>
                    </div>

                    <div className="form-group full-width">
                       <label>Allergies</label>
                       <input type="text" className="premium-input" name="allergies" value={formData.allergies} onChange={handleFormChange} placeholder="Penicillin, Peanuts, etc." />
                     </div>

                     <div className="form-group">
                       <label>Drug Allergies</label>
                       <input type="text" className="premium-input" name="drug_allergies" value={formData.drug_allergies} onChange={handleFormChange} placeholder="Penicillin, Sulfa drugs, etc." />
                     </div>

                     <div className="form-group">
                       <label>Food Allergies</label>
                       <input type="text" className="premium-input" name="food_allergies" value={formData.food_allergies} onChange={handleFormChange} placeholder="Nuts, Seafood, Eggs, etc." />
                     </div>

                     <div className="form-group">
                       <label>Chronic Conditions</label>
                       <input type="text" className="premium-input" name="chronic_conditions" value={formData.chronic_conditions} onChange={handleFormChange} placeholder="Asthma, Diabetes, COPD, etc." />
                     </div>

                     <div className="form-group">
                       <label>Infectious Disease Warning</label>
                       <input type="text" className="premium-input" name="infectious_disease_warning" value={formData.infectious_disease_warning} onChange={handleFormChange} placeholder="Hepatitis B, TB, COVID-19, etc." />
                     </div>

                     <div className="form-group full-width">
                       <label>Previous Severe Reactions</label>
                       <input type="text" className="premium-input" name="previous_severe_reactions" value={formData.previous_severe_reactions} onChange={handleFormChange} placeholder="Anaphylaxis history, high fever on anesthesia, etc." />
                     </div>

                     <div className="form-group full-width">
                       <label>Special Care Instructions</label>
                       <textarea className="premium-input" name="special_care_instructions" value={formData.special_care_instructions} onChange={handleFormChange} rows={2} placeholder="Wheelchair assistance required, blind in left eye, etc."></textarea>
                     </div>

                     <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
                       <input type="checkbox" name="pregnancy_warning" checked={formData.pregnancy_warning} onChange={e => setFormData(prev => ({ ...prev, pregnancy_warning: e.target.checked }))} id="preg_warn_chk" style={{ width: 'auto', cursor: 'pointer' }} />
                       <label htmlFor="preg_warn_chk" style={{ cursor: 'pointer', margin: 0, userSelect: 'none', fontWeight: 'bold', color: 'var(--accent-red)' }}>Active Pregnancy Warning (Check if patient is pregnant)</label>
                     </div>
                   </div>

                  <div className="modal-footer-btns">
                    <button type="button" className="btn-secondary-custom" onClick={closeModal}>Cancel</button>
                    <button type="submit" className="btn-primary-custom" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Save Patient'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Patients;
