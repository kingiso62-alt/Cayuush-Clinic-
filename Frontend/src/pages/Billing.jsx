import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, FileText, Download, CheckCircle, Clock, X, DollarSign, Printer, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Billing.css';

const Billing = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Printable receipt state
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [receiptItems, setReceiptItems] = useState([]);
  const [receiptPayments, setReceiptPayments] = useState([]);

  const [patients, setPatients] = useState([]);
  
  // New Invoice State
  const [newInvoice, setNewInvoice] = useState({
    patient_id: '',
    notes: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }]
  });

  // Payment State
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'Cash',
    transaction_ref: ''
  });

  const { user } = useAuth();

  useEffect(() => {
    fetchInvoices();
    fetchPatients();
  }, []);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invError) throw invError;

      const { data: patientsList } = await supabase.from('patients').select('id, full_name, patient_id, phone');
      const patMap = patientsList ? Object.fromEntries(patientsList.map(p => [p.id, p])) : {};

      const formatted = (invData || []).map(inv => ({
        ...inv,
        patients: inv.patient_id ? patMap[inv.patient_id] : { 
          full_name: inv.notes?.includes('Deyn bixinta:') 
            ? inv.notes.split('Deyn bixinta:')[1].split(' - ')[0].trim() 
            : 'Walk-in Patient', 
          patient_id: 'N/A' 
        }
      }));

      setInvoices(formatted);
      setFilteredInvoices(formatted);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase.from('patients').select('id, full_name, patient_id').order('full_name');
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    const filtered = invoices.filter(inv => 
      inv.invoice_number?.toLowerCase().includes(term) || 
      inv.patients?.full_name?.toLowerCase().includes(term) ||
      inv.status?.toLowerCase().includes(term)
    );
    setFilteredInvoices(filtered);
  };

  // Invoice Item Handlers
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...newInvoice.items];
    updatedItems[index][field] = value;
    setNewInvoice({ ...newInvoice, items: updatedItems });
  };

  const addItemRow = () => {
    setNewInvoice({
      ...newInvoice,
      items: [...newInvoice.items, { description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const removeItemRow = (index) => {
    const updatedItems = newInvoice.items.filter((_, i) => i !== index);
    setNewInvoice({ ...newInvoice, items: updatedItems });
  };

  const calculateSubtotal = () => {
    return newInvoice.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const subtotal = calculateSubtotal();
      const invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Create Invoice
      const { data: invoiceData, error: invoiceError } = await supabase.from('invoices').insert([{
        invoice_number: invoiceNumber,
        patient_id: newInvoice.patient_id,
        subtotal: subtotal,
        total_amount: subtotal, // Assuming no tax/discount for now
        created_by: user.id,
        notes: newInvoice.notes
      }]).select();

      if (invoiceError) throw invoiceError;

      const createdInvoice = invoiceData[0];

      // 2. Add Invoice Items
      const itemsToInsert = newInvoice.items.map(item => ({
        invoice_id: createdInvoice.id,
        item_description: item.description,
        quantity: parseInt(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseInt(item.quantity) * parseFloat(item.unit_price)
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      setIsModalOpen(false);
      setNewInvoice({ patient_id: '', notes: '', items: [{ description: '', quantity: 1, unit_price: 0 }] });
      fetchInvoices(); // Refresh
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    const balance = invoice.total_amount - invoice.amount_paid;
    setPaymentData({ amount: balance, payment_method: 'Cash', transaction_ref: '' });
    setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('payments').insert([{
        invoice_id: selectedInvoice.id,
        patient_id: selectedInvoice.patient_id,
        amount: parseFloat(paymentData.amount),
        payment_method: paymentData.payment_method,
        transaction_ref: paymentData.transaction_ref,
        received_by: user.id
      }]);

      if (error) throw error;
      
      setIsPaymentModalOpen(false);
      fetchInvoices(); // Refresh (trigger will automatically update invoice status & amount)
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReceipt = async (invoice) => {
    setSelectedInvoice(invoice);
    setIsReceiptOpen(true);
    setLoadingReceipt(true);
    try {
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);
      
      if (itemsError) throw itemsError;
      setReceiptItems(items || []);

      const { data: pmts, error: pmtsError } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('payment_date', { ascending: true });

      if (pmtsError) throw pmtsError;
      setReceiptPayments(pmts || []);

    } catch (err) {
      console.error('Error fetching receipt items or payments:', err);
      setReceiptItems([
        { item_description: 'General OPD Services', quantity: 1, unit_price: invoice.total_amount, total_price: invoice.total_amount }
      ]);
      setReceiptPayments([]);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const printReceipt = (invoice, items, payments = []) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;">${item.item_description}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 0.9rem;">${item.quantity}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 0.9rem;">$${parseFloat(item.unit_price).toFixed(2)}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 0.9rem; color: #1a1a1a;">$${parseFloat(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('');

    const paymentsHtml = payments.length > 0 ? payments.map(p => `
      <tr style="font-size: 0.85rem; color: #475569;">
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${new Date(p.payment_date).toLocaleString()}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${p.payment_method || 'Cash'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #10b981;">$${parseFloat(p.amount).toFixed(2)}</td>
      </tr>
    `).join('') : `<tr><td colspan="3" style="text-align: center; padding: 10px; color: #94a3b8; font-size: 0.85rem;">No payments made yet.</td></tr>`;

    const balance = parseFloat(invoice.total_amount) - parseFloat(invoice.amount_paid);
    const statusText = invoice.status === 'Paid' ? 'PAID / WAAY DOONAY' : invoice.status === 'Partial' ? 'PARTIAL / QAAR DOONAY' : 'UNPAID / MA DOONAN';
    const statusColor = invoice.status === 'Paid' ? '#10b981' : invoice.status === 'Partial' ? '#f59e0b' : '#ef4444';
    const statusBg = invoice.status === 'Paid' ? 'rgba(16,185,129,0.08)' : invoice.status === 'Partial' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${invoice.invoice_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; color: #334155; margin: 40px; line-height: 1.6; background-color: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #b01d5d; padding-bottom: 24px; margin-bottom: 30px; }
            .clinic-details h1 { margin: 0; font-size: 26px; color: #800000; font-weight: 800; }
            .clinic-details p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
            .invoice-title { text-align: right; }
            .invoice-title h2 { margin: 0; font-size: 22px; color: #b01d5d; font-weight: 800; letter-spacing: 1px; }
            .invoice-title p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
            .meta-grid { display: flex; gap: 30px; margin-bottom: 35px; }
            .meta-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
            .meta-box h3 { margin: 0 0 12px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #005f54; letter-spacing: 0.5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; }
            .meta-box p { margin: 6px 0; font-size: 13.5px; color: #334155; }
            .meta-box p strong { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 35px; }
            th { background-color: #005f54; color: #ffffff; padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; text-align: left; letter-spacing: 0.5px; }
            .summary { margin-left: auto; width: 340px; margin-top: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13.5px; color: #475569; }
            .summary-row.total { font-weight: 800; font-size: 16px; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 8px; color: #0f172a; }
            .stamp { display: inline-block; border: 2px solid ${statusColor}; background: ${statusBg}; color: ${statusColor}; font-weight: 800; padding: 6px 14px; border-radius: 8px; font-size: 13px; text-transform: uppercase; margin-top: 10px; letter-spacing: 0.5px; }
            .footer { text-align: center; margin-top: 80px; font-size: 12px; color: #94a3b8; border-top: 2px dashed #e2e8f0; padding-top: 24px; }
            .qr-code { width: 70px; height: 70px; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-details">
              <h1>CAYUUSH CLINIC & HOSPITAL</h1>
              <p>Ex-control Afgoye, Mogadishu · Tel: +252 61 9639994 · info@cayushclinic.com</p>
            </div>
            <div class="invoice-title">
              <h2>INVOICE</h2>
              <p>No: <strong>${invoice.invoice_number}</strong></p>
              <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${invoice.invoice_number}&color=005f54&bgcolor=ffffff" alt="QR" />
            </div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-box">
              <h3>Patient Info / Macmiilka</h3>
              <p><strong>Name:</strong> ${invoice.patients?.full_name}</p>
              <p><strong>Patient ID:</strong> ${invoice.patients?.patient_id}</p>
              <p><strong>Phone:</strong> ${invoice.patients?.phone || 'N/A'}</p>
            </div>
            <div class="meta-box">
              <h3>Payment Status / Xaalada</h3>
              <p><strong>Date Issued:</strong> ${new Date(invoice.issue_date).toLocaleDateString()}</p>
              <p><strong>Status:</strong> <span class="stamp">${statusText}</span></p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description / Adeegga</th>
                <th style="text-align: center; width: 60px;">Qty</th>
                <th style="text-align: right; width: 120px;">Unit Price</th>
                <th style="text-align: right; width: 120px;">Total Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row">
              <span>Subtotal:</span>
              <span style="font-weight: 600;">$${parseFloat(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div class="summary-row" style="color: #10b981;">
              <span>Amount Paid / Lacagta La Bixiyey:</span>
              <span style="font-weight: 600;">$${parseFloat(invoice.amount_paid).toFixed(2)}</span>
            </div>
            <div class="summary-row total" style="color: ${balance > 0 ? '#ef4444' : '#0f172a'};">
              <span>Balance Due / Lacagta Dhiman:</span>
              <span>$${balance.toFixed(2)}</span>
            </div>
          </div>

          <!-- Payment History Section -->
          <div style="margin-top: 20px;">
            <h3 style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #005f54; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; margin-bottom: 10px; letter-spacing: 0.5px;">
              Payment History / Lacag-bixinta
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #334155; font-size: 11px;">
                  <th style="padding: 8px 12px; text-align: left; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; color: #334155;">Date / Time</th>
                  <th style="padding: 8px 12px; text-align: left; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; color: #334155;">Method</th>
                  <th style="padding: 8px 12px; text-align: right; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; color: #334155;">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Mahadsanid / Thank you for choosing Cayuush Clinic & Hospital.</p>
            <p>This is a certified digital printout from Cayush Clinic Management System.</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const stats = {
    totalRevenue: invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0),
    pendingAmount: invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) - parseFloat(inv.amount_paid || 0)), 0),
    unpaidCount: invoices.filter(i => i.status === 'Unpaid').length,
    paidCount: invoices.filter(i => i.status === 'Paid').length,
  };

  return (
    <div className="page-layout">
      <div className="page-header">
        <div className="page-title">
          <h1>Billing & Payments</h1>
          <p>Manage patient invoices and process payments</p>
        </div>
        <button className="premium-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Create Invoice
        </button>
      </div>

      {/* KPI Cards */}
      <div className="billing-stats-row">
        <div className="billing-stat-card">
          <div className="billing-icon-box bg-green"><DollarSign size={24} /></div>
          <div className="billing-stat-info">
            <p>Total Revenue</p>
            <h3>${stats.totalRevenue.toFixed(2)}</h3>
          </div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-icon-box bg-orange"><Clock size={24} /></div>
          <div className="billing-stat-info">
            <p>Pending Amount</p>
            <h3>${stats.pendingAmount.toFixed(2)}</h3>
          </div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-icon-box bg-blue"><FileText size={24} /></div>
          <div className="billing-stat-info">
            <p>Unpaid Invoices</p>
            <h3>{stats.unpaidCount}</h3>
          </div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-icon-box bg-slate"><CheckCircle size={24} /></div>
          <div className="billing-stat-info">
            <p>Paid Invoices</p>
            <h3>{stats.paidCount}</h3>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-filter-group">
          <div className="search-bar">
            <Search size={16} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search invoice #, patient..." 
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <button className="filter-btn">
            <Filter size={16} /> Filter
          </button>
        </div>
        <button className="premium-btn-outline">
          <Download size={16} /> Export
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <div style={{display: 'flex', justifyContent: 'center', padding: '60px'}}>
            <div className="spinner"></div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => {
                const balance = parseFloat(inv.total_amount) - parseFloat(inv.amount_paid);
                return (
                  <tr key={inv.id}>
                    <td style={{fontWeight: '600', color: 'var(--text-main)'}}>{inv.invoice_number}</td>
                    <td>
                      <div style={{fontWeight: '500'}}>{inv.patients?.full_name}</div>
                      <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{inv.patients?.patient_id}</div>
                    </td>
                    <td>{new Date(inv.issue_date).toLocaleDateString()}</td>
                    <td style={{fontWeight: '600'}}>${parseFloat(inv.total_amount).toFixed(2)}</td>
                    <td style={{color: balance > 0 ? 'var(--accent-red)' : 'var(--text-muted)'}}>
                      ${balance.toFixed(2)}
                    </td>
                    <td>
                      <span className={`status-badge ${
                        inv.status === 'Paid' ? 'success' :
                        inv.status === 'Partial' ? 'warning' : 'danger'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        {inv.status !== 'Paid' && (
                          <button className="premium-btn" style={{padding: '6px 12px', fontSize: '0.8rem'}} onClick={() => openPaymentModal(inv)}>
                            Pay
                          </button>
                        )}
                        <button className="premium-btn-outline" style={{padding: '6px', border: 'none'}} onClick={() => handleOpenReceipt(inv)} title="Print Receipt">
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan="7" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Invoice Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{maxWidth: '800px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Invoice</h2>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{overflowY: 'auto'}}>
              <form onSubmit={handleCreateInvoice}>
                <div className="form-group" style={{marginBottom: '24px'}}>
                  <label>Select Patient *</label>
                  <select className="premium-input" required value={newInvoice.patient_id} onChange={e => setNewInvoice({...newInvoice, patient_id: e.target.value})}>
                    <option value="" disabled>-- Select Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id})</option>
                    ))}
                  </select>
                </div>

                <div className="invoice-items-section">
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                    <h3 style={{fontSize: '1.1rem', color: 'var(--text-main)'}}>Invoice Items</h3>
                    <button type="button" className="premium-btn-outline" style={{padding: '6px 12px', fontSize: '0.85rem'}} onClick={addItemRow}>
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                  
                  {newInvoice.items.map((item, index) => (
                    <div key={index} style={{display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start'}}>
                      <div style={{flex: 3}}>
                        <input 
                          type="text" 
                          className="premium-input" 
                          placeholder="Description (e.g. Consultation)" 
                          required 
                          value={item.description}
                          onChange={e => handleItemChange(index, 'description', e.target.value)}
                        />
                      </div>
                      <div style={{flex: 1}}>
                        <input 
                          type="number" 
                          className="premium-input" 
                          placeholder="Qty" 
                          min="1"
                          required 
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                        />
                      </div>
                      <div style={{flex: 1.5}}>
                        <input 
                          type="number" 
                          step="0.01"
                          className="premium-input" 
                          placeholder="Price ($)" 
                          required 
                          value={item.unit_price}
                          onChange={e => handleItemChange(index, 'unit_price', e.target.value)}
                        />
                      </div>
                      <div style={{flex: 1, display: 'flex', alignItems: 'center', height: '44px', fontWeight: '600'}}>
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                      {index > 0 && (
                        <button type="button" className="close-modal-btn" style={{color: 'var(--accent-red)'}} onClick={() => removeItemRow(index)}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px', padding: '16px 0', borderTop: '1px solid var(--border-color)'}}>
                    <div style={{textAlign: 'right', fontSize: '1.2rem'}}>
                      <span style={{color: 'var(--text-muted)', marginRight: '16px'}}>Subtotal:</span>
                      <span style={{fontWeight: '700', color: 'var(--text-main)'}}>${calculateSubtotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{marginTop: '16px'}}>
                  <label>Notes (Optional)</label>
                  <textarea className="premium-input" rows="2" value={newInvoice.notes} onChange={e => setNewInvoice({...newInvoice, notes: e.target.value})}></textarea>
                </div>

                <div className="modal-footer" style={{marginTop: '24px'}}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting || !newInvoice.patient_id}>
                    {isSubmitting ? 'Creating...' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-content" style={{maxWidth: '450px', height: 'auto', display: 'block', margin: 'auto', borderRadius: '20px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Receive Payment</h2>
              <button className="close-modal-btn" onClick={() => setIsPaymentModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{background: 'var(--bg-hover)', padding: '16px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center'}}>
                <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px'}}>Invoice Balance</p>
                <h2 style={{fontSize: '2rem', color: 'var(--accent-red)'}}>${(selectedInvoice.total_amount - selectedInvoice.amount_paid).toFixed(2)}</h2>
              </div>
              
              <form onSubmit={handleProcessPayment}>
                <div className="form-group">
                  <label>Amount to Pay ($) *</label>
                  <input type="number" step="0.01" className="premium-input" required max={selectedInvoice.total_amount - selectedInvoice.amount_paid} value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} />
                </div>
                <div className="form-group" style={{marginTop: '16px'}}>
                  <label>Payment Method *</label>
                  <select className="premium-input" required value={paymentData.payment_method} onChange={e => setPaymentData({...paymentData, payment_method: e.target.value})}>
                    <option>Cash</option>
                    <option>Card</option>
                    <option>Mobile Money</option>
                    <option>Bank Transfer</option>
                  </select>
                </div>
                <div className="form-group" style={{marginTop: '16px'}}>
                  <label>Transaction Reference (Optional)</label>
                  <input type="text" className="premium-input" placeholder="e.g. EvcPlus #..." value={paymentData.transaction_ref} onChange={e => setPaymentData({...paymentData, transaction_ref: e.target.value})} />
                </div>
                <div className="modal-footer" style={{marginTop: '32px'}}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting || paymentData.amount <= 0}>
                    {isSubmitting ? 'Processing...' : 'Process Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {isReceiptOpen && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setIsReceiptOpen(false)}>
          <div className="modal-content" style={{maxWidth: '600px', height: 'auto', display: 'block', margin: 'auto', borderRadius: '20px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Receipt Preview - {selectedInvoice.invoice_number}</h2>
              <button className="close-modal-btn" onClick={() => setIsReceiptOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {loadingReceipt ? (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px'}}>
                  <Loader2 className="spinner animate-spin" size={32} color="var(--primary-brand)" />
                  <p style={{marginTop: '10px', color: 'var(--text-muted)'}}>Loading receipt items...</p>
                </div>
              ) : (
                <div className="receipt-paper" style={{background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', fontSize: '0.9rem'}}>
                  <div style={{textAlign: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '16px', marginBottom: '16px'}}>
                    <h3 style={{margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', letterSpacing: '0.5px'}}>CAYUUSH CLINIC & HOSPITAL</h3>
                    <p style={{margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)'}}>Mogadishu, Somalia · Tel: +252 61 000 0000</p>
                  </div>
                  
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.82rem'}}>
                    <div>
                      <span style={{color: 'var(--text-muted)'}}>Bukaanka / Patient:</span><br />
                      <strong>{selectedInvoice.patients?.full_name}</strong><br />
                      ID: {selectedInvoice.patients?.patient_id}
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <span style={{color: 'var(--text-muted)'}}>Taariikhda / Date:</span><br />
                      <strong>{new Date(selectedInvoice.issue_date).toLocaleDateString()}</strong><br />
                      Status: <span className={`status-badge ${selectedInvoice.status === 'Paid' ? 'success' : 'warning'}`} style={{padding: '2px 8px', fontSize: '0.7rem'}}>{selectedInvoice.status}</span>
                    </div>
                  </div>

                  <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px'}}>
                    <thead>
                      <tr style={{borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                        <th style={{textAlign: 'left', padding: '8px 0'}}>Item / Adeegga</th>
                        <th style={{textAlign: 'center', padding: '8px 0'}}>Qty</th>
                        <th style={{textAlign: 'right', padding: '8px 0'}}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptItems.map((item, i) => (
                        <tr key={i} style={{borderBottom: '1px solid rgba(0,0,0,0.03)', fontSize: '0.85rem'}}>
                          <td style={{padding: '10px 0'}}>{item.item_description}</td>
                          <td style={{textAlign: 'center', padding: '10px 0'}}>{item.quantity}</td>
                          <td style={{textAlign: 'right', padding: '10px 0', fontWeight: '600'}}>${parseFloat(item.total_price).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{borderTop: '1px dashed var(--border-color)', paddingTop: '12px', fontSize: '0.88rem'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '4px 0'}}>
                      <span style={{color: 'var(--text-muted)'}}>Subtotal:</span>
                      <span>${parseFloat(selectedInvoice.subtotal).toFixed(2)}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--primary-brand)'}}>
                      <span>Paid / Lacagta la bixiyey:</span>
                      <strong>${parseFloat(selectedInvoice.amount_paid).toFixed(2)}</strong>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', marginTop: '8px'}}>
                      <strong>Balance / Dhiman:</strong>
                      <strong style={{color: (selectedInvoice.total_amount - selectedInvoice.amount_paid) > 0 ? 'var(--accent-red)' : 'var(--text-main)'}}>
                        ${(selectedInvoice.total_amount - selectedInvoice.amount_paid).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', paddingBottom: 0}}>
                <button type="button" className="premium-btn-outline" onClick={() => setIsReceiptOpen(false)}>Close</button>
                <button type="button" className="premium-btn" onClick={() => printReceipt(selectedInvoice, receiptItems, receiptPayments)} disabled={loadingReceipt}>
                  <Printer size={16} style={{marginRight: '6px'}} /> Print Receipt / Daabac Boonada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// SVG Icon Helpers to avoid missing lucide imports
const Trash2 = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;

export default Billing;
