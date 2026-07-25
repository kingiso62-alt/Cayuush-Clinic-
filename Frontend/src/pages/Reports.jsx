import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Calendar, TrendingUp, Users, DollarSign, Activity, Download, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Reports.css';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

const Reports = () => {
  const [period, setPeriod] = useState('7days');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [kpiData, setKpiData] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    completedTests: 0,
  });
  const [appointmentTrend, setAppointmentTrend] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [topTests, setTopTests] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const getDaysBack = () => {
    if (period === '7days') return 7;
    if (period === '30days') return 30;
    return 90;
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchKPIs(),
        fetchAppointmentTrend(),
        fetchRevenueTrend(),
        fetchStatusBreakdown(),
        fetchTopTests(),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKPIs = async () => {
    const [patientsRes, apptRes, revenueRes, labRes] = await Promise.all([
      supabase.from('patients').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase.from('invoices').select('amount_paid'),
      supabase.from('lab_requests').select('id', { count: 'exact', head: true }).eq('status', 'Completed'),
    ]);

    const totalRevenue = (revenueRes.data || []).reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0);

    setKpiData({
      totalPatients: patientsRes.count || 0,
      totalAppointments: apptRes.count || 0,
      totalRevenue,
      completedTests: labRes.count || 0,
    });
  };

  const fetchAppointmentTrend = async () => {
    const days = getDaysBack();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('appointments')
      .select('appointment_date, status')
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .order('appointment_date', { ascending: true });

    if (error || !data) return;

    // Group by date
    const grouped = {};
    data.forEach(appt => {
      const date = appt.appointment_date;
      if (!grouped[date]) grouped[date] = { date, total: 0, completed: 0, waiting: 0, cancelled: 0 };
      grouped[date].total++;
      grouped[date][appt.status] = (grouped[date][appt.status] || 0) + 1;
    });

    // Fill missing days
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      result.push(grouped[dateStr] ? { ...grouped[dateStr], date: label } : { date: label, total: 0, completed: 0, waiting: 0, cancelled: 0 });
    }

    setAppointmentTrend(result);
  };

  const fetchRevenueTrend = async () => {
    const days = getDaysBack();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .gte('payment_date', startDate.toISOString())
      .order('payment_date', { ascending: true });

    if (error || !data) return;

    const grouped = {};
    data.forEach(p => {
      const date = p.payment_date.split('T')[0];
      if (!grouped[date]) grouped[date] = 0;
      grouped[date] += parseFloat(p.amount);
    });

    const result = [];
    for (let i = Math.min(days, 14) - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      result.push({ date: label, revenue: grouped[dateStr] || 0 });
    }

    setRevenueTrend(result);
  };

  const fetchStatusBreakdown = async () => {
    const { data, error } = await supabase.from('appointments').select('status');
    if (error || !data) return;

    const counts = { waiting: 0, completed: 0, cancelled: 0 };
    data.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });

    setStatusBreakdown([
      { name: 'Waiting', value: counts.waiting },
      { name: 'Completed', value: counts.completed },
      { name: 'Cancelled', value: counts.cancelled },
    ]);
  };

  const fetchTopTests = async () => {
    const { data, error } = await supabase
      .from('lab_requests')
      .select('lab_catalog(test_name)');

    if (error || !data) return;

    const counts = {};
    data.forEach(r => {
      const name = r.lab_catalog?.test_name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    setTopTests(sorted);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color, fontSize: '0.9rem' }}>
              {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? `$${p.value.toFixed(2)}` : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page-layout">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Reports & Analytics</h1>
          <p>Real-time overview of clinic performance</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Period Selector */}
          <div className="period-switcher">
            {[
              { key: '7days', label: '7 Days' },
              { key: '30days', label: '30 Days' },
              { key: '90days', label: '90 Days' },
            ].map(p => (
              <button
                key={p.key}
                className={`period-btn ${period === p.key ? 'active' : ''}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="premium-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="reports-kpi-grid">
        <div className="reports-kpi-card">
          <div className="rk-icon" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
            <Users size={22} />
          </div>
          <div className="rk-info">
            <p>Total Patients</p>
            <h3>{kpiData.totalPatients}</h3>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="rk-icon" style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
            <Calendar size={22} />
          </div>
          <div className="rk-info">
            <p>Total Appointments</p>
            <h3>{kpiData.totalAppointments}</h3>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="rk-icon" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <DollarSign size={22} />
          </div>
          <div className="rk-info">
            <p>Total Revenue</p>
            <h3>${kpiData.totalRevenue.toFixed(2)}</h3>
          </div>
        </div>
        <div className="reports-kpi-card">
          <div className="rk-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
            <Activity size={22} />
          </div>
          <div className="rk-info">
            <p>Lab Tests Completed</p>
            <h3>{kpiData.completedTests}</h3>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="charts-grid">
        {/* Appointment Trend */}
        <div className="chart-card wide">
          <div className="chart-card-header">
            <h2>Appointment Trend</h2>
            <span className="chart-period-label">{period === '7days' ? 'Last 7 Days' : period === '30days' ? 'Last 30 Days' : 'Last 90 Days'}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={appointmentTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} />
              <Area type="monotone" dataKey="total" name="Total" stroke="#10B981" strokeWidth={2} fill="url(#colorTotal)" dot={false} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#3B82F6" strokeWidth={2} fill="url(#colorCompleted)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown Pie */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h2>Status Breakdown</h2>
          </div>
          {statusBreakdown.every(s => s.value === 0) ? (
            <div className="empty-chart">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Second Row */}
      <div className="charts-grid" style={{ marginTop: '24px' }}>
        {/* Revenue Trend */}
        <div className="chart-card wide">
          <div className="chart-card-header">
            <h2>Revenue Trend</h2>
            <span className="chart-period-label">Payments Received</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue ($)" fill="#3B82F6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Lab Tests */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h2>Top Lab Tests</h2>
            <FileText size={18} color="var(--text-muted)" />
          </div>
          {topTests.length === 0 ? (
            <div className="empty-chart">No lab data yet</div>
          ) : (
            <div className="top-tests-list">
              {topTests.map((test, idx) => {
                const maxCount = topTests[0].count;
                const pct = Math.round((test.count / maxCount) * 100);
                return (
                  <div key={idx} className="top-test-item">
                    <div className="test-info">
                      <span className="test-rank">#{idx + 1}</span>
                      <span className="test-name">{test.name}</span>
                    </div>
                    <div className="test-bar-wrap">
                      <div className="test-bar" style={{ width: `${pct}%`, background: COLORS[idx % COLORS.length] }}></div>
                    </div>
                    <span className="test-count">{test.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
