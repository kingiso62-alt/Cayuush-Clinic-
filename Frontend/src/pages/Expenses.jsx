import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { DollarSign, Trash2, Calendar, TrendingDown, ClipboardList, Search } from 'lucide-react';
import './Expenses.css';

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [invoicesSum, setInvoicesSum] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'Rent',
    amount: '',
    description: ''
  });

  useEffect(() => {
    fetchExpenses();
    fetchRevenue();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
    setExpenses(data || []);
    setIsLoading(false);
  };

  const fetchRevenue = async () => {
    const { data } = await supabase.from('payments').select('amount');
    const totalRev = data?.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0) || 0;
    setInvoicesSum(totalRev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('expenses').insert([{
      ...formData,
      amount: parseFloat(formData.amount),
      recorded_by: user.id
    }]);

    if (!error) {
      setFormData({
        expense_date: new Date().toISOString().split('T')[0],
        category: 'Rent',
        amount: '',
        description: ''
      });
      fetchExpenses();
    } else {
      alert('Failed to record expense: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Ma hubtaa inaad tirtirto kharashkan?')) {
      await supabase.from('expenses').delete().eq('id', id);
      fetchExpenses();
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  const netProfit    = invoicesSum - totalExpense;

  const expensePct = invoicesSum > 0 ? Math.min(Math.round((totalExpense / invoicesSum) * 100), 100) : 0;
  const netPct = invoicesSum > 0 ? Math.max(0, Math.round((netProfit / invoicesSum) * 100)) : 0;

  const filteredExpenses = expenses.filter(exp => 
    exp.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryClass = (cat) => {
    const c = cat.toLowerCase();
    if (c.includes('rent')) return 'rent';
    if (c.includes('util')) return 'utilities';
    if (c.includes('salar')) return 'salaries';
    if (c.includes('suppl')) return 'supplies';
    if (c.includes('market')) return 'marketing';
    return 'other';
  };

  return (
    <div className="exp-container">
      {/* Header */}
      <div className="exp-header">
        <h1>💸 Expenses &amp; Finance Manager</h1>
        <p>Maamulka kharashyada iyo xisaabinta dakhliga safiga ah ee Cayush Hospital</p>
      </div>

      {/* KPI stats */}
      <div className="exp-stats-ribbon">
        <div className="exp-stat-card">
          <span className="exp-stat-label" style={{ color: 'var(--accent-green)' }}>Dakhliga Guud (Revenue)</span>
          <div className="exp-stat-val" style={{ color: 'var(--accent-green)' }}>${invoicesSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="exp-stat-progress-wrap">
            <div className="exp-stat-progress-bar">
              <div className="exp-stat-progress-fill" style={{ width: '100%', background: 'var(--accent-green)' }}></div>
            </div>
            <div className="exp-stat-progress-text">
              <span>Gross Income</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="exp-stat-card">
          <span className="exp-stat-label" style={{ color: 'var(--accent-red)' }}>Wadarta Kharashka (Expenses)</span>
          <div className="exp-stat-val" style={{ color: 'var(--accent-red)' }}>${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="exp-stat-progress-wrap">
            <div className="exp-stat-progress-bar">
              <div className="exp-stat-progress-fill" style={{ width: `${expensePct}%`, background: 'var(--accent-red)' }}></div>
            </div>
            <div className="exp-stat-progress-text">
              <span>Expenses share of Revenue</span>
              <span>{expensePct}%</span>
            </div>
          </div>
        </div>

        <div className="exp-stat-card">
          <span className="exp-stat-label" style={{ color: 'var(--primary-brand)' }}>Dakhliga Safi (Net Profit)</span>
          <div className="exp-stat-val" style={{ color: netProfit >= 0 ? 'var(--primary-brand)' : 'var(--accent-red)' }}>${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="exp-stat-progress-wrap">
            <div className="exp-stat-progress-bar">
              <div className="exp-stat-progress-fill" style={{ width: `${netPct}%`, background: 'var(--primary-brand)' }}></div>
            </div>
            <div className="exp-stat-progress-text">
              <span>Net profit margin</span>
              <span>{netPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="exp-grid">
        {/* Record Form */}
        <div className="exp-panel-card">
          <h3>Diiwaangeli Kharash Cusub</h3>
          <form onSubmit={handleSubmit} className="exp-form">
            <div className="exp-field">
              <label>Taariikhda / Date *</label>
              <input type="date" required value={formData.expense_date} onChange={e => setFormData({ ...formData, expense_date: e.target.value })} />
            </div>
            <div className="exp-field">
              <label>Qaybta Kharashka / Category *</label>
              <select required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option>Rent</option>
                <option>Utilities (Koronto &amp; Biyo)</option>
                <option>Salaries (Mushaharka)</option>
                <option>Medical Supplies (Agab Caafimaad)</option>
                <option>Marketing</option>
                <option>Other</option>
              </select>
            </div>
            <div className="exp-field">
              <label>Lacagta / Amount ($) *</label>
              <input type="number" step="0.01" placeholder="0.00" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
            </div>
            <div className="exp-field">
              <label>Faahfaahin / Description</label>
              <textarea placeholder="Qor kharashku wuxuu ahaa..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <button type="submit" className="premium-btn" style={{ width: '100%', marginTop: '10px' }}>➕ Save Expense</button>
          </form>
        </div>

        {/* List Table */}
        <div className="exp-panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Diiwaanka Kharashyada</h3>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', width: '260px' }}>
              <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
              <input 
                type="text" 
                placeholder="Raadi kharash ama qayb..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-main)', width: '100%', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <div className="exp-table-wrap">
            {isLoading ? <p style={{ color: 'var(--text-muted)' }}>Loading expenses...</p> : (
              <table className="exp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ width: '60px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td>{new Date(exp.expense_date).toLocaleDateString()}</td>
                      <td><span className={`exp-cat-badge ${getCategoryClass(exp.category)}`}>{exp.category}</span></td>
                      <td>{exp.description || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--accent-red)' }}>${parseFloat(exp.amount).toFixed(2)}</td>
                      <td>
                        <button onClick={() => handleDelete(exp.id)} className="exp-action-btn" title="Tirtir">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Muu jiro wax kharash ah oo la qoray.</td>
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

export default Expenses;
