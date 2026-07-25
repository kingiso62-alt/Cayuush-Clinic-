import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Calendar as CalIcon, Filter, XCircle, CheckCircle, Clock, 
  ChevronDown, Eye, Edit, Trash2, Award, Phone, Mail, Loader2, X 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Doctors.css';

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [newSched, setNewSched] = useState({ day_of_week: 'Monday', start_time: '09:00', end_time: '17:00' });
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  // Form State
  const initialFormState = {
    full_name: '',
    email: '',
    password: '',
    phone: '',
    specialty: 'General OPD',
    experience: '5 Years',
    room: 'Room 3',
    status: 'Active'
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [doctors, searchTerm, specialtyFilter, statusFilter]);

  // Helper to parse metadata encoded in the phone column
  const parsePhoneMetadata = (rawPhone, idx) => {
    const defaultVals = {
      phone: rawPhone || '',
      specialty: idx === 0 ? 'Pediatrics' : idx === 1 ? 'Dental Surgeon' : idx === 2 ? 'Gynecology' : 'General OPD',
      room: idx === 0 ? 'Room 2' : idx === 1 ? 'Room 5' : idx === 2 ? 'Room 4' : 'Room 3',
      experience: `${(idx + 1) * 3} Years`
    };

    if (rawPhone && rawPhone.includes('|')) {
      const parts = rawPhone.split('|');
      parts.forEach(part => {
        const [key, val] = part.split(':');
        if (key && val) {
          const k = key.trim().toLowerCase();
          const v = val.trim();
          if (k === 'specialty') defaultVals.specialty = v;
          else if (k === 'room') defaultVals.room = v;
          else if (k === 'exp') defaultVals.experience = v;
          else if (k === 'phone') defaultVals.phone = v;
        }
      });
    }

    return defaultVals;
  };

  // Helper to encode metadata into the phone column
  const encodePhoneMetadata = (phone, specialty, room, experience) => {
    return `Specialty:${specialty} | Room:${room} | Exp:${experience} | Phone:${phone}`;
  };

  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'Doctor')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped = data.map((d, idx) => {
          const parsed = parsePhoneMetadata(d.phone, idx);
          return {
            id: d.id,
            full_name: d.full_name,
            email: d.email,
            phone: parsed.phone,
            specialty: parsed.specialty,
            room: parsed.room,
            experience: parsed.experience,
            status: d.is_active !== false ? 'Active' : 'Inactive'
          };
        });
        setDoctors(mapped);
      } else {
        setDoctors([]);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = doctors;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d => 
        d.full_name?.toLowerCase().includes(term) ||
        d.specialty?.toLowerCase().includes(term) ||
        d.email?.toLowerCase().includes(term)
      );
    }

    // Specialty filter
    if (specialtyFilter !== 'All') {
      result = result.filter(d => d.specialty === specialtyFilter);
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(d => d.status === statusFilter);
    }

    setFilteredDoctors(result);
    setCurrentPage(1);
  };

  const openAddModal = () => {
    setFormData(initialFormState);
    setModalMode('add');
    setSubmitError('');
    setIsModalOpen(true);
  };

  const fetchSchedules = async (doctorId) => {
    setIsLoadingSchedules(true);
    try {
      const { data, error } = await supabase
        .from('doctor_schedules')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('day_of_week');
      if (error) throw error;
      setSchedules(data || []);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const openViewModal = (doc) => {
    setSelectedDoctor(doc);
    setModalMode('view');
    setIsModalOpen(true);
    fetchSchedules(doc.id);
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!selectedDoctor) return;
    try {
      const { error } = await supabase
        .from('doctor_schedules')
        .insert([{
          doctor_id: selectedDoctor.id,
          day_of_week: newSched.day_of_week,
          start_time: newSched.start_time,
          end_time: newSched.end_time
        }]);
      if (error) throw error;
      fetchSchedules(selectedDoctor.id);
    } catch (err) {
      console.error(err);
      alert('Failed to add schedule');
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      const { error } = await supabase
        .from('doctor_schedules')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchSchedules(selectedDoctor.id);
    } catch (err) {
      console.error(err);
      alert('Failed to delete schedule');
    }
  };

  const openEditModal = (doc) => {
    setSelectedDoctor(doc);
    setFormData({
      full_name: doc.full_name || '',
      email: doc.email || '',
      password: '',
      phone: doc.phone || '',
      specialty: doc.specialty || 'General OPD',
      experience: doc.experience || '',
      room: doc.room || '',
      status: doc.status || 'Active'
    });
    setModalMode('edit');
    setSubmitError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this doctor profile?')) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setDoctors(doctors.filter(d => d.id !== id));
      } catch (error) {
        console.error('Error deleting doctor:', error);
        if (error.message?.includes('foreign key') || error.code === '23503') {
          alert('Cannot delete this doctor profile because they have associated appointments or clinical records. Please set their status to "Inactive" instead.');
        } else {
          alert('Failed to delete doctor profile: ' + error.message);
        }
      }
    }
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    const encodedPhone = encodePhoneMetadata(
      formData.phone, 
      formData.specialty, 
      formData.room, 
      formData.experience
    );

    try {
      if (modalMode === 'add') {
        // Create user via backend endpoint to handle auth registration
        const res = await fetch('http://localhost:3005/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: formData.full_name,
            email: formData.email,
            password: formData.password,
            role: 'Doctor',
            phone: encodedPhone
          })
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to register doctor account');
        }
      } else {
        // Update existing profile fields
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: encodedPhone,
            is_active: formData.status === 'Active'
          })
          .eq('id', selectedDoctor.id);

        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchDoctors();
    } catch (err) {
      console.error('Error saving doctor profile:', err);
      setSubmitError(err.message || 'Error occurred while saving data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pagination Math
  const totalItemsCount = filteredDoctors.length;
  const totalPages = Math.ceil(totalItemsCount / pageSize) || 1;
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentItems = filteredDoctors.slice(indexOfFirstItem, indexOfLastItem);

  // Specialties list (defaults + dynamically populated from database profiles)
  const uniqueSpecialties = Array.from(
    new Set([
      'General OPD', 'Pediatrics', 'Dental Surgeon', 'Gynecology', 'Orthopedics',
      ...doctors.map(d => d.specialty).filter(Boolean)
    ])
  );

  // Statistics
  const totalCount = doctors.length;
  const activeCount = doctors.filter(d => d.status === 'Active').length;
  const inactiveCount = doctors.filter(d => d.status === 'Inactive').length;
  const specialtiesCount = new Set(doctors.map(d => d.specialty).filter(Boolean)).size;

  return (
    <div className="doctors-container fade-in">
      
      {/* Title Header Section */}
      <div className="doctors-header-section">
        <div className="header-left-title">
          <h2>Doctors</h2>
          <p className="breadcrumb-path">Dashboard / Doctors</p>
        </div>
        <div className="header-right-actions">
          <div className="date-selector-dropdown">
            <CalIcon size={16} />
            <span>Today, 17 July 2025</span>
            <ChevronDown size={14} />
          </div>
          <button className="add-doctor-btn" onClick={openAddModal}>
            <Plus size={16} />
            <span>Add Doctor</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon (4 Cards Row) */}
      <div className="doctors-kpi-ribbon">
        <div className="kpi-mini-card">
          <div className="icon-wrapper blue">
            <Award size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Doctors</span>
            <h3>{totalCount}</h3>
            <span className="trend-sub text-green">Registered</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Active Doctors</span>
            <h3>{activeCount}</h3>
            <span className="meta-sub">On duty</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper orange">
            <Clock size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Off Duty</span>
            <h3>{inactiveCount}</h3>
            <span className="meta-sub">Inactive</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper purple">
            <Plus size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Specialties</span>
            <h3>{specialtiesCount}</h3>
            <span className="meta-sub">Clinical areas</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Action Row */}
      <div className="doctors-filters-row">
        <div className="search-bar-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search doctors by name or specialty..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="select-dropdown-container">
          <div className="filter-dropdown">
            <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}>
              <option value="All">All Specialties</option>
              {uniqueSpecialties.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>

          <div className="filter-dropdown">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>
        </div>

        <div className="right-action-buttons">
          <button className="btn-icon-label filter" onClick={applyFilters}>
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="btn-icon-label reset" onClick={() => {
            setSearchTerm('');
            setSpecialtyFilter('All');
            setStatusFilter('All');
          }}>
            <XCircle size={16} className="icon" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Table Data Card */}
      <div className="doctors-table-card">
        {isLoading ? (
          <div className="loading-container-box">
            <Loader2 className="spinner" size={32} />
          </div>
        ) : (
          <div className="table-overflow-wrapper">
            <table className="doctors-list-table">
              <thead>
                <tr>
                  <th>DOCTOR</th>
                  <th>SPECIALTY</th>
                  <th>PHONE</th>
                  <th>EXPERIENCE</th>
                  <th>LOCATION</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((doc) => {
                  const initial = doc.full_name ? doc.full_name.replace('Dr. ', '').charAt(0).toUpperCase() : 'D';
                  return (
                    <tr key={doc.id}>
                      <td className="doctor-col">
                        <div className="doctor-info-cell">
                          <div className="doctor-avatar-circle">{initial}</div>
                          <div className="details">
                            <span className="name">{doc.full_name}</span>
                            <span className="email">{doc.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="specialty-col">
                        <span className="specialty-badge">{doc.specialty}</span>
                      </td>
                      <td className="phone-col">{doc.phone}</td>
                      <td className="exp-col">
                        <span className="experience-badge">{doc.experience}</span>
                      </td>
                      <td className="room-col">{doc.room}</td>
                      <td className="status-col">
                        <span className={`status-pill ${doc.status?.toLowerCase()}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="actions-col">
                        <div className="action-circular-buttons">
                          <button className="circular-btn eye" onClick={() => openViewModal(doc)} title="View Doctor details">
                            <Eye size={13} />
                          </button>
                          <button className="circular-btn edit" onClick={() => openEditModal(doc)} title="Edit Doctor">
                            <Edit size={13} />
                          </button>
                          <button className="circular-btn trash" onClick={() => handleDelete(doc.id)} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {currentItems.length === 0 && (
                  <tr>
                    <td colSpan="7" className="no-records-row">
                      No doctor profiles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="doctors-pagination-footer">
          <div className="pagination-count-label">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalItemsCount)} of {totalItemsCount} doctors
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

      {/* ADD / EDIT DOCTOR MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{maxWidth: modalMode === 'view' ? '850px' : '550px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? 'Add New Doctor' : modalMode === 'edit' ? 'Edit Doctor Profile' : 'Doctor Details & Weekly Schedule'}</h2>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            
            <div className="modal-body">
              {modalMode === 'view' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px' }}>
                  {/* Left Column: Doctor Details */}
                  <div className="doctor-view-details" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--border-color)', paddingRight: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                      <div className="doctor-avatar-circle" style={{ width: '48px', height: '48px', fontSize: '1.25rem', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 'bold' }}>
                        {selectedDoctor?.full_name ? selectedDoctor.full_name.replace('Dr. ', '').charAt(0).toUpperCase() : 'D'}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>{selectedDoctor?.full_name}</h3>
                        <span className="specialty-badge" style={{ marginTop: '4px' }}>{selectedDoctor?.specialty}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600', margin: 0 }}>{selectedDoctor?.email}</p>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600', margin: 0 }}>{selectedDoctor?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Experience</label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600', margin: 0 }}>{selectedDoctor?.experience || 'N/A'}</p>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room/Location</label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600', margin: 0 }}>{selectedDoctor?.room || 'N/A'}</p>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                        <div style={{ marginTop: '2px' }}>
                          <span className={`status-pill ${selectedDoctor?.status?.toLowerCase()}`}>
                            {selectedDoctor?.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Weekly Schedule Manager */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📅 Weekly Work Schedule
                    </h3>

                    {/* Add Schedule Form */}
                    <form onSubmit={handleAddSchedule} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Add Work Hours</span>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <select
                          className="premium-input"
                          style={{ flex: 1.2, padding: '6px 10px', fontSize: '0.82rem' }}
                          value={newSched.day_of_week}
                          onChange={e => setNewSched({ ...newSched, day_of_week: e.target.value })}
                        >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          className="premium-input"
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem' }}
                          value={newSched.start_time}
                          onChange={e => setNewSched({ ...newSched, start_time: e.target.value })}
                        />
                        <input
                          type="time"
                          className="premium-input"
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem' }}
                          value={newSched.end_time}
                          onChange={e => setNewSched({ ...newSched, end_time: e.target.value })}
                        />
                      </div>
                      <button type="submit" className="premium-btn" style={{ width: '100%', padding: '8px', fontSize: '0.82rem' }}>
                        + Add Schedule
                      </button>
                    </form>

                    {/* Schedule List */}
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {isLoadingSchedules ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading schedule...</div>
                      ) : schedules.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No working hours set yet.
                        </div>
                      ) : schedules.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                          <div>
                            <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)' }}>{s.day_of_week}</span>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSchedule(s.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                      <button type="button" className="btn-primary-custom" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 20px' }}>Close Details</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {submitError && <div className="error-alert-box">{submitError}</div>}
                  
                  <form onSubmit={handleSubmit}>
                <div className="form-grid-layout">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input 
                      type="text" 
                      name="full_name"
                      className="premium-input" 
                      required 
                      value={formData.full_name}
                      onChange={handleFormChange}
                      placeholder="E.g., Dr. Maryan Ahmed"
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address *</label>
                    <input 
                      type="email" 
                      name="email"
                      className="premium-input" 
                      required 
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="E.g., maryan@cayush.com"
                    />
                  </div>

                  {modalMode === 'add' && (
                    <div className="form-group">
                      <label>Account Password *</label>
                      <input 
                        type="password" 
                        name="password"
                        className="premium-input" 
                        required 
                        value={formData.password}
                        onChange={handleFormChange}
                        placeholder="Min 6 characters"
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input 
                      type="text" 
                      name="phone"
                      className="premium-input" 
                      value={formData.phone}
                      onChange={handleFormChange}
                      placeholder="+252..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Specialty</label>
                    <input 
                      type="text" 
                      name="specialty"
                      list="specialty-options-list"
                      className="premium-input"
                      value={formData.specialty}
                      onChange={handleFormChange}
                      placeholder="E.g. Neurology or select from suggestions"
                    />
                    <datalist id="specialty-options-list">
                      {uniqueSpecialties.map(spec => (
                        <option key={spec} value={spec} />
                      ))}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label>Experience (Years)</label>
                    <input 
                      type="text" 
                      name="experience"
                      className="premium-input" 
                      value={formData.experience}
                      onChange={handleFormChange}
                      placeholder="E.g., 5 Years"
                    />
                  </div>

                  <div className="form-group">
                    <label>Location / Room</label>
                    <input 
                      type="text" 
                      name="room"
                      className="premium-input" 
                      value={formData.room}
                      onChange={handleFormChange}
                      placeholder="E.g., Room 3"
                    />
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      name="status"
                      className="premium-input"
                      value={formData.status}
                      onChange={handleFormChange}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer-btns">
                  <button type="button" className="btn-secondary-custom" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary-custom" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Doctors;
