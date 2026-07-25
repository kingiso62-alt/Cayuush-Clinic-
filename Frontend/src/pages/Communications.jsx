import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  MessageSquare, Send, CheckCheck, AlertCircle, RefreshCw, 
  Search, ShieldCheck, Phone, Check, Share2
} from 'lucide-react';
import './Communications.css';

const Communications = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('All');

  // New Message Form state
  const [form, setForm] = useState({
    patient_id: '',
    recipient_name: '',
    recipient_phone: '',
    channel: 'WhatsApp',
    message_type: 'General',
    message_content: ''
  });

  useEffect(() => {
    fetchLogs();
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const { data } = await supabase.from('patients').select('id, full_name, phone').order('full_name');
      setPatients(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSelect = (e) => {
    const pid = e.target.value;
    const pat = patients.find(p => p.id === pid);
    if (pat) {
      setForm(f => ({
        ...f,
        patient_id: pat.id,
        recipient_name: pat.full_name,
        recipient_phone: pat.phone || '+252 '
      }));
    } else {
      setForm(f => ({
        ...f,
        patient_id: '',
        recipient_name: '',
        recipient_phone: ''
      }));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.recipient_phone || !form.message_content) {
      alert('Fadlan buuxi lambarka iyo qoraalka fariinta.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        patient_id: form.patient_id || null,
        recipient_name: form.recipient_name || 'Quick Send Patient',
        recipient_phone: form.recipient_phone,
        channel: form.channel,
        message_type: form.message_type,
        message_content: form.message_content,
        status: 'Sent' // Mocking immediate successful gateway send
      };

      const { error } = await supabase.from('communications').insert([payload]);
      if (error) throw error;

      alert(`Fariinta ${form.channel} waxaa loo diray si otomaatig ah!`);
      setForm(f => ({
        ...f,
        message_content: ''
      }));
      fetchLogs();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = log.recipient_name?.toLowerCase().includes(term) ||
                          log.recipient_phone?.toLowerCase().includes(term) ||
                          log.message_content?.toLowerCase().includes(term);
    const matchesChannel = channelFilter === 'All' || log.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const whatsappCount = logs.filter(l => l.channel === 'WhatsApp').length;
  const smsCount = logs.filter(l => l.channel === 'SMS').length;
  const totalCount = logs.length;

  return (
    <div className="comms-page">
      <div className="comms-header">
        <div>
          <h2>📱 SMS &amp; WhatsApp Notifications Gateway</h2>
          <p className="breadcrumb-path">Dashboard / Communications Center</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="comms-kpis">
        <div className="kpi-card whatsapp">
          <div className="kpi-icon-wrapper"><MessageSquare size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">WhatsApp Sent</span>
            <h3>{whatsappCount}</h3>
            <span className="kpi-subtitle">Direct messages delivered</span>
          </div>
        </div>

        <div className="kpi-card sms">
          <div className="kpi-icon-wrapper"><Phone size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">SMS Notifications</span>
            <h3>{smsCount}</h3>
            <span className="kpi-subtitle">GSM texts dispatched</span>
          </div>
        </div>

        <div className="kpi-card total">
          <div className="kpi-icon-wrapper"><Share2 size={22} /></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Dispatched</span>
            <h3>{totalCount}</h3>
            <span className="kpi-subtitle">Sent logs this month</span>
          </div>
        </div>
      </div>

      <div className="comms-grid">
        {/* LEFT FORM: Compose & Live Preview */}
        <div className="comms-compose-section">
          <div className="comms-card">
            <h3>✉️ Dir Fariin Cusub (Send Notification)</h3>
            <form onSubmit={handleSend} className="comms-form">
              <div className="form-group">
                <label>Dooro Bukaanka / Select Patient</label>
                <select onChange={handlePatientSelect} className="premium-input">
                  <option value="">-- Dooro Bukaanka (Ama gacanta ku qor) --</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Magaca Qaataha / Recipient Name *</label>
                <input 
                  type="text" required className="premium-input" 
                  value={form.recipient_name} 
                  onChange={e => setForm({ ...form, recipient_name: e.target.value })} 
                  placeholder="Example: Amina Abdi" 
                />
              </div>

              <div className="form-group">
                <label>Taleefanka / Phone Number *</label>
                <input 
                  type="text" required className="premium-input" 
                  value={form.recipient_phone} 
                  onChange={e => setForm({ ...form, recipient_phone: e.target.value })} 
                  placeholder="Example: +252 61 XXXXXXX" 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Channel / Qaabka</label>
                  <select 
                    className="premium-input" 
                    value={form.channel} 
                    onChange={e => setForm({ ...form, channel: e.target.value })}
                  >
                    <option value="WhatsApp">WhatsApp Message</option>
                    <option value="SMS">Normal SMS Text</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Nooca / Type</label>
                  <select 
                    className="premium-input" 
                    value={form.message_type} 
                    onChange={e => setForm({ ...form, message_type: e.target.value })}
                  >
                    <option value="General">General/Info</option>
                    <option value="Appointment">Appointment Reminder</option>
                    <option value="Lab Result">Lab Result Notification</option>
                    <option value="Invoice">Invoice Balance</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Qoraalka Fariinta / Message Content *</label>
                <textarea 
                  required className="premium-input" rows={4}
                  value={form.message_content} 
                  onChange={e => setForm({ ...form, message_content: e.target.value })} 
                  placeholder="Qor halkaan fariinta aad rabto..."
                />
              </div>

              <button type="submit" className="premium-btn" disabled={isSubmitting} style={{ width: '100%' }}>
                <Send size={16} /> Dir Fariinta Hadda
              </button>
            </form>
          </div>
        </div>

        {/* MIDDLE MOBILE PREVIEW */}
        <div className="comms-preview-section">
          <div className="mock-phone">
            <div className="phone-notch"></div>
            <div className="phone-screen">
              <div className="whatsapp-header">
                <div className="avatar">C</div>
                <div>
                  <div className="name">Cayush Clinic Support</div>
                  <div className="status">Online</div>
                </div>
              </div>
              <div className="whatsapp-chat-body">
                <div className="chat-date">TODAY</div>
                
                {form.message_content ? (
                  <div className="chat-bubble received">
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{form.message_content}</p>
                    <span className="time">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span style={{ color: '#4fc3f7', marginLeft: 4 }}>✓✓</span>
                    </span>
                  </div>
                ) : (
                  <div className="chat-bubble info">
                    Qor fariinta dhinaca bidix ku taal si aad u aragto visual mock preview-ga.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM LOGS TABLE */}
      <div className="comms-logs-card" style={{ marginTop: 24 }}>
        <div className="logs-header-toolbar">
          <h3>📋 Farriimihii la Diray (Notifications Sent Queue)</h3>
          <div className="toolbar-actions">
            <div className="search-bar">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Raadi fariin ama magac..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            <select 
              value={channelFilter} 
              onChange={e => setChannelFilter(e.target.value)}
              className="channel-select-filter"
            >
              <option value="All">All Channels</option>
              <option value="WhatsApp">WhatsApp Only</option>
              <option value="SMS">SMS Only</option>
            </select>
            <button className="refresh-btn" onClick={fetchLogs}>
              <RefreshCw size={16} /> Reload
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {isLoading ? (
            <p style={{ padding: 24, textAlign: 'center' }}>Loading communications logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Ma jiraan farriimo la helay.</p>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>RECIPIENT</th>
                  <th>PHONE</th>
                  <th>CHANNEL</th>
                  <th>TYPE</th>
                  <th>MESSAGE CONTENT</th>
                  <th>STATUS</th>
                  <th>SENT DATE</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 'bold' }}>{log.recipient_name}</td>
                    <td>{log.recipient_phone}</td>
                    <td>
                      <span className={`channel-badge ${log.channel.toLowerCase()}`}>
                        {log.channel}
                      </span>
                    </td>
                    <td>{log.message_type}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.message_content}
                    </td>
                    <td>
                      <span className="status-badge-green">
                        <CheckCheck size={12} /> {log.status}
                      </span>
                    </td>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Communications;
