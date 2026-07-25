import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, Loader2, CheckCircle, Clock, Trash2, Edit,
  ShieldAlert, Eye, TrendingUp, DollarSign, Package,
  FileText, X, Check, Truck, ListCollapse
} from 'lucide-react';
import './Procurement.css';

const Procurement = () => {
  const { user } = { id: 'd03b0185-3b95-46c5-8461-12c8ff46a2a0' }; // fallback or context user
  
  // Lists
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [grns, setGrns] = useState([]);
  const [medicines, setMedicines] = useState([]);
  
  // UI / Loading
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers', 'pos', 'receiving', 'reports'
  
  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedPo, setSelectedPo] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form States
  const [supplierForm, setSupplierForm] = useState({
    name: '', contact_person: '', phone: '', email: '',
    address: '', products_supplied: '', payment_terms: 'Net 30',
    outstanding_balance: 0.00, status: 'Active'
  });

  const [poForm, setPoForm] = useState({
    supplier_id: '', order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '', tax: 0, discount: 0,
    approval_status: 'Draft', payment_status: 'Unpaid'
  });
  const [poItems, setPoItems] = useState([{ medicine_name: '', quantity: 1, purchase_price: 0 }]);

  // Goods receiving form
  const [grnItems, setGrnItems] = useState([]);

  useEffect(() => {
    fetchSuppliers();
    fetchPurchaseOrders();
    fetchGrns();
  }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const { data } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(name, outstanding_balance)')
        .order('po_number', { ascending: false });
      setPurchaseOrders(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGrns = async () => {
    try {
      const { data } = await supabase.from('goods_receiving').select('*').order('receiving_date', { ascending: false });
      setGrns(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Supplier handlers
  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...supplierForm,
        outstanding_balance: parseFloat(supplierForm.outstanding_balance) || 0.00
      };

      if (modalMode === 'add') {
        const { error } = await supabase.from('suppliers').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', selectedSupplier.id);
        if (error) throw error;
      }
      setIsSupplierModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSupplierAddModal = () => {
    setSupplierForm({
      name: '', contact_person: '', phone: '', email: '',
      address: '', products_supplied: '', payment_terms: 'Net 30',
      outstanding_balance: 0.00, status: 'Active'
    });
    setModalMode('add');
    setSelectedSupplier(null);
    setIsSupplierModalOpen(true);
  };

  const openSupplierEditModal = (sup) => {
    setSelectedSupplier(sup);
    setSupplierForm({
      name: sup.name, contact_person: sup.contact_person || '',
      phone: sup.phone || '', email: sup.email || '',
      address: sup.address || '', products_supplied: sup.products_supplied || '',
      payment_terms: sup.payment_terms || 'Net 30',
      outstanding_balance: sup.outstanding_balance, status: sup.status
    });
    setModalMode('edit');
    setIsSupplierModalOpen(true);
  };

  // Purchase Order Handlers
  const handlePoItemChange = (index, field, val) => {
    const updated = [...poItems];
    updated[index][field] = val;
    setPoItems(updated);
  };

  const addPoItemField = () => {
    setPoItems([...poItems, { medicine_name: '', quantity: 1, purchase_price: 0 }]);
  };

  const removePoItemField = (index) => {
    if (poItems.length > 1) {
      setPoItems(poItems.filter((_, i) => i !== index));
    }
  };

  const calculatedPoTotal = useMemo(() => {
    const subtotal = poItems.reduce((acc, item) => acc + ((parseInt(item.quantity) || 0) * (parseFloat(item.purchase_price) || 0)), 0);
    const taxVal = parseFloat(poForm.tax) || 0;
    const discVal = parseFloat(poForm.discount) || 0;
    return Math.max(0, subtotal + taxVal - discVal);
  }, [poItems, poForm.tax, poForm.discount]);

  const handlePoSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const countRes = await supabase.from('purchase_orders').select('id', { count: 'exact', head: true });
      const currentCount = countRes.count || 0;
      const poNum = `PO-${20001 + currentCount}`;

      const payload = {
        ...poForm,
        po_number: poNum,
        tax: parseFloat(poForm.tax) || 0,
        discount: parseFloat(poForm.discount) || 0,
        total: calculatedPoTotal
      };

      const { data: poData, error: poErr } = await supabase.from('purchase_orders').insert([payload]).select().single();
      if (poErr) throw poErr;

      // Insert PO Items
      const itemsPayload = poItems.map(item => ({
        purchase_order_id: poData.id,
        medicine_name: item.medicine_name,
        quantity: parseInt(item.quantity) || 1,
        purchase_price: parseFloat(item.purchase_price) || 0
      }));

      const { error: itemsErr } = await supabase.from('purchase_order_items').insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      setIsPoModalOpen(false);
      fetchPurchaseOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPoAddModal = () => {
    setPoForm({
      supplier_id: '', order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '', tax: 0, discount: 0,
      approval_status: 'Draft', payment_status: 'Unpaid'
    });
    setPoItems([{ medicine_name: '', quantity: 1, purchase_price: 0 }]);
    setIsPoModalOpen(true);
  };

  // Goods Receiving Note Handlers
  const openGrnModal = async (po) => {
    setSelectedPo(po);
    try {
      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', po.id);
      
      const grnFormat = (items || []).map(item => ({
        purchase_order_item_id: item.id,
        medicine_name: item.medicine_name,
        ordered_quantity: item.quantity,
        previously_received: item.received_quantity,
        received_quantity: item.quantity - item.received_quantity, // default to receive remaining
        rejected_quantity: 0,
        batch_number: `B-${Math.floor(100000 + Math.random() * 900000)}`,
        manufacture_date: '',
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        cost_price: item.purchase_price,
        selling_price: Math.round(item.purchase_price * 1.3), // default 30% markup
        storage_location: 'Main Pharmacy Rack A'
      }));

      setGrnItems(grnFormat);
      setIsGrnModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGrnSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let totalReceivedCost = 0;

      for (const item of grnItems) {
        if (item.received_quantity <= 0) continue;

        // A. Create GRN Log
        const grnPayload = {
          purchase_order_id: selectedPo.id,
          medicine_name: item.medicine_name,
          received_quantity: parseInt(item.received_quantity),
          rejected_quantity: parseInt(item.rejected_quantity),
          batch_number: item.batch_number,
          manufacture_date: item.manufacture_date || null,
          expiry_date: item.expiry_date,
          cost_price: parseFloat(item.cost_price),
          selling_price: parseFloat(item.selling_price),
          storage_location: item.storage_location,
          receiver_id: user?.id || null,
          receiving_date: new Date().toISOString().split('T')[0]
        };
        const { error: grnErr } = await supabase.from('goods_receiving').insert([grnPayload]);
        if (grnErr) throw grnErr;

        // B. Stock increment logic inside pharmacy catalog (medicines)
        const { data: existMeds } = await supabase.from('medicines').select('*').eq('name', item.medicine_name);
        if (existMeds && existMeds.length > 0) {
          const m = existMeds[0];
          const newQty = m.quantity + parseInt(item.received_quantity);
          const status = newQty <= 0 ? 'Out of Stock' : newQty <= 20 ? 'Low Stock' : 'In Stock';
          await supabase.from('medicines').update({
            quantity: newQty,
            status,
            unit_price: parseFloat(item.selling_price),
            batch_number: item.batch_number,
            expiry_date: item.expiry_date
          }).eq('id', m.id);
        } else {
          // Add new item to catalog
          const status = parseInt(item.received_quantity) <= 20 ? 'Low Stock' : 'In Stock';
          await supabase.from('medicines').insert([{
            name: item.medicine_name,
            generic_name: '',
            category: 'General',
            batch_number: item.batch_number,
            expiry_date: item.expiry_date,
            quantity: parseInt(item.received_quantity),
            unit_price: parseFloat(item.selling_price),
            status,
            created_by: user?.id
          }]);
        }

        // C. Update PO item received quantity
        const newTotalReceived = item.previously_received + parseInt(item.received_quantity);
        await supabase
          .from('purchase_order_items')
          .update({ received_quantity: newTotalReceived })
          .eq('id', item.purchase_order_item_id);

        totalReceivedCost += (parseInt(item.received_quantity) * parseFloat(item.cost_price));
      }

      // D. Update Supplier outstanding balance
      const targetSupplier = suppliers.find(s => s.id === selectedPo.supplier_id);
      if (targetSupplier) {
        const newBalance = parseFloat(targetSupplier.outstanding_balance) + totalReceivedCost;
        await supabase.from('suppliers').update({ outstanding_balance: newBalance }).eq('id', targetSupplier.id);
      }

      // E. Update PO statuses if fully received
      const { data: itemsToCheck } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', selectedPo.id);
      const allReceived = (itemsToCheck || []).every(it => it.received_quantity >= it.quantity);
      if (allReceived) {
        await supabase.from('purchase_orders').update({ approval_status: 'Approved', payment_status: 'Unpaid' }).eq('id', selectedPo.id);
      } else {
        await supabase.from('purchase_orders').update({ approval_status: 'Approved', payment_status: 'Partially Paid' }).eq('id', selectedPo.id);
      }

      setIsGrnModalOpen(false);
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchGrns();
      alert('Goods received and pharmacy medicine stock updated successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStatement = (sup) => {
    setSelectedSupplier(sup);
    setIsStatementModalOpen(true);
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const term = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(term) || s.contact_person?.toLowerCase().includes(term);
    });
  }, [suppliers, searchTerm]);

  // Supplier Statement Reports
  const supplierStatementData = useMemo(() => {
    if (!selectedSupplier) return [];
    // Combine POs and GRNs for logs
    const poLogs = purchaseOrders
      .filter(po => po.supplier_id === selectedSupplier.id)
      .map(po => ({
        date: po.order_date,
        ref: po.po_number,
        desc: `Purchase Order Placed`,
        amount: parseFloat(po.total),
        type: 'debit'
      }));

    const grnLogs = grns
      .filter(g => {
        const matchingPo = purchaseOrders.find(po => po.id === g.purchase_order_id);
        return matchingPo && matchingPo.supplier_id === selectedSupplier.id;
      })
      .map(g => ({
        date: g.receiving_date,
        ref: `GRN-${g.id.substring(0, 5).toUpperCase()}`,
        desc: `Received ${g.received_quantity}x ${g.medicine_name} (Batch: ${g.batch_number})`,
        amount: g.received_quantity * g.cost_price,
        type: 'credit'
      }));

    return [...poLogs, ...grnLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedSupplier, purchaseOrders, grns]);

  return (
    <div className="procurement-layout">
      {/* Header */}
      <div className="procurement-header-row">
        <div className="procurement-header-left">
          <h1>Pharmacy Procurement & Supplier Ledger</h1>
          <p className="procurement-subtitle">Track suppliers database, dispatch purchase orders, record goods receiving notes, and auto-update stock.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="premium-btn-outline" onClick={openPoAddModal}>
            <Plus size={16} /> New Purchase Order
          </button>
          <button className="premium-btn" onClick={openSupplierAddModal}>
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="procurement-table-header" style={{ padding: 0, borderBottom: 'none' }}>
        <div className="procurement-tab-buttons">
          <button className={`procurement-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => setActiveTab('suppliers')}>Suppliers Directory</button>
          <button className={`procurement-tab-btn ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => setActiveTab('pos')}>Purchase Orders</button>
          <button className={`procurement-tab-btn ${activeTab === 'receiving' ? 'active' : ''}`} onClick={() => setActiveTab('receiving')}>Receiving History (GRN)</button>
          <button className={`procurement-tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>Procurement Reports</button>
        </div>
      </div>

      {activeTab === 'suppliers' && (
        <>
          {/* Toolbar */}
          <div className="procurement-toolbar">
            <div className="procurement-search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search supplier name or contact person..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="procurement-table-box">
            <table className="procedures-data-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Contact Person</th>
                  <th>Phone / Email</th>
                  <th>Payment Terms</th>
                  <th>Outstanding Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(sup => (
                  <tr key={sup.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{sup.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sup.products_supplied || 'Multiple items'}</div>
                    </td>
                    <td>{sup.contact_person || '—'}</td>
                    <td>
                      <div>{sup.phone || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sup.email || '—'}</div>
                    </td>
                    <td>{sup.payment_terms}</td>
                    <td>
                      <strong style={{ color: sup.outstanding_balance > 0 ? 'var(--accent-red)' : 'var(--text-main)' }}>
                        ${parseFloat(sup.outstanding_balance).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="procedures-action-btn" onClick={() => openSupplierEditModal(sup)}><Edit size={12} /> Edit</button>
                        <button className="procedures-action-btn" onClick={() => openStatement(sup)}><FileText size={12} /> Statement</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'pos' && (
        <div className="procurement-table-box">
          <table className="procedures-data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Order Date</th>
                <th>Total Cost</th>
                <th>Approval</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map(po => (
                <tr key={po.id}>
                  <td><strong>{po.po_number}</strong></td>
                  <td>{po.suppliers?.name}</td>
                  <td>{po.order_date}</td>
                  <td><strong>${parseFloat(po.total).toFixed(2)}</strong></td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 'bold',
                      background: po.approval_status === 'Approved' ? '#D1FAE5' : '#FEF3C7',
                      color: po.approval_status === 'Approved' ? '#065F46' : '#D97706'
                    }}>{po.approval_status}</span>
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 'bold',
                      background: po.payment_status === 'Paid' ? '#D1FAE5' : '#FEE2E2',
                      color: po.payment_status === 'Paid' ? '#065F46' : '#991B1B'
                    }}>{po.payment_status}</span>
                  </td>
                  <td>
                    <button className="procedures-action-btn" onClick={() => openGrnModal(po)} disabled={po.approval_status === 'Draft'}><Truck size={12} /> Receive Goods</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'receiving' && (
        <div className="procurement-table-box">
          <table className="procedures-data-table">
            <thead>
              <tr>
                <th>Date Received</th>
                <th>Item Name</th>
                <th>Qty Received</th>
                <th>Qty Rejected</th>
                <th>Batch Number</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
              </tr>
            </thead>
            <tbody>
              {grns.map(g => (
                <tr key={g.id}>
                  <td>{g.receiving_date}</td>
                  <td><strong>{g.medicine_name}</strong></td>
                  <td><span style={{ color: 'var(--primary-brand)', fontWeight: 'bold' }}>+{g.received_quantity}</span></td>
                  <td>{g.rejected_quantity > 0 ? <span style={{ color: 'var(--accent-red)' }}>{g.rejected_quantity}</span> : '0'}</td>
                  <td><code>{g.batch_number}</code></td>
                  <td>${parseFloat(g.cost_price).toFixed(2)}</td>
                  <td>${parseFloat(g.selling_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reports' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Outstanding Balance Report */}
          <div className="procurement-report-card">
            <h4>Outstanding Supplier Balances</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {suppliers.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span>{s.name}</span>
                  <strong>${parseFloat(s.outstanding_balance).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="procurement-report-card">
            <h4>Purchase Summary Expense</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total PO Amount Issued:</span>
                <strong>${purchaseOrders.reduce((acc, po) => acc + parseFloat(po.total), 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Outstanding Debts to Suppliers:</span>
                <strong style={{ color: 'var(--accent-red)' }}>${suppliers.reduce((acc, s) => acc + parseFloat(s.outstanding_balance), 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD SUPPLIER MODAL ── */}
      {isSupplierModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSupplierModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '➕ Add Supplier' : '📝 Edit Supplier'}</h2>
              <button className="close-modal-btn" onClick={() => setIsSupplierModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSupplierSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Supplier Name *</label>
                  <input type="text" className="premium-input" required value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input type="text" className="premium-input" value={supplierForm.contact_person} onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" className="premium-input" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" className="premium-input" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Outstanding Balance ($)</label>
                  <input type="number" step="0.01" className="premium-input" value={supplierForm.outstanding_balance} onChange={e => setSupplierForm({ ...supplierForm, outstanding_balance: e.target.value })} />
                </div>
                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsSupplierModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Save Supplier</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE PURCHASE ORDER MODAL ── */}
      {isPoModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPoModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>➕ Create Purchase Order</h2>
              <button className="close-modal-btn" onClick={() => setIsPoModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handlePoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Select Supplier *</label>
                  <select className="premium-input" required value={poForm.supplier_id} onChange={e => setPoForm({ ...poForm, supplier_id: e.target.value })}>
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 'bold' }}>Items ordered</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {poItems.map((item, idx) => (
                      <div key={idx} className="procurement-item-form-row">
                        <div style={{ flex: 2 }}>
                          <input type="text" className="premium-input" placeholder="Medicine / Item name" required value={item.medicine_name} onChange={e => handlePoItemChange(idx, 'medicine_name', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <input type="number" className="premium-input" placeholder="Qty" required value={item.quantity} onChange={e => handlePoItemChange(idx, 'quantity', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <input type="number" step="0.01" className="premium-input" placeholder="Cost ($)" required value={item.purchase_price} onChange={e => handlePoItemChange(idx, 'purchase_price', e.target.value)} />
                        </div>
                        <button type="button" onClick={() => removePoItemField(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 8 }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <button type="button" className="premium-btn-outline" onClick={addPoItemField}>+ Add Item</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Tax ($)</label>
                    <input type="number" className="premium-input" value={poForm.tax} onChange={e => setPoForm({ ...poForm, tax: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Discount ($)</label>
                    <input type="number" className="premium-input" value={poForm.discount} onChange={e => setPoForm({ ...poForm, discount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Calculated Total</label>
                    <input type="text" className="premium-input" readOnly value={`$${calculatedPoTotal.toFixed(2)}`} style={{ background: 'var(--bg-body)', fontWeight: 'bold' }} />
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsPoModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Issue PO</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── GOODS RECEIVING NOTE MODAL ── */}
      {isGrnModalOpen && (
        <div className="modal-overlay" onClick={() => setIsGrnModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>🚚 Record Arrived Goods (GRN)</h2>
              <button className="close-modal-btn" onClick={() => setIsGrnModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <form onSubmit={handleGrnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                {grnItems.map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-body)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>{item.medicine_name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>Ordered: {item.ordered_quantity} (Previously Recvd: {item.previously_received})</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label>Qty Received</label>
                        <input type="number" className="premium-input" required value={item.received_quantity} onChange={e => {
                          const updated = [...grnItems];
                          updated[idx].received_quantity = Math.max(0, parseInt(e.target.value) || 0);
                          setGrnItems(updated);
                        }} />
                      </div>
                      <div className="form-group">
                        <label>Qty Rejected</label>
                        <input type="number" className="premium-input" required value={item.rejected_quantity} onChange={e => {
                          const updated = [...grnItems];
                          updated[idx].rejected_quantity = Math.max(0, parseInt(e.target.value) || 0);
                          setGrnItems(updated);
                        }} />
                      </div>
                      <div className="form-group">
                        <label>Batch Number *</label>
                        <input type="text" className="premium-input" required value={item.batch_number} onChange={e => {
                          const updated = [...grnItems];
                          updated[idx].batch_number = e.target.value;
                          setGrnItems(updated);
                        }} />
                      </div>
                      <div className="form-group">
                        <label>Expiry Date *</label>
                        <input type="date" className="premium-input" required value={item.expiry_date} onChange={e => {
                          const updated = [...grnItems];
                          updated[idx].expiry_date = e.target.value;
                          setGrnItems(updated);
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label>Cost Price ($)</label>
                        <input type="number" step="0.01" className="premium-input" required value={item.cost_price} onChange={e => {
                          const updated = [...grnItems];
                          updated[idx].cost_price = parseFloat(e.target.value) || 0;
                          setGrnItems(updated);
                        }} />
                      </div>
                      <div className="form-group">
                        <label>Selling Price ($)</label>
                        <input type="number" step="0.01" className="premium-input" required value={item.selling_price} onChange={e => {
                          const updated = [...grnItems];
                          updated[idx].selling_price = parseFloat(e.target.value) || 0;
                          setGrnItems(updated);
                        }} />
                      </div>
                      <div className="form-group">
                        <label>Storage Location</label>
                        <input type="text" className="premium-input" value={item.storage_location} onChange={e => {
                          const updated = [...grnItems];
                          updated[idx].storage_location = e.target.value;
                          setGrnItems(updated);
                        }} />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="modal-footer" style={{ padding: '12px 0 0 0' }}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsGrnModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>Confirm Arrived Stock</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPPLIER STATEMENT MODAL ── */}
      {isStatementModalOpen && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setIsStatementModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>📊 Supplier Statement Report</h2>
              <button className="close-modal-btn" onClick={() => setIsStatementModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <strong>Supplier:</strong> {selectedSupplier.name}<br />
                <strong>Outstanding Debt:</strong> ${parseFloat(selectedSupplier.outstanding_balance).toFixed(2)}
              </div>
              
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="procedures-data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref Code</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierStatementData.map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.date}</td>
                        <td><code>{log.ref}</code></td>
                        <td>{log.desc}</td>
                        <td style={{ color: log.type === 'debit' ? 'var(--text-main)' : 'var(--primary-brand)', fontWeight: 'bold' }}>
                          {log.type === 'debit' ? '+' : '-'}${log.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Procurement;
