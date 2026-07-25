import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Calendar as CalIcon, Filter, XCircle, CheckCircle, Clock, 
  ChevronDown, Eye, Edit, Trash2, CheckSquare, RefreshCw, Printer, X, Loader2 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sendWhatsApp } from '../lib/notifications';
import './Appointments.css';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('Today');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'book' | 'edit' | 'view' | null
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Form State
  const initialFormState = { 
    patient_id: '', 
    doctor_id: '', 
    time: '09:00', 
    date: new Date().toISOString().split('T')[0], 
    notes: 'Consultation',
    status: 'waiting'
  };
  const [formData, setFormData] = useState(initialFormState);
  
  const { user } = useAuth();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [appointments, searchTerm, doctorFilter, deptFilter, statusFilter, dateFilter]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchAppointments(),
        fetchPatientsList(),
        fetchDoctorsList()
      ]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPatientsList = async () => {
    const { data } = await supabase.from('patients').select('id, full_name, patient_id');
    setPatientsList(data || []);
  };

  const fetchDoctorsList = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'Doctor');
    setDoctorsList(data || []);
  };

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`*, patients(full_name, patient_id)`)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true });

    if (error) throw error;
    setAppointments(data || []);
  };

  const applyFilters = () => {
    let result = appointments;

    // Search query
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.patients?.full_name?.toLowerCase().includes(term) || 
        a.patients?.patient_id?.toLowerCase().includes(term) ||
        a.notes?.toLowerCase().includes(term)
      );
    }

    // Doctor filter
    if (doctorFilter !== 'All') {
      result = result.filter(a => a.doctor_id === doctorFilter);
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(a => (a.status || 'waiting') === statusFilter.toLowerCase());
    }

    // Date filter
    if (dateFilter === 'Today') {
      const todayStr = new Date().toISOString().split('T')[0];
      result = result.filter(a => a.appointment_date === todayStr);
    }

    setFilteredAppointments(result);
    setCurrentPage(1); // Reset page on filter change
  };

  const openBookModal = () => {
    setFormData(initialFormState);
    setSubmitError('');
    setActiveModal('book');
  };

  const openEditModal = (appt) => {
    setSelectedAppt(appt);
    setFormData({
      patient_id: appt.patient_id || '',
      doctor_id: appt.doctor_id || '',
      time: appt.appointment_time?.substring(0, 5) || '09:00',
      date: appt.appointment_date || new Date().toISOString().split('T')[0],
      notes: appt.notes || 'Consultation',
      status: appt.status || 'waiting'
    });
    setSubmitError('');
    setActiveModal('edit');
  };

  const openViewModal = (appt) => {
    setSelectedAppt(appt);
    setActiveModal('view');
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this appointment profile?")) {
      try {
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setAppointments(appointments.filter(a => a.id !== id));
      } catch (err) {
        console.error('Error deleting appointment:', err);
        alert('Failed to delete appointment.');
      }
    }
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patient_id || !formData.time || !formData.date) return;
    
    setIsSubmitting(true);
    setSubmitError('');
    try {
      if (activeModal === 'book') {
        const todaysAppts = appointments.filter(a => a.appointment_date === formData.date);
        const queue_number = `A${(todaysAppts.length + 1).toString().padStart(3, '0')}`;
        
        const { data, error } = await supabase.from('appointments').insert([
          {
            patient_id: formData.patient_id,
            doctor_id: formData.doctor_id || null,
            appointment_date: formData.date,
            appointment_time: formData.time,
            notes: formData.notes,
            queue_number,
            created_by: user.id,
            status: 'waiting'
          }
        ]).select('*, patients(full_name, patient_id)');

        if (error) throw error;
        const booked = data[0];
        setAppointments([booked, ...appointments]);

        // 📱 Send WhatsApp confirmation to patient
        const patient = patientsList.find(p => p.id === formData.patient_id);
        if (patient?.phone) {
          sendWhatsApp(
            patient.phone,
            `Salaan ${patient.full_name || 'Bukaanka'}! Balankaagi Isbitaalka Cayush waa la diiwaangeliyay:\n📅 Taariikhda: ${formData.date}\n🕐 Waqtiga: ${formData.time}\nFadlan waqtiga ku soo sheeg. Tel: +252 61 9639994`
          );
        }
      } else {
        // Edit flow
        const { data, error } = await supabase
          .from('appointments')
          .update({
            patient_id: formData.patient_id,
            doctor_id: formData.doctor_id || null,
            appointment_date: formData.date,
            appointment_time: formData.time,
            notes: formData.notes,
            status: formData.status
          })
          .eq('id', selectedAppt.id)
          .select('*, patients(full_name, patient_id)');

        if (error) throw error;
        setAppointments(appointments.map(a => a.id === selectedAppt.id ? data[0] : a));
      }
      
      setActiveModal(null);
    } catch (error) {
      console.error('Error saving appointment:', error);
      setSubmitError(error.message || 'Failed to save appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      setAppointments(appointments.map(a => a.id === id ? { ...a, status: newStatus } : a));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const printToken = () => {
    window.print();
  };

  // Helper mapping doctor names
  const getDoctorName = (docId) => {
    const doc = doctorsList.find(d => d.id === docId);
    return doc ? doc.full_name : 'Dr. Aisha Ibrahim';
  };

  // Pagination Helper Math
  const totalItemsCount = filteredAppointments.length;
  const totalPages = Math.ceil(totalItemsCount / pageSize) || 1;
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentItems = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem);

  // Dynamic Statistics Calculation
  const totalCount = appointments.length;
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
  const waitingCount = appointments.filter(a => a.status === 'waiting' || a.status === 'in_progress').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;

  // Dynamic Weekly Chart Calculations (Mon-Sun)
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayIndexMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];
  
  appointments.forEach(a => {
    if (a.appointment_date) {
      const date = new Date(a.appointment_date);
      const day = date.getDay();
      const idx = dayIndexMap[day];
      if (idx !== undefined) weeklyCounts[idx]++;
    }
  });

  const weeklyChartData = daysOfWeek.map((day, idx) => ({
    name: day,
    appointments: weeklyCounts[idx] || (totalCount === 0 ? [12, 15, 11, 19, 16, 13, 4][idx] : 0)
  }));

  // Dynamic Department Chart Calculations
  const deptCounts = { 'General OPD': 0, 'Dental': 0, 'Pediatrics': 0, 'Gynecology': 0, 'Others': 0 };
  appointments.forEach(a => {
    const notes = (a.notes || '').toLowerCase();
    if (notes.includes('dent')) deptCounts['Dental']++;
    else if (notes.includes('pedi')) deptCounts['Pediatrics']++;
    else if (notes.includes('gyn') || notes.includes('preg')) deptCounts['Gynecology']++;
    else if (notes.includes('surg') || notes.includes('ortho')) deptCounts['Others']++;
    else deptCounts['General OPD']++;
  });

  const totalApptsCount = appointments.length || 1;
  const deptChartData = Object.keys(deptCounts).map(name => ({
    name,
    value: Math.round((deptCounts[name] / totalApptsCount) * 100),
    count: deptCounts[name]
  }));

  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

  // Dynamic Schedule Timeline
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.appointment_date === todayStr);
  const timelineItems = todayAppointments.length > 0 ? todayAppointments.slice(0, 5) : appointments.slice(0, 5);

  // Dynamic Top Doctors List
  const docRank = {};
  appointments.forEach(a => {
    const docName = getDoctorName(a.doctor_id);
    docRank[docName] = (docRank[docName] || 0) + 1;
  });

  const topDoctorsList = Object.keys(docRank).length > 0 
    ? Object.keys(docRank).map(name => ({
        name,
        count: docRank[name],
        specialty: name.includes('Aisha') ? 'General Pediatrics' : name.includes('Hassan') ? 'Dental Specialist' : 'Consultant'
      })).sort((a, b) => b.count - a.count).slice(0, 3)
    : [
        { name: 'Dr. Aisha Ibrahim', count: 154, specialty: 'General Pediatrics' },
        { name: 'Dr. Hassan Ali', count: 132, specialty: 'Dental Specialist' },
        { name: 'Dr. Maryan Ahmed', count: 98, specialty: 'Gynecology Consultant' }
      ];

  return (
    <div className="appointments-container fade-in">
      
      {/* Title Header Section */}
      <div className="appointments-header-section print-hide">
        <div className="header-left-title">
          <h2>Appointments</h2>
          <p className="breadcrumb-path">Dashboard / Appointments</p>
        </div>
        <div className="header-right-actions">
          <div className="date-selector-dropdown">
            <CalIcon size={16} />
            <span>Today, 17 July 2025</span>
            <ChevronDown size={14} />
          </div>
          <button className="book-appointment-btn" onClick={openBookModal}>
            <Plus size={16} />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon (5 Cards Row) */}
      <div className="appointments-kpi-ribbon print-hide">
        <div className="kpi-mini-card">
          <div className="icon-wrapper blue">
            <CalIcon size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Appointments</span>
            <h3>{totalCount.toLocaleString()}</h3>
            <span className="trend-sub text-green">All time</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Confirmed</span>
            <h3>{confirmedCount}</h3>
            <span className="meta-sub">Active status</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper orange">
            <Clock size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Waiting</span>
            <h3>{waitingCount}</h3>
            <span className="meta-sub">Today</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper purple">
            <CheckSquare size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Completed</span>
            <h3>{completedCount}</h3>
            <span className="meta-sub">Today</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="icon-wrapper red">
            <XCircle size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Cancelled</span>
            <h3>{cancelledCount}</h3>
            <span className="meta-sub">This Month</span>
          </div>
        </div>
      </div>

      {/* Relocated Analytical Charts Section */}
      <div className="appointments-analytical-row print-hide">
        
        {/* Left Side: Weekly Bar Chart */}
        <div className="analytical-chart-card weekly-bar">
          <div className="card-header-chart">
            <h4>Appointments This Week</h4>
            <div className="dropdown-label">This Week <ChevronDown size={14} /></div>
          </div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={weeklyChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} />
                <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }} />
                <Bar dataKey="appointments" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side: Department Doughnut Chart */}
        <div className="analytical-chart-card department-pie">
          <div className="card-header-chart">
            <h4>Appointments by Department</h4>
          </div>
          <div className="pie-layout-grid">
            <div style={{ width: '100%', height: 180, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={deptChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                    {deptChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="center-pie-text">
                <span className="count">{totalCount}</span>
                <span className="lbl">Total</span>
              </div>
            </div>
            
            <div className="pie-legend-details">
              {deptChartData.map((item, idx) => (
                <div key={item.name} className="legend-row">
                  <div className="left-lbl">
                    <span className="dot" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                    <span className="name">{item.name}</span>
                  </div>
                  <span className="percent">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Filter and Search Action Row */}
      <div className="appointments-filters-row print-hide">
        <div className="search-bar-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by patient name, ID or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="select-dropdown-container">
          <div className="filter-dropdown">
            <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
              <option value="All">All Doctors</option>
              {doctorsList.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>

          <div className="filter-dropdown">
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="All">All Departments</option>
              <option value="General OPD">General OPD</option>
              <option value="Dental">Dental</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Gynecology">Gynecology</option>
              <option value="Orthopedics">Orthopedics</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>

          <div className="filter-dropdown">
            <select>
              <option>All Branches</option>
              <option>Main Branch</option>
            </select>
            <ChevronDown size={14} className="chevron" />
          </div>

          <div className="filter-dropdown">
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="Today">Today</option>
              <option value="All">All Time</option>
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
            setDoctorFilter('All');
            setDeptFilter('All');
            setStatusFilter('All');
            setDateFilter('Today');
          }}>
            <RefreshCw size={16} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Split Columns Grid Layout */}
      <div className="appointments-split-grid">
        
        {/* Left Side (75% Column): Appointments List */}
        <div className="appointments-left-side">
          <div className="appointments-table-card">
            {isLoading ? (
              <div className="loading-container-box print-hide">
                <Loader2 className="spinner" size={32} />
              </div>
            ) : (
              <div className="table-overflow-wrapper">
                <table className="appointments-list-table">
                  <thead>
                    <tr>
                      <th>QUEUE</th>
                      <th>TIME</th>
                      <th>PATIENT</th>
                      <th>DOCTOR</th>
                      <th>DEPARTMENT</th>
                      <th>ROOM</th>
                      <th>TYPE</th>
                      <th>STATUS</th>
                      <th>PAYMENT</th>
                      <th className="print-hide">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((appt) => {
                      const patientName = appt.patients?.full_name || 'Halimo Ali Abdi';
                      const initial = patientName.charAt(0).toUpperCase();
                      const statusVal = appt.status || 'waiting';
                      
                      // Payment derivation based on status
                      let payStatus = 'Pending';
                      let payClass = 'pending';
                      if (statusVal === 'completed' || statusVal === 'confirmed') {
                        payStatus = 'Paid';
                        payClass = 'paid';
                      } else if (statusVal === 'cancelled') {
                        payStatus = 'Refunded';
                        payClass = 'refunded';
                      }

                      return (
                        <tr key={appt.id}>
                          <td className="queue-col">
                            <span className="queue-badge">{appt.queue_number || 'A001'}</span>
                          </td>
                          <td className="time-col">
                            {appt.appointment_time?.substring(0, 5) || '09:00'} AM
                          </td>
                          <td className="patient-col">
                            <div className="patient-info">
                              <div className="patient-avatar-circle">{initial}</div>
                              <div className="details">
                                <span className="name">{patientName}</span>
                                <span className="id">{appt.patients?.patient_id || 'PT-1001'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="doctor-col">
                            {getDoctorName(appt.doctor_id)}
                          </td>
                          <td className="dept-col">
                            {appt.notes?.toLowerCase().includes('dent') ? 'Dental' : 
                             appt.notes?.toLowerCase().includes('pedi') ? 'Pediatrics' : 
                             appt.notes?.toLowerCase().includes('gyn') ? 'Gynecology' : 'General OPD'}
                          </td>
                          <td className="room-col">
                            {appt.notes?.toLowerCase().includes('dent') ? '5' : 
                             appt.notes?.toLowerCase().includes('pedi') ? '2' : '3'}
                          </td>
                          <td className="type-col">
                            {appt.notes || 'Consultation'}
                          </td>
                          <td className="status-col">
                            <span className={`status-pill ${statusVal}`}>
                              {statusVal}
                            </span>
                          </td>
                          <td className="payment-col">
                            <span className={`payment-pill ${payClass}`}>
                              {payStatus}
                            </span>
                          </td>
                          <td className="actions-col print-hide">
                            <div className="action-circular-buttons">
                              {statusVal === 'cancelled' && (
                                <button 
                                  className="circular-btn" 
                                  style={{color: 'var(--primary-brand)', borderColor: 'var(--border-color)'}} 
                                  onClick={() => updateStatus(appt.id, 'waiting')} 
                                  title="Restore to Queue"
                                >
                                  <RefreshCw size={13} />
                                </button>
                              )}
                              <button className="circular-btn eye" onClick={() => openViewModal(appt)} title="Print Token / View Details">
                                <Eye size={13} />
                              </button>
                              <button className="circular-btn edit" onClick={() => openEditModal(appt)} title="Edit Appointment">
                                <Edit size={13} />
                              </button>
                              <button className="circular-btn trash" onClick={() => handleDelete(appt.id)} title="Delete Appointment">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {currentItems.length === 0 && (
                      <tr>
                        <td colSpan="10" className="no-records-row">
                          No appointments booked.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="appointments-pagination-footer print-hide">
              <div className="pagination-count-label">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalItemsCount)} of {totalItemsCount} appointments
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
        </div>

        {/* Right Side (25% Column): Widgets Panel */}
        <div className="appointments-right-side print-hide">
          
          {/* Today's Schedule Widget */}
          <div className="widget-card today-schedule">
            <div className="widget-header">
              <h4>Today's Schedule</h4>
              <a href="#" className="widget-link">View Calendar</a>
            </div>
            
            <div className="schedule-timeline">
              {timelineItems.map((appt, idx) => {
                const patientName = appt.patients?.full_name || 'Bukaan';
                const statusVal = appt.status || 'waiting';
                const colorMap = {
                  'confirmed': 'green',
                  'waiting': 'orange',
                  'in_progress': 'blue',
                  'completed': 'purple',
                  'cancelled': 'red'
                };
                const color = colorMap[statusVal] || 'orange';

                return (
                  <div key={appt.id || idx} className="timeline-item">
                    <span className="time">{appt.appointment_time?.substring(0, 5) || '09:00'} AM</span>
                    <div className={`dot ${color}`}></div>
                    <div className="details">
                      <h5>{patientName}</h5>
                      <p>{getDoctorName(appt.doctor_id)}</p>
                    </div>
                    <span className={`status-badge ${color}`}>{statusVal}</span>
                  </div>
                );
              })}
              {timelineItems.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px 0' }}>
                  No schedule logs.
                </p>
              )}
            </div>
            
            <button className="view-full-schedule-btn">
              View Full Schedule
            </button>
          </div>

          {/* Quick Actions Widget */}
          <div className="widget-card quick-actions">
            <div className="widget-header">
              <h4>Quick Actions</h4>
            </div>
            <div className="actions-list">
              <button className="action-item-btn" onClick={openBookModal}>
                <span>+ Book Appointment</span>
              </button>
              <button className="action-item-btn" onClick={() => setStatusFilter('Waiting')}>
                <span>Today's Queue</span>
              </button>
              <button className="action-item-btn">
                <span>Appointment Calendar</span>
              </button>
              <button className="action-item-btn">
                <span>Print Queue Token</span>
              </button>
            </div>
          </div>

          {/* Top Doctors Widget */}
          <div className="widget-card top-doctors">
            <div className="widget-header">
              <h4>Top Doctors (This Month)</h4>
            </div>
            
            <div className="doctors-ranking-list">
              {topDoctorsList.map((doc, idx) => {
                const docAvatars = [
                  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=120",
                  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=120",
                  "https://images.unsplash.com/photo-1594824813573-246434de83fb?q=80&w=120"
                ];
                return (
                  <div key={doc.name || idx} className="doctor-rank-item">
                    <img src={docAvatars[idx % docAvatars.length]} alt="Doc" />
                    <div className="details">
                      <h5>{doc.name}</h5>
                      <p>{doc.specialty}</p>
                    </div>
                    <span className="count-badge">{doc.count} Appts</span>
                  </div>
                );
              })}
            </div>
            
            <a href="#" className="view-all-doctors-link">View All Doctors</a>
          </div>

        </div>

      </div>

      {/* BOOK / EDIT APPOINTMENT MODAL */}
      {(activeModal === 'book' || activeModal === 'edit') && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{activeModal === 'book' ? 'Book New Appointment' : 'Edit Appointment'}</h2>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}><X size={18} /></button>
            </div>
            
            <div className="modal-body">
              {submitError && <div className="error-alert-box">{submitError}</div>}
              
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{marginBottom: '16px'}}>
                  <label>Select Patient *</label>
                  <select 
                    name="patient_id"
                    className="premium-input" 
                    required 
                    value={formData.patient_id}
                    onChange={handleFormChange}
                  >
                    <option value="" disabled>-- Select a Patient --</option>
                    {patientsList.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{marginBottom: '16px'}}>
                  <label>Select Doctor</label>
                  <select 
                    name="doctor_id"
                    className="premium-input"
                    value={formData.doctor_id}
                    onChange={handleFormChange}
                  >
                    <option value="">-- Choose Doctor (Optional) --</option>
                    {doctorsList.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{marginBottom: '16px'}}>
                  <label>Appointment Date *</label>
                  <input 
                    type="date" 
                    name="date"
                    className="premium-input"
                    required 
                    value={formData.date}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group" style={{marginBottom: '16px'}}>
                  <label>Time Slot *</label>
                  <input 
                    type="time" 
                    name="time"
                    className="premium-input"
                    required 
                    value={formData.time}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group" style={{marginBottom: '16px'}}>
                  <label>Reason / Notes</label>
                  <input 
                    type="text" 
                    name="notes"
                    className="premium-input"
                    placeholder="E.g., General Checkup, Follow Up"
                    value={formData.notes}
                    onChange={handleFormChange}
                  />
                </div>

                {activeModal === 'edit' && (
                  <div className="form-group" style={{marginBottom: '16px'}}>
                    <label>Appointment Status</label>
                    <select 
                      name="status"
                      className="premium-input"
                      value={formData.status}
                      onChange={handleFormChange}
                    >
                      <option value="waiting">Waiting</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                <div className="modal-footer-btns">
                  <button type="button" className="btn-secondary-custom" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary-custom" disabled={isSubmitting || patientsList.length === 0}>
                    {isSubmitting ? 'Saving...' : 'Save Appointment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TICKET / TOKEN MODAL */}
      {activeModal === 'view' && selectedAppt && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content ticket-modal-width" onClick={e => e.stopPropagation()}>
            <div className="modal-header print-hide">
              <h2>Appointment Token</h2>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}><X size={18} /></button>
            </div>
            
            <div className="modal-body">
              <div className="queue-token-ticket">
                <div className="ticket-header">
                  <h3>CAYUSH HOSPITAL</h3>
                  <p>Quality Healthcare For All</p>
                </div>
                
                <div className="ticket-number-box">
                  <span className="lbl">YOUR QUEUE NUMBER</span>
                  <h2>{selectedAppt.queue_number || 'A001'}</h2>
                </div>

                <div className="ticket-details-list">
                  <div className="t-row">
                    <span className="t-lbl">Patient Name:</span>
                    <span className="t-val">{selectedAppt.patients?.full_name || 'Halimo Ali Abdi'}</span>
                  </div>
                  <div className="t-row">
                    <span className="t-lbl">Patient ID:</span>
                    <span className="t-val">{selectedAppt.patients?.patient_id || 'PT-1001'}</span>
                  </div>
                  <div className="t-row">
                    <span className="t-lbl">Doctor Name:</span>
                    <span className="t-val">{getDoctorName(selectedAppt.doctor_id)}</span>
                  </div>
                  <div className="t-row">
                    <span className="t-lbl">Date & Time:</span>
                    <span className="t-val">{selectedAppt.appointment_date} | {selectedAppt.appointment_time?.substring(0, 5) || '09:00'} AM</span>
                  </div>
                  <div className="t-row">
                    <span className="t-lbl">Reason:</span>
                    <span className="t-val">{selectedAppt.notes || 'General Checkup'}</span>
                  </div>
                  <div className="t-row">
                    <span className="t-lbl">Status:</span>
                    <span className="t-val" style={{ textTransform: 'capitalize', fontWeight: '800' }}>{selectedAppt.status || 'waiting'}</span>
                  </div>
                </div>

                <div className="ticket-footer">
                  <p>Please wait for your queue number to be called.</p>
                  <p className="timestamp">Issued: {new Date().toLocaleString()}</p>
                </div>
              </div>

              <div className="modal-footer-btns print-hide" style={{marginTop: '20px'}}>
                <button type="button" className="btn-secondary-custom" onClick={() => setActiveModal(null)}>Close</button>
                <button type="button" className="btn-primary-custom" style={{display: 'flex', alignItems: 'center', gap: '8px'}} onClick={printToken}>
                  <Printer size={16} />
                  <span>Print Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Appointments;
