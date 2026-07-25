import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import {
  Clock, Calendar, UserCheck, ShieldAlert, ArrowRightLeft,
  Plus, Loader2, CheckCircle, XCircle, Trash2, Edit, X, Bell,
  FileText, DollarSign, Printer, Check, Ban
} from 'lucide-react';
import './Attendance.css';

const Attendance = () => {
  const { user } = useAuth();
  
  // Current user role check
  const [profile, setProfile] = useState(null);
  
  // Lists
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);

  // UI / Loading
  const [activeTab, setActiveTab] = useState('clocking'); 
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeString, setTimeString] = useState(new Date().toLocaleTimeString());

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Form States
  const [assignForm, setAssignForm] = useState({
    profile_id: '', shift_id: '', department_id: '',
    assignment_date: new Date().toISOString().split('T')[0],
    is_on_call: false, status: 'Scheduled'
  });

  const [swapForm, setSwapForm] = useState({
    shift_assignment_id: '', target_profile_id: '', reason: ''
  });

  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'Annual Leave',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reason: ''
  });

  const [payrollForm, setPayrollForm] = useState({
    profile_id: '', basic_salary: '', allowances: 0,
    overtime: 0, bonuses: 0, deductions: 0, advances: 0,
    payment_date: new Date().toISOString().split('T')[0],
    status: 'Unpaid'
  });

  // Current user's clocking record
  const [userRecord, setUserRecord] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeString(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data));
    }
  }, [user]);

  useEffect(() => {
    fetchShifts();
    fetchAssignments();
    fetchAttendance();
    fetchSwaps();
    fetchDropdowns();
    fetchLeaveRequests();
    fetchPayroll();
  }, [user]);

  const fetchDropdowns = async () => {
    try {
      const [staffRes, deptRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role').order('full_name'),
        supabase.from('departments').select('id, name').order('name')
      ]);
      setStaff(staffRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchShifts = async () => {
    try {
      const { data } = await supabase.from('staff_shifts').select('*').order('name');
      setShifts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*, profiles(full_name, role), staff_shifts(name, start_time, end_time), departments(name)')
        .order('assignment_date', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select('*, profiles(full_name, role)')
        .order('record_date', { ascending: false });
      setAttendance(data || []);

      if (user?.id) {
        const todayStr = new Date().toISOString().split('T')[0];
        const current = (data || []).find(r => r.profile_id === user.id && r.record_date === todayStr);
        setUserRecord(current || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSwaps = async () => {
    try {
      const { data } = await supabase
        .from('shift_swaps')
        .select('*, requestor:profiles!requestor_profile_id(full_name), target:profiles!target_profile_id(full_name), shift_assignments(*, staff_shifts(name, start_time, end_time))')
        .order('created_at', { ascending: false });
      setSwaps(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const { data } = await supabase
        .from('leave_requests')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false });
      setLeaveRequests(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayroll = async () => {
    try {
      const { data } = await supabase
        .from('payroll_records')
        .select('*, profiles(full_name, role)')
        .order('payment_date', { ascending: false });
      setPayrollRecords(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Clock In / Out handlers
  const handleClockIn = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      const isLate = new Date().getHours() >= 8 && new Date().getMinutes() > 15;

      const payload = {
        profile_id: user.id,
        record_date: todayStr,
        clock_in: nowTime,
        is_late: isLate,
        notes: isLate ? 'Arrived past grace period (08:15)' : 'On-time arrival'
      };

      const { data, error } = await supabase.from('attendance_records').insert([payload]).select().single();
      if (error) throw error;
      
      setUserRecord(data);
      fetchAttendance();
      alert('Clocked in successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!userRecord) return;
    setIsSubmitting(true);
    try {
      const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      const hours = new Date().getHours();
      const overtime = Math.max(0, hours - 17);

      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          clock_out: nowTime,
          overtime_hours: overtime,
          is_early_departure: hours < 16
        })
        .eq('id', userRecord.id)
        .select().single();

      if (error) throw error;

      setUserRecord(data);
      fetchAttendance();
      alert('Clocked out successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Roster assignment
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('shift_assignments').insert([assignForm]);
      if (error) throw error;
      setIsAssignModalOpen(false);
      fetchAssignments();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shift swaps
  const handleSwapSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...swapForm,
        requestor_profile_id: user.id,
        status: 'Pending'
      };
      const { error } = await supabase.from('shift_swaps').insert([payload]);
      if (error) throw error;
      setIsSwapModalOpen(false);
      fetchSwaps();
      alert('Shift swap request sent!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSwap = async (swap) => {
    try {
      const { error: swapError } = await supabase
        .from('shift_assignments')
        .update({ profile_id: swap.target_profile_id, status: 'Swapped' })
        .eq('id', swap.shift_assignment_id);

      if (swapError) throw swapError;
      await supabase.from('shift_swaps').update({ status: 'Approved' }).eq('id', swap.id);
      fetchSwaps();
      fetchAssignments();
      alert('Swap request approved and schedules updated!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectSwap = async (id) => {
    try {
      await supabase.from('shift_swaps').update({ status: 'Rejected' }).eq('id', id);
      fetchSwaps();
    } catch (err) {
      console.error(err);
    }
  };

  // Leave Requests handlers
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...leaveForm,
        profile_id: user.id,
        status: 'Pending'
      };
      const { error } = await supabase.from('leave_requests').insert([payload]);
      if (error) throw error;
      setIsLeaveModalOpen(false);
      fetchLeaveRequests();
      alert('Leave request submitted successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveLeave = async (id) => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status: 'Approved' }).eq('id', id);
      if (error) throw error;
      fetchLeaveRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectLeave = async (id) => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status: 'Rejected' }).eq('id', id);
      if (error) throw error;
      fetchLeaveRequests();
    } catch (err) {
      console.error(err);
    }
  };

  // Payroll handlers
  const calculatedNetSalary = useMemo(() => {
    const basic = parseFloat(payrollForm.basic_salary) || 0;
    const allow = parseFloat(payrollForm.allowances) || 0;
    const over = parseFloat(payrollForm.overtime) || 0;
    const bonus = parseFloat(payrollForm.bonuses) || 0;
    const deduct = parseFloat(payrollForm.deductions) || 0;
    const adv = parseFloat(payrollForm.advances) || 0;
    return Math.max(0, basic + allow + over + bonus - deduct - adv);
  }, [payrollForm]);

  const handlePayrollSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...payrollForm,
        basic_salary: parseFloat(payrollForm.basic_salary) || 0,
        allowances: parseFloat(payrollForm.allowances) || 0,
        overtime: parseFloat(payrollForm.overtime) || 0,
        bonuses: parseFloat(payrollForm.bonuses) || 0,
        deductions: parseFloat(payrollForm.deductions) || 0,
        advances: parseFloat(payrollForm.advances) || 0,
        net_salary: calculatedNetSalary
      };

      const { error } = await supabase.from('payroll_records').insert([payload]);
      if (error) throw error;
      
      setIsPayrollModalOpen(false);
      fetchPayroll();
      alert('Payroll record generated successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintPayslip = (pr) => {
    setSelectedPayslip(pr);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Filters / calculations
  const onCallStaff = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return assignments.filter(a => a.assignment_date === todayStr && a.is_on_call);
  }, [assignments]);

  const userAssignments = useMemo(() => {
    if (!user?.id) return [];
    return assignments.filter(a => a.profile_id === user.id && a.status === 'Scheduled');
  }, [assignments, user]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      present: attendance.filter(r => r.record_date === todayStr && r.clock_in).length,
      late: attendance.filter(r => r.record_date === todayStr && r.is_late).length,
      absent: attendance.filter(r => r.record_date === todayStr && r.is_absent).length,
      onCall: onCallStaff.length
    };
  }, [attendance, onCallStaff]);

  const isUserAdmin = profile?.role === 'Admin';

  return (
    <div className="attendance-layout">
      
      {/* NORMAL VIEW */}
      <div className="no-print">
        {/* Header */}
        <div className="attendance-header-row">
          <div className="attendance-header-left">
            <h1>Staff Shifts, Attendance & Payroll</h1>
            <p className="attendance-subtitle">Clock in daily saacado, monitor roster schedules, request shift swaps, submit leaves and payroll.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="premium-btn-outline" onClick={() => setIsLeaveModalOpen(true)}>
              <Calendar size={16} /> Request Leave
            </button>
            {isUserAdmin && (
              <button className="premium-btn" onClick={() => setIsPayrollModalOpen(true)}>
                <DollarSign size={16} /> Run Payroll
              </button>
            )}
          </div>
        </div>

        {/* Stats Ribbon */}
        <div className="attendance-stats-grid">
          <div className="attendance-stat-card">
            <div className="attendance-stat-icon present"><UserCheck size={20} /></div>
            <div className="attendance-stat-info">
              <h3>{stats.present}</h3>
              <p>Present Today</p>
            </div>
          </div>
          <div className="attendance-stat-card">
            <div className="attendance-stat-icon late"><ShieldAlert size={20} /></div>
            <div className="attendance-stat-info">
              <h3>{stats.late}</h3>
              <p>Late Arrivals</p>
            </div>
          </div>
          <div className="attendance-stat-card">
            <div className="attendance-stat-icon absent"><XCircle size={20} /></div>
            <div className="attendance-stat-info">
              <h3>{stats.absent}</h3>
              <p>Absent</p>
            </div>
          </div>
          <div className="attendance-stat-card">
            <div className="attendance-stat-icon on-call"><Bell size={20} /></div>
            <div className="attendance-stat-info">
              <h3>{stats.onCall}</h3>
              <p>On-Call Staff</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="procedures-tab-pills" style={{ alignSelf: 'flex-start' }}>
          <button className={`procedures-tab-pill ${activeTab === 'clocking' ? 'active' : ''}`} onClick={() => setActiveTab('clocking')}>Clocking Console</button>
          <button className={`procedures-tab-pill ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')}>Weekly Roster</button>
          <button className={`procedures-tab-pill ${activeTab === 'swaps' ? 'active' : ''}`} onClick={() => setActiveTab('swaps')}>Shift Swaps</button>
          <button className={`procedures-tab-pill ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>Leave Requests</button>
          <button className={`procedures-tab-pill ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>Payroll & Payslip</button>
          <button className={`procedures-tab-pill ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Attendance History</button>
        </div>

        {activeTab === 'clocking' && (
          <div className="attendance-split-panel">
            {/* Clocking Widget */}
            <div className="attendance-clocking-widget">
              <Clock size={48} color="var(--primary-brand)" />
              <h2>Digital Clock-In System</h2>
              <div className="attendance-clock-time">{timeString}</div>
              
              {userRecord?.clock_in ? (
                userRecord.clock_out ? (
                  <div>
                    <span className="attendance-badge-status off">Shift Completed</span>
                    <p style={{ marginTop: 8 }}>Clocked In: <strong>{userRecord.clock_in}</strong> | Clocked Out: <strong>{userRecord.clock_out}</strong></p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <span className="attendance-badge-status on">Active Duty</span>
                      <p style={{ marginTop: 8 }}>Clocked In at: <strong>{userRecord.clock_in}</strong></p>
                    </div>
                    <button className="attendance-clock-btn out" onClick={handleClockOut} disabled={isSubmitting}>
                      Clock Out
                    </button>
                  </div>
                )
              ) : (
                <button className="attendance-clock-btn in" onClick={handleClockIn} disabled={isSubmitting}>
                  Clock In
                </button>
              )}
            </div>

            {/* On Call list */}
            <div className="attendance-roster-box" style={{ padding: 20 }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 'bold' }}>On-Call Rotation Today</h4>
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                {onCallStaff.map(oc => (
                  <div key={oc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Dr. {oc.profiles?.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dept: {oc.departments?.name || 'General'}</div>
                    </div>
                    <span style={{ padding: '2px 8px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', borderRadius: 4, fontSize: '0.72rem', fontWeight: 'bold', alignSelf: 'center' }}>ON-CALL</span>
                  </div>
                ))}
                {onCallStaff.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>No staff on-call today.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roster' && (
          <div className="attendance-roster-box">
            <div className="attendance-roster-header">
              <h4>Roster Assignments</h4>
              {isUserAdmin && (
                <button className="premium-btn-outline" onClick={() => setIsAssignModalOpen(true)}>+ Roster Assign</button>
              )}
            </div>
            <table className="procedures-data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Assigned Shift</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(assign => (
                  <tr key={assign.id}>
                    <td><strong>{assign.profiles?.full_name}</strong></td>
                    <td>{assign.profiles?.role}</td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{assign.staff_shifts?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{assign.staff_shifts?.start_time?.substring(0, 5)} - {assign.staff_shifts?.end_time?.substring(0, 5)}</div>
                    </td>
                    <td>{assign.departments?.name || 'General'}</td>
                    <td>{assign.assignment_date}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 'bold',
                        background: assign.is_on_call ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
                        color: assign.is_on_call ? '#8B5CF6' : '#3B82F6'
                      }}>{assign.is_on_call ? 'ON-CALL' : 'SHIFT'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'swaps' && (
          <div className="attendance-roster-box">
            <div className="attendance-roster-header">
              <h4>Shift Swap Requests</h4>
              <button className="premium-btn-outline" onClick={() => setIsSwapModalOpen(true)}>+ New Swap Request</button>
            </div>
            <table className="procedures-data-table">
              <thead>
                <tr>
                  <th>Requestor</th>
                  <th>Target Staff</th>
                  <th>Target Shift Details</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {swaps.map(swap => (
                  <tr key={swap.id}>
                    <td><strong>{swap.requestor?.full_name}</strong></td>
                    <td>{swap.target?.full_name}</td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{swap.shift_assignments?.staff_shifts?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {swap.shift_assignments?.assignment_date}</div>
                    </td>
                    <td>{swap.reason || '—'}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 'bold',
                        background: swap.status === 'Approved' ? '#D1FAE5' : swap.status === 'Pending' ? '#FEF3C7' : '#FEE2E2',
                        color: swap.status === 'Approved' ? '#065F46' : swap.status === 'Pending' ? '#D97706' : '#991B1B'
                      }}>{swap.status}</span>
                    </td>
                    <td>
                      {swap.status === 'Pending' && swap.target_profile_id === user?.id && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="procedures-action-btn" onClick={() => handleApproveSwap(swap)} style={{ color: 'var(--primary-brand)', borderColor: 'var(--primary-brand)' }}><CheckCircle size={12} /> Accept</button>
                          <button className="procedures-action-btn" onClick={() => handleRejectSwap(swap.id)} style={{ color: 'var(--accent-red)' }}><XCircle size={12} /> Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'leave' && (
          <div className="attendance-roster-box">
            <div className="attendance-roster-header">
              <h4>Leave Requests & Approvals</h4>
            </div>
            <table className="procedures-data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Leave Type</th>
                  <th>Duration (Start - End)</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions (Admin)</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map(req => (
                  <tr key={req.id}>
                    <td><strong>{req.profiles?.full_name}</strong></td>
                    <td><span style={{ padding: '2px 6px', background: 'rgba(59,130,246,0.1)', color: '#3B82F6', borderRadius: 4, fontWeight: 'bold', fontSize: '0.72rem' }}>{req.leave_type}</span></td>
                    <td>{req.start_date} to {req.end_date}</td>
                    <td>{req.reason || '—'}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 'bold',
                        background: req.status === 'Approved' ? '#D1FAE5' : req.status === 'Pending' ? '#FEF3C7' : '#FEE2E2',
                        color: req.status === 'Approved' ? '#065F46' : req.status === 'Pending' ? '#D97706' : '#991B1B'
                      }}>{req.status}</span>
                    </td>
                    <td>
                      {isUserAdmin && req.status === 'Pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="procedures-action-btn" onClick={() => handleApproveLeave(req.id)} style={{ color: 'var(--primary-brand)', borderColor: 'var(--primary-brand)' }}><Check size={12} /> Approve</button>
                          <button className="procedures-action-btn" onClick={() => handleRejectLeave(req.id)} style={{ color: 'var(--accent-red)' }}><Ban size={12} /> Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="attendance-roster-box">
            <div className="attendance-roster-header">
              <h4>Payroll & Staff Payslips</h4>
            </div>
            
            {!isUserAdmin ? (
              // Non-admin can only see their own payslips
              <div>
                <div style={{ padding: '20px 24px', background: 'rgba(59,130,246,0.05)', borderRadius: 8, margin: 16, border: '1px solid var(--border-color)' }}>
                  <strong>🔒 Standard Employee Access:</strong> You can only inspect and print your personal payslips. Monthly details are managed by the administration team.
                </div>
                <table className="procedures-data-table">
                  <thead>
                    <tr>
                      <th>Pay Date</th>
                      <th>Basic Salary</th>
                      <th>Overtime / Allowances</th>
                      <th>Deductions / Advances</th>
                      <th>Net Salary</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRecords.filter(p => p.profile_id === user?.id).map(pr => (
                      <tr key={pr.id}>
                        <td>{pr.payment_date}</td>
                        <td>${parseFloat(pr.basic_salary).toFixed(2)}</td>
                        <td>Overtime: ${parseFloat(pr.overtime).toFixed(2)} · Allow: ${parseFloat(pr.allowances).toFixed(2)}</td>
                        <td>Deduct: -${parseFloat(pr.deductions).toFixed(2)} · Adv: -${parseFloat(pr.advances).toFixed(2)}</td>
                        <td><strong style={{ color: 'var(--primary-brand)' }}>${parseFloat(pr.net_salary).toFixed(2)}</strong></td>
                        <td>
                          <button className="procedures-action-btn" onClick={() => handlePrintPayslip(pr)}><Printer size={12} /> Print Payslip</button>
                        </td>
                      </tr>
                    ))}
                    {payrollRecords.filter(p => p.profile_id === user?.id).length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No payroll runs documented for your profile yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // Admin sees everything
              <table className="procedures-data-table">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Basic Salary</th>
                    <th>Allowances / Overtime</th>
                    <th>Deductions / Advances</th>
                    <th>Net Salary</th>
                    <th>Payment Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map(pr => (
                    <tr key={pr.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{pr.profiles?.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pr.profiles?.role}</div>
                      </td>
                      <td>${parseFloat(pr.basic_salary).toFixed(2)}</td>
                      <td>Allow: ${parseFloat(pr.allowances).toFixed(2)} · OT: ${parseFloat(pr.overtime).toFixed(2)}</td>
                      <td>Deduct: -${parseFloat(pr.deductions).toFixed(2)} · Adv: -${parseFloat(pr.advances).toFixed(2)}</td>
                      <td><strong style={{ color: 'var(--primary-brand)' }}>${parseFloat(pr.net_salary).toFixed(2)}</strong></td>
                      <td>{pr.payment_date}</td>
                      <td>
                        <button className="procedures-action-btn" onClick={() => handlePrintPayslip(pr)}><Printer size={12} /> Print Payslip</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="attendance-roster-box">
            <div className="attendance-roster-header">
              <h4>Attendance History Ledger</h4>
            </div>
            <table className="procedures-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Staff Member</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Overtime</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(rec => (
                  <tr key={rec.id}>
                    <td>{rec.record_date}</td>
                    <td><strong>{rec.profiles?.full_name}</strong></td>
                    <td>{rec.clock_in || '—'}</td>
                    <td>{rec.clock_out || '—'}</td>
                    <td>{rec.overtime_hours > 0 ? `${rec.overtime_hours} hrs` : '0'}</td>
                    <td>
                      {rec.is_absent ? (
                        <span className="attendance-badge-status off">Absent</span>
                      ) : rec.is_late ? (
                        <span className="attendance-badge-status off" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>Late</span>
                      ) : (
                        <span className="attendance-badge-status on">Present</span>
                      )}
                    </td>
                    <td>{rec.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PRINTABLE PAYSLIP VIEW ── */}
      {selectedPayslip && (
        <div className="printable-letter-container">
          <div className="printable-letter-header">
            <div className="clinic-logo-text">
              <h1>CAYUSH CLINIC</h1>
              <p>Staff Payroll Payslip</p>
            </div>
            <div className="clinic-contact-details">
              <strong>Cayush Specialist Hospital</strong><br />
              Ex-control Afgoye, Mogadishu, Somalia<br />
              Email: info@cayushclinic.com · Tel: +252 61 9639994
            </div>
          </div>

          <div className="letter-title">
            <h2>MONTHLY STAFF PAYSLIP</h2>
            <p><strong>Payment Date:</strong> {selectedPayslip.payment_date} · <strong>Status:</strong> {selectedPayslip.status}</p>
          </div>

          <div className="letter-info-block">
            <div className="letter-info-section">
              <h3>EMPLOYEE DETAILS</h3>
              <p><strong>Name:</strong> {selectedPayslip.profiles?.full_name}</p>
              <p><strong>Position/Role:</strong> {selectedPayslip.profiles?.role}</p>
              <p><strong>Department:</strong> Medical Staff</p>
            </div>
            <div className="letter-info-section">
              <h3>PAYSLIP DATA SUMMARY</h3>
              <p><strong>Reference:</strong> PAY-{selectedPayslip.id.substring(0, 8).toUpperCase()}</p>
              <p><strong>Currency:</strong> USD ($)</p>
            </div>
          </div>

          <div className="letter-body">
            <h4 style={{ borderBottom: '2px solid #000', paddingBottom: 6 }}>SALARY BREAKDOWN</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 0' }}><strong>Basic Salary:</strong></td>
                  <td style={{ textAlign: 'right' }}>${parseFloat(selectedPayslip.basic_salary).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 0' }}><strong>Allowances:</strong></td>
                  <td style={{ textAlign: 'right' }}>+${parseFloat(selectedPayslip.allowances).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 0' }}><strong>Overtime Pay:</strong></td>
                  <td style={{ textAlign: 'right' }}>+${parseFloat(selectedPayslip.overtime).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 0' }}><strong>Bonuses:</strong></td>
                  <td style={{ textAlign: 'right' }}>+${parseFloat(selectedPayslip.bonuses).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 0' }}><strong>Deductions:</strong></td>
                  <td style={{ textAlign: 'right' }}>-${parseFloat(selectedPayslip.deductions).toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 0' }}><strong>Advances:</strong></td>
                  <td style={{ textAlign: 'right' }}>-${parseFloat(selectedPayslip.advances).toFixed(2)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #000', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  <td style={{ padding: '12px 0' }}>NET SALARY PAID:</td>
                  <td style={{ textAlign: 'right', color: '#14B8A6' }}>${parseFloat(selectedPayslip.net_salary).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="letter-footer-block">
            <div className="letter-signature">
              <div style={{ height: '40px' }}></div>
              <div className="letter-signature-line">Authorized Signature</div>
              <div>Cayush Clinic HR Department</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <QRCodeSVG value={`https://cayushclinic.com/verify/payslip/${selectedPayslip.id}`} size={85} />
              <span style={{ fontSize: '0.65rem', color: '#666' }}>Scan to verify payslip validity</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGN SHIFT MODAL ── */}
      {isAssignModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>➕ Assign Shift</h2>
              <button className="close-modal-btn" onClick={() => setIsAssignModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Select Staff Member *</label>
                  <select className="premium-input" required value={assignForm.profile_id} onChange={e => setAssignForm({ ...assignForm, profile_id: e.target.value })}>
                    <option value="">-- Select Staff --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Select Shift *</label>
                  <select className="premium-input" required value={assignForm.shift_id} onChange={e => setAssignForm({ ...assignForm, shift_id: e.target.value })}>
                    <option value="">-- Choose Shift --</option>
                    {shifts.map(sh => <option key={sh.id} value={sh.id}>{sh.name} ({sh.start_time?.substring(0,5)} - {sh.end_time?.substring(0,5)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Select Department</label>
                  <select className="premium-input" value={assignForm.department_id} onChange={e => setAssignForm({ ...assignForm, department_id: e.target.value })}>
                    <option value="">-- General / None --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" className="premium-input" required value={assignForm.assignment_date} onChange={e => setAssignForm({ ...assignForm, assignment_date: e.target.value })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="on_call_chk" checked={assignForm.is_on_call} onChange={e => setAssignForm({ ...assignForm, is_on_call: e.target.checked })} style={{ width: 'auto' }} />
                  <label htmlFor="on_call_chk" style={{ cursor: 'pointer', margin: 0, fontWeight: 'bold' }}>Designate as On-Call Duty</label>
                </div>
                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Save Assignment</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST SHIFT SWAP MODAL ── */}
      {isSwapModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSwapModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>🔄 Request Shift Swap</h2>
              <button className="close-modal-btn" onClick={() => setIsSwapModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSwapSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Choose Your Scheduled Shift *</label>
                  <select className="premium-input" required value={swapForm.shift_assignment_id} onChange={e => setSwapForm({ ...swapForm, shift_assignment_id: e.target.value })}>
                    <option value="">-- Select Your Shift --</option>
                    {userAssignments.map(a => (
                      <option key={a.id} value={a.id}>{a.assignment_date} · {a.staff_shifts?.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Select Colleague to Swap With *</label>
                  <select className="premium-input" required value={swapForm.target_profile_id} onChange={e => setSwapForm({ ...swapForm, target_profile_id: e.target.value })}>
                    <option value="">-- Choose Colleague --</option>
                    {staff.filter(s => s.id !== user?.id).map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Reason for Swap</label>
                  <textarea className="premium-input" rows={2} value={swapForm.reason} onChange={e => setSwapForm({ ...swapForm, reason: e.target.value })} placeholder="e.g. Travel, medical appointment..." />
                </div>
                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsSwapModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Send Request</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST LEAVE MODAL ── */}
      {isLeaveModalOpen && (
        <div className="modal-overlay" onClick={() => setIsLeaveModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>📅 Submit Leave Request</h2>
              <button className="close-modal-btn" onClick={() => setIsLeaveModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Leave Type *</label>
                  <select className="premium-input" required value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
                    <option>Annual Leave</option>
                    <option>Sick Leave</option>
                    <option>Maternity Leave</option>
                    <option>Casual Leave</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input type="date" className="premium-input" required value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>End Date *</label>
                    <input type="date" className="premium-input" required value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reason / Description</label>
                  <textarea className="premium-input" rows={3} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="State specific reasons for your leave..." />
                </div>
                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsLeaveModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── RUN PAYROLL MODAL (ADMIN ONLY) ── */}
      {isPayrollModalOpen && isUserAdmin && (
        <div className="modal-overlay" onClick={() => setIsPayrollModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>💵 Run Employee Payroll</h2>
              <button className="close-modal-btn" onClick={() => setIsPayrollModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handlePayrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Select Employee *</label>
                  <select className="premium-input" required value={payrollForm.profile_id} onChange={e => setPayrollForm({ ...payrollForm, profile_id: e.target.value })}>
                    <option value="">-- Choose Employee --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Basic Salary ($) *</label>
                    <input type="number" step="0.01" className="premium-input" required value={payrollForm.basic_salary} onChange={e => setPayrollForm({ ...payrollForm, basic_salary: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Allowances ($)</label>
                    <input type="number" step="0.01" className="premium-input" value={payrollForm.allowances} onChange={e => setPayrollForm({ ...payrollForm, allowances: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Overtime Pay ($)</label>
                    <input type="number" step="0.01" className="premium-input" value={payrollForm.overtime} onChange={e => setPayrollForm({ ...payrollForm, overtime: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Bonuses ($)</label>
                    <input type="number" step="0.01" className="premium-input" value={payrollForm.bonuses} onChange={e => setPayrollForm({ ...payrollForm, bonuses: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Deductions ($)</label>
                    <input type="number" step="0.01" className="premium-input" value={payrollForm.deductions} onChange={e => setPayrollForm({ ...payrollForm, deductions: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Advances ($)</label>
                    <input type="number" step="0.01" className="premium-input" value={payrollForm.advances} onChange={e => setPayrollForm({ ...payrollForm, advances: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Payment Date *</label>
                    <input type="date" className="premium-input" required value={payrollForm.payment_date} onChange={e => setPayrollForm({ ...payrollForm, payment_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Calculated Net Salary</label>
                    <input type="text" className="premium-input" readOnly value={`$${calculatedNetSalary.toFixed(2)}`} style={{ background: 'var(--bg-body)', fontWeight: 'bold', color: 'var(--primary-brand)' }} />
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsPayrollModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Disburse Pay</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Attendance;
