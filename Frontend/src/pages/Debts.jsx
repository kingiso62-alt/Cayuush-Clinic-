import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Edit, Trash2, CheckCircle, Calendar, 
  AlertCircle, AlertTriangle, Loader2, DollarSign, BellRing, Bell, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Debts.css';

const Debts = () => {
  const { user } = useAuth();
  const [debts, setDebts] = useState([]);
  const [filteredDebts, setFilteredDebts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDbMode, setIsDbMode] = useState(true);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Paid' | 'Overdue'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    patient_id: '',
    patient_name: '',
    amount: '',
    due_date: '',
    description: '',
    status: 'Pending'
  });

  const todayStr = new Date().toISOString().split('T')[0];

  const getMockDebts = () => {
    const saved = localStorage.getItem('cayush_mock_debts');
    if (saved) return JSON.parse(saved);
    
    const mock = [
      {
        id: 'mock-1',
        patient_id: '',
        patient_name: 'Maxamed Cali Nuur',
        amount: 150.00,
        due_date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], // 3 days ago (Overdue)
        description: 'Baaritaan guud iyo dawooyin farmashiye',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 'mock-2',
        patient_id: '',
        patient_name: 'Fadumo Axmed Cumar',
        amount: 85.50,
        due_date: todayStr, // Due today
        description: 'Qalliin yar iyo nadiifin nabar',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'mock-3',
        patient_id: '',
        patient_name: 'Cabdullaahi Yusuf Xasan',
        amount: 320.00,
        due_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], // 5 days from now
        description: 'Daaweynta ilkaha iyo xidid saarid',
        status: 'Pending',
        created_at: new Date().toISOString()
      },
      {
        id: 'mock-4',
        patient_id: '',
        patient_name: 'Aamina Cabdi Salaad',
        amount: 90.00,
        due_date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
        description: 'Laboratory blood tests',
        status: 'Paid',
        created_at: new Date(Date.now() - 86400000 * 12).toISOString()
      }
    ];
    localStorage.setItem('cayush_mock_debts', JSON.stringify(mock));
    return mock;
  };

  const fetchDebts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('Debts table not found in Supabase. Falling back to local storage.');
          setIsDbMode(false);
          const mockData = getMockDebts();
          setDebts(mockData);
          applyFilterAndSearch(mockData, searchTerm, statusFilter);
        } else {
          throw error;
        }
      } else {
        setIsDbMode(true);
        setDebts(data || []);
        applyFilterAndSearch(data || [], searchTerm, statusFilter);
      }
    } catch (err) {
      console.error('Error fetching debts:', err);
      setIsDbMode(false);
      const mockData = getMockDebts();
      setDebts(mockData);
      applyFilterAndSearch(mockData, searchTerm, statusFilter);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter]);

  const fetchPatients = async () => {
    try {
      const { data } = await supabase.from('patients').select('id, full_name').order('full_name');
      setPatients(data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  useEffect(() => {
    fetchDebts();
    fetchPatients();
  }, []);

  const applyFilterAndSearch = (data, search, status) => {
    let result = [...data];

    // Search
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(d => d.patient_name.toLowerCase().includes(term) || d.description?.toLowerCase().includes(term));
    }

    // Status Filter
    if (status !== 'All') {
      if (status === 'Pending') {
        result = result.filter(d => d.status === 'Pending');
      } else if (status === 'Paid') {
        result = result.filter(d => d.status === 'Paid');
      } else if (status === 'Overdue') {
        result = result.filter(d => d.status === 'Pending' && d.due_date < todayStr);
      }
    }

    setFilteredDebts(result);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    applyFilterAndSearch(debts, val, statusFilter);
  };

  const handleStatusFilterChange = (filter) => {
    setStatusFilter(filter);
    applyFilterAndSearch(debts, searchTerm, filter);
  };

  const isOverdue = (debt) => {
    return debt.status === 'Pending' && debt.due_date < todayStr;
  };

  const isDueToday = (debt) => {
    return debt.status === 'Pending' && debt.due_date === todayStr;
  };

  const openAddModal = () => {
    setFormData({
      id: '',
      patient_id: '',
      patient_name: '',
      amount: '',
      due_date: '',
      description: '',
      status: 'Pending'
    });
    setModalMode('add');
    setIsModalOpen(true);
  };

  const openEditModal = (debt) => {
    setFormData({
      id: debt.id,
      patient_id: debt.patient_id || '',
      patient_name: debt.patient_name,
      amount: debt.amount,
      due_date: debt.due_date,
      description: debt.description || '',
      status: debt.status
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handlePatientSelect = (e) => {
    const patientId = e.target.value;
    if (patientId) {
      const selected = patients.find(p => p.id === patientId);
      setFormData(prev => ({
        ...prev,
        patient_id: patientId,
        patient_name: selected ? selected.full_name : prev.patient_name
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        patient_id: '',
        patient_name: ''
      }));
    }
  };

  const syncDebtToInvoice = async (debtPayload) => {
    if (debtPayload.status !== 'Paid') return;
    try {
      // Find patient or fallback to creating invoice with null patient if not registered
      const patientId = debtPayload.patient_id;
      const amount = debtPayload.amount;
      const invoiceNumber = `INV-DEBT-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Create Invoice
      const { data: invoiceData, error: invoiceError } = await supabase.from('invoices').insert([{
        invoice_number: invoiceNumber,
        patient_id: patientId || null,
        subtotal: amount,
        total_amount: amount,
        amount_paid: amount,
        status: 'Paid',
        created_by: user?.id || null,
        notes: `Deyn bixinta: ${debtPayload.patient_name} - ${debtPayload.description || 'General Debt Clearance'}`
      }]).select();

      if (invoiceError) throw invoiceError;
      const createdInvoice = invoiceData[0];

      // 2. Add Item
      const { error: itemError } = await supabase.from('invoice_items').insert([{
        invoice_id: createdInvoice.id,
        item_description: `Deyn Bixinta: ${debtPayload.description || 'General Debt Clearance'}`,
        quantity: 1,
        unit_price: amount,
        total_price: amount
      }]);
      if (itemError) throw itemError;

      // 3. Add Payment
      const { error: paymentError } = await supabase.from('payments').insert([{
        invoice_id: createdInvoice.id,
        patient_id: patientId || null,
        amount: amount,
        payment_method: 'Cash',
        received_by: user?.id || null
      }]);
      if (paymentError) throw paymentError;

    } catch (err) {
      console.error('Error syncing debt to billing:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveDebt = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      patient_id: formData.patient_id || null,
      patient_name: formData.patient_name.trim(),
      amount: parseFloat(formData.amount),
      due_date: formData.due_date,
      description: formData.description.trim(),
      status: formData.status
    };

    try {
      if (isDbMode) {
        if (modalMode === 'add') {
          const { error } = await supabase.from('debts').insert([payload]);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('debts').update(payload).eq('id', formData.id);
          if (error) throw error;
        }
        // Auto-sync to billing if status changed to Paid
        if (payload.status === 'Paid') {
          await syncDebtToInvoice(payload);
        }
      } else {
        const currentDebts = getMockDebts();
        if (modalMode === 'add') {
          const newDebt = {
            ...payload,
            id: `mock-${Date.now()}`,
            created_at: new Date().toISOString()
          };
          const updated = [newDebt, ...currentDebts];
          localStorage.setItem('cayush_mock_debts', JSON.stringify(updated));
        } else {
          const updated = currentDebts.map(d => d.id === formData.id ? { ...d, ...payload } : d);
          localStorage.setItem('cayush_mock_debts', JSON.stringify(updated));
        }
      }
      setIsModalOpen(false);
      fetchDebts();
    } catch (err) {
      console.error(err);
      alert('Ma badbaadin karin deynta: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePaid = async (debt) => {
    const newStatus = debt.status === 'Paid' ? 'Pending' : 'Paid';
    try {
      if (isDbMode) {
        const { error } = await supabase.from('debts').update({ status: newStatus }).eq('id', debt.id);
        if (error) throw error;
        if (newStatus === 'Paid') {
          await syncDebtToInvoice({ ...debt, status: newStatus });
        }
      } else {
        const currentDebts = getMockDebts();
        const updated = currentDebts.map(d => d.id === debt.id ? { ...d, status: newStatus } : d);
        localStorage.setItem('cayush_mock_debts', JSON.stringify(updated));
      }
      fetchDebts();
    } catch (err) {
      console.error(err);
      alert('Failed to toggle status');
    }
  };

  const handleDeleteDebt = async (id, name) => {
    if (window.confirm(`Ma hubtaa inaad tirtirto deynta qofka: ${name}?`)) {
      try {
        if (isDbMode) {
          const { error } = await supabase.from('debts').delete().eq('id', id);
          if (error) throw error;
        } else {
          const currentDebts = getMockDebts();
          const updated = currentDebts.filter(d => d.id !== id);
          localStorage.setItem('cayush_mock_debts', JSON.stringify(updated));
        }
        fetchDebts();
      } catch (err) {
        console.error(err);
        alert('Failed to delete debt record.');
      }
    }
  };

  const totalOutstanding = debts
    .filter(d => d.status === 'Pending')
    .reduce((sum, d) => sum + parseFloat(d.amount), 0);

  const collectedAmount = debts
    .filter(d => d.status === 'Paid')
    .reduce((sum, d) => sum + parseFloat(d.amount), 0);

  const overdueCount = debts.filter(d => isOverdue(d)).length;
  const dueTodayCount = debts.filter(d => isDueToday(d)).length;

  return (
    <div className="debts-page">
      {!isDbMode && (
        <div className="db-fallback-banner">
          <AlertTriangle size={16} />
          <span>Ka digtooni: Table-ka "debts" kuma jiro Supabase. Nidaamku wuxuu hadda ku jiraa LocalStorage. Fadlan ku shub <code>phase6_debts.sql</code> Supabase SQL Editor-kaaga.</span>
        </div>
      )}

      <div className="debts-header">
        <div className="debts-header-left">
          <h2>Maamulka Deymaha (Debts Management)</h2>
          <p className="breadcrumb-path">Dashboard / Deymaha</p>
        </div>
        <button className="add-debt-btn" onClick={openAddModal}>
          <Plus size={16} /> Diiwaangeli Deyn
        </button>
      </div>

      <div className="debts-kpi-ribbon">
        <div className="kpi-mini-card">
          <div className="card-top">
            <div className="icon-badge bg-orange">
              <DollarSign size={18} />
            </div>
            <div className="kpi-text">
              <span className="label">Deymaha Maqan</span>
              <h3>${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
          </div>
          <div className="card-trend text-orange">
            <span>Outstanding Debt</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="card-top">
            <div className="icon-badge bg-red pulse-alarm">
              <BellRing size={18} />
            </div>
            <div className="kpi-text">
              <span className="label">Deymo Dhaafay (Overdue)</span>
              <h3>{overdueCount}</h3>
            </div>
          </div>
          <div className="card-trend text-red">
            <span>Action Required</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="card-top">
            <div className="icon-badge bg-yellow">
              <Bell size={18} />
            </div>
            <div className="kpi-text">
              <span className="label">Maanta Ku Beegan</span>
              <h3>{dueTodayCount}</h3>
            </div>
          </div>
          <div className="card-trend text-yellow">
            <span>Due Today</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="card-top">
            <div className="icon-badge bg-green">
              <CheckCircle size={18} />
            </div>
            <div className="kpi-text">
              <span className="label">Deymo La Bixiyey</span>
              <h3>${collectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
          </div>
          <div className="card-trend text-green">
            <span>Collected Revenue</span>
          </div>
        </div>
      </div>

      <div className="debts-toolbar">
        <div className="debts-filters">
          <button className={`filter-tab ${statusFilter === 'All' ? 'active' : ''}`} onClick={() => handleStatusFilterChange('All')}>Dhammaan ({debts.length})</button>
          <button className={`filter-tab ${statusFilter === 'Pending' ? 'active' : ''}`} onClick={() => handleStatusFilterChange('Pending')}>Maqan ({debts.filter(d=>d.status==='Pending').length})</button>
          <button className={`filter-tab ${statusFilter === 'Overdue' ? 'active' : ''}`} onClick={() => handleStatusFilterChange('Overdue')}>Xilligii Dhaafay ({debts.filter(d=>isOverdue(d)).length})</button>
          <button className={`filter-tab ${statusFilter === 'Paid' ? 'active' : ''}`} onClick={() => handleStatusFilterChange('Paid')}>La Bixiyey ({debts.filter(d=>d.status==='Paid').length})</button>
        </div>

        <div className="debts-search-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Raadi magaca bukaanka..." 
            value={searchTerm} 
            onChange={handleSearchChange} 
          />
        </div>
      </div>

      {isLoading ? (
        <div className="debts-loading-container">
          <Loader2 className="spinner animate-spin" size={32} />
          <p>Loading debts catalog...</p>
        </div>
      ) : (
        <div className="debts-list-container">
          <div className="debts-table-header">
            <div className="header-cell col-patient">Bukaanka (Patient)</div>
            <div className="header-cell col-amount">Lacagta (Amount)</div>
            <div className="header-cell col-due">Maalinta Bixinta (Due Date)</div>
            <div className="header-cell col-desc">Faahfaahin (Description)</div>
            <div className="header-cell col-status">Xaaladda (Status)</div>
            <div className="header-cell col-actions">Shaqooyinka</div>
          </div>

          <div className="debts-rows-stack">
            {filteredDebts.map((debt) => {
              const overdue = isOverdue(debt);
              const dueToday = isDueToday(debt);

              return (
                <div key={debt.id} className={`debts-list-row ${debt.status === 'Paid' ? 'paid-row' : ''} ${overdue ? 'overdue-row' : ''} ${dueToday ? 'due-today-row' : ''}`}>
                  <div className="row-cell col-patient">
                    <span className="patient-name-span">{debt.patient_name}</span>
                    {overdue && <span className="alert-badge text-red"><AlertCircle size={12} /> Overdue!</span>}
                    {dueToday && <span className="alert-badge text-yellow"><AlertTriangle size={12} /> Today</span>}
                  </div>

                  <div className="row-cell col-amount">
                    <strong className="amount-text">${parseFloat(debt.amount).toFixed(2)}</strong>
                  </div>

                  <div className="row-cell col-due">
                    <div className="due-date-wrapper">
                      <Calendar size={14} className="text-muted" />
                      <span>{new Date(debt.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <div className="row-cell col-desc text-muted">
                    {debt.description || 'No description provided.'}
                  </div>

                  <div className="row-cell col-status">
                    <span className={`status-pill ${debt.status.toLowerCase()}`} onClick={() => handleTogglePaid(debt)} title="Click to toggle status">
                      {debt.status}
                    </span>
                  </div>

                  <div className="row-cell col-actions">
                    <button className="action-circular-btn edit" onClick={() => openEditModal(debt)} title="Edit Debt Details">
                      <Edit size={14} />
                    </button>
                    <button className="action-circular-btn delete" onClick={() => handleDeleteDebt(debt.id, debt.patient_name)} title="Delete Debt Log">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredDebts.length === 0 && (
              <div className="debts-empty-state">
                <Bell size={36} />
                <p>Majiraan deymo ku qoran liiskan.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? 'Diiwaangeli Deyn Cusub' : 'Wax ka beddel Deynta'}</h2>
              <button type="button" className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveDebt} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
                {modalMode === 'add' && (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>Dooro Bukaanka (Haddii uu diiwaangashan yahay)</label>
                    <select className="premium-input" onChange={handlePatientSelect}>
                      <option value="">-- Doorasho kale (Walk-in / Kale) --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Magaca Bukaanka (Patient Name) *</label>
                  <input 
                    type="text" 
                    className="premium-input" 
                    name="patient_name" 
                    required 
                    value={formData.patient_name} 
                    onChange={handleInputChange} 
                    placeholder="Geli magaca bukaanka"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Lacagta Deynta ($ Amount) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="premium-input" 
                    name="amount" 
                    required 
                    value={formData.amount} 
                    onChange={handleInputChange} 
                    placeholder="Geli inta lacag ah e.g. 150.00"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Maalinta Bixinta (Due Date) *</label>
                  <input 
                    type="date" 
                    className="premium-input" 
                    name="due_date" 
                    required 
                    value={formData.due_date} 
                    onChange={handleInputChange} 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Faahfaahin / Notes</label>
                  <textarea 
                    className="premium-input" 
                    name="description" 
                    rows={3}
                    value={formData.description} 
                    onChange={handleInputChange} 
                    placeholder="Sababta deynta loo qaatay..."
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Xaaladda Deynta (Status) *</label>
                  <select 
                    className="premium-input" 
                    name="status" 
                    required 
                    value={formData.status} 
                    onChange={handleInputChange}
                  >
                    <option value="Pending">Pending (Maqan)</option>
                    <option value="Paid">Paid (La Bixiyey)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="premium-btn-outline" onClick={() => setIsModalOpen(false)}>Ka noqo</button>
                <button type="submit" className="premium-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Kaydinaya...' : (modalMode === 'add' ? 'Diiwaangeli' : 'Kaydi Isbeddelka')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Debts;
