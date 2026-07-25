import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Loader2, CheckCircle, Clock, Trash2, FileText, CheckSquare, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Radiology.css';

const Radiology = () => {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'catalog'
  
  // Requests State
  const [requests, setRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  
  // Catalog State
  const [catalog, setCatalog] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  
  // Modal State
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const { user } = useAuth();

  // Form States
  const [catalogForm, setCatalogForm] = useState({ test_name: '', category: 'Radiology', price: '' });
  const [resultForm, setResultForm] = useState({ result_text: '', notes: '' });

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests();
    } else {
      fetchCatalog();
    }
  }, [activeTab]);

  const fetchRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('lab_requests')
        .select(`
          *,
          patients (full_name, patient_id),
          lab_catalog (test_name, category)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter only Radiology requests
      const radRequests = (data || []).filter(
        req => req.lab_catalog?.category?.toLowerCase() === 'radiology' || req.lab_catalog?.category?.toLowerCase() === 'imaging'
      );
      setRequests(radRequests);
    } catch (error) {
      console.error('Error fetching radiology requests:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const fetchCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const { data, error } = await supabase
        .from('lab_catalog')
        .select('*')
        .order('test_name', { ascending: true });

      if (error) throw error;

      // Filter only Radiology catalog items
      const radCatalog = (data || []).filter(
        cat => cat.category?.toLowerCase() === 'radiology' || cat.category?.toLowerCase() === 'imaging'
      );
      setCatalog(radCatalog);
    } catch (error) {
      console.error('Error fetching radiology catalog:', error);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleCatalogSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('lab_catalog').insert([
        {
          test_name: catalogForm.test_name,
          category: 'Radiology', // Fixed for radiology catalog addition
          price: parseFloat(catalogForm.price) || 0
        }
      ]);

      if (error) throw error;

      setIsCatalogModalOpen(false);
      setCatalogForm({ test_name: '', category: 'Radiology', price: '' });
      fetchCatalog();
    } catch (error) {
      console.error('Error adding radiology catalog item:', error);
      alert('Failed to add item to radiology catalog.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openResultModal = (request) => {
    setSelectedRequest(request);
    setResultForm({
      result_text: request.result_text || '',
      notes: request.notes || ''
    });
    setIsResultModalOpen(true);
  };

  const handleResultSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('lab_requests')
        .update({
          result_text: resultForm.result_text,
          notes: resultForm.notes,
          status: 'Completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      setIsResultModalOpen(false);
      fetchRequests();
    } catch (error) {
      console.error('Error submitting scan results:', error);
      alert('Failed to submit results.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const completedCount = requests.filter(r => r.status === 'Completed').length;

  return (
    <div className="page-layout">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Radiology & Imaging</h1>
          <p>Process scan orders, X-Rays, and upload diagnostic findings</p>
        </div>
        
        <div className="tab-switcher">
          <button 
            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Imaging Orders
          </button>
          <button 
            className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            Scans Catalog
          </button>
        </div>
      </div>

      {activeTab === 'requests' && (
        <div className="fade-in">
          {/* KPI Ribbon */}
          <div className="rad-kpi-row">
            <div className="rad-kpi-card">
              <div className="kpi-icon pending">
                <Clock size={24} />
              </div>
              <div className="kpi-info">
                <h3>{pendingCount}</h3>
                <p>Pending Scans</p>
              </div>
            </div>

            <div className="rad-kpi-card">
              <div className="kpi-icon completed">
                <CheckCircle size={24} />
              </div>
              <div className="kpi-info">
                <h3>{completedCount}</h3>
                <p>Completed Scans</p>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="table-container mt-4">
            {isLoadingRequests ? (
              <div style={{display: 'flex', justifyContent: 'center', padding: '60px'}}>
                <Loader2 className="spinner animate-spin" size={32} color="var(--primary-brand)" />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Scan Requested</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div style={{fontWeight: '600', color: 'var(--text-main)'}}>{req.patients?.full_name}</div>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{req.patients?.patient_id}</div>
                      </td>
                      <td>
                        <div style={{color: 'var(--text-main)', fontWeight: '500'}}>{req.lab_catalog?.test_name}</div>
                        <span className="status-badge warning" style={{marginTop: '4px', fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)'}}>{req.lab_catalog?.category}</span>
                      </td>
                      <td>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-badge ${req.status === 'Completed' ? 'success' : 'warning'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.status === 'Pending' ? (
                          <button className="premium-btn" style={{padding: '8px 16px', fontSize: '0.85rem'}} onClick={() => openResultModal(req)}>
                            <CheckSquare size={14} /> Enter Findings
                          </button>
                        ) : (
                          <button className="premium-btn-outline" style={{padding: '8px 16px', fontSize: '0.85rem'}} onClick={() => openResultModal(req)}>
                            <Eye size={14} /> View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                        No radiology orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="fade-in">
          <div className="toolbar" style={{justifyContent: 'flex-end'}}>
            <button className="premium-btn" onClick={() => setIsCatalogModalOpen(true)}>
              <Plus size={18} /> Add New Scan
            </button>
          </div>

          <div className="table-container">
            {isLoadingCatalog ? (
              <div style={{display: 'flex', justifyContent: 'center', padding: '60px'}}>
                <Loader2 className="spinner animate-spin" size={32} color="var(--primary-brand)" />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Scan Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map(cat => (
                    <tr key={cat.id}>
                      <td style={{fontWeight: '600'}}>{cat.test_name}</td>
                      <td>{cat.category}</td>
                      <td>${cat.price}</td>
                      <td>
                        <span className="status-badge success">Active</span>
                      </td>
                    </tr>
                  ))}
                  {catalog.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
                        No scans catalog items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Catalog Item Modal */}
      {isCatalogModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCatalogModalOpen(false)}>
          <div className="modal-content" style={{maxWidth: '450px', height: 'auto', display: 'block', margin: 'auto', borderRadius: '16px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Scan to Catalog</h2>
              <button className="close-modal-btn" onClick={() => setIsCatalogModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCatalogSubmit}>
                <div className="form-group">
                  <label>Scan Name *</label>
                  <input 
                    type="text" 
                    className="premium-input" 
                    required 
                    value={catalogForm.test_name} 
                    onChange={e => setCatalogForm({ ...catalogForm, test_name: e.target.value })} 
                    placeholder="e.g. Chest X-Ray (AP & Lat)"
                  />
                </div>
                <div className="form-group" style={{marginTop: '16px'}}>
                  <label>Price ($) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="premium-input" 
                    required 
                    value={catalogForm.price} 
                    onChange={e => setCatalogForm({ ...catalogForm, price: e.target.value })} 
                    placeholder="0.00"
                  />
                </div>
                <div className="modal-footer" style={{marginTop: '24px'}}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsCatalogModalOpen(false)}>Cancel</button>
                  <button type="submit" className="premium-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Scan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Results / Findings Modal */}
      {isResultModalOpen && selectedRequest && (
        <div className="modal-overlay" onClick={() => setIsResultModalOpen(false)}>
          <div className="modal-content" style={{maxWidth: '550px', height: 'auto', display: 'block', margin: 'auto', borderRadius: '16px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedRequest.status === 'Pending' ? 'Enter Scan Diagnosis' : 'View Imaging Diagnosis'}</h2>
              <button className="close-modal-btn" onClick={() => setIsResultModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{background: 'var(--bg-hover)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                  <strong>Patient: {selectedRequest.patients?.full_name}</strong>
                  <span>ID: {selectedRequest.patients?.patient_id}</span>
                </div>
                <strong>Scan: {selectedRequest.lab_catalog?.test_name}</strong>
              </div>

              <form onSubmit={handleResultSubmit}>
                <div className="form-group">
                  <label>Diagnostic Findings *</label>
                  <textarea 
                    className="premium-input" 
                    rows="6" 
                    required 
                    disabled={selectedRequest.status === 'Completed'}
                    value={resultForm.result_text} 
                    onChange={e => setResultForm({ ...resultForm, result_text: e.target.value })}
                    placeholder="Describe fractures, lesions, bone structures, or scan observations..."
                  />
                </div>
                <div className="form-group" style={{marginTop: '16px'}}>
                  <label>Technician Notes</label>
                  <textarea 
                    className="premium-input" 
                    rows="2" 
                    disabled={selectedRequest.status === 'Completed'}
                    value={resultForm.notes} 
                    onChange={e => setResultForm({ ...resultForm, notes: e.target.value })}
                    placeholder="Enter device specs or capture constraints (optional)..."
                  />
                </div>
                <div className="modal-footer" style={{marginTop: '24px'}}>
                  <button type="button" className="premium-btn-outline" onClick={() => setIsResultModalOpen(false)}>Close</button>
                  {selectedRequest.status === 'Pending' && (
                    <button type="submit" className="premium-btn" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving Findings...' : 'Submit Findings'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// SVG Icon Helper
const X = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

export default Radiology;
