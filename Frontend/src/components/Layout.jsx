import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CalendarDays, Activity, 
  Beaker, DollarSign, Settings, Menu, X, BarChart2, Users2, LogOut,
  Sun, Moon, Search, Bell, Mail, Calendar, ChevronDown, HelpCircle,
  Clock, Bed, User, Heart, FileText, ArrowUpRight, ClipboardList
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './Sidebar.css';

/* ── Notification Sound (WhatsApp-style ding) ── */
const playNotifSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // First tone — high
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second tone — lower, delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.18);
    gain2.gain.setValueAtTime(0.0, ctx.currentTime + 0.18);
    gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {
    console.warn('Audio not supported:', e);
  }
};

/* ── Browser Push Notification ── */
const showBrowserNotif = (title, body, onClick) => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const n = new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      silent: true  // we handle sound ourselves
    });
    if (onClick) n.onclick = () => { window.focus(); onClick(); n.close(); };
  }
};

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState('');

  // Dropdown States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  /* Request browser notification permission on mount */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const closeDropdowns = () => {
      setIsNotificationsOpen(false);
      setIsMessagesOpen(false);
      setIsProfileMenuOpen(false);
    };
    window.addEventListener('click', closeDropdowns);
    return () => window.removeEventListener('click', closeDropdowns);
  }, []);

  const handleToggleNotifications = (e) => {
    e.stopPropagation();
    setIsNotificationsOpen(!isNotificationsOpen);
    setIsMessagesOpen(false);
    setIsProfileMenuOpen(false);
  };

  const handleToggleMessages = (e) => {
    e.stopPropagation();
    setIsMessagesOpen(!isMessagesOpen);
    setIsNotificationsOpen(false);
    setIsProfileMenuOpen(false);
  };

  const handleToggleProfileMenu = (e) => {
    e.stopPropagation();
    setIsProfileMenuOpen(!isProfileMenuOpen);
    setIsNotificationsOpen(false);
    setIsMessagesOpen(false);
  };

  // Dynamic Real-time Notifications State
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'New Appointment', desc: 'PT-1002 - Halimo Abdi', time: '5 mins ago', read: false, path: '/queue' },
    { id: '2', title: 'Lab Report', desc: 'Patient PT-1005 blood test ready', time: '1 hour ago', read: false, path: '/laboratory' },
    { id: '3', title: 'Invoice Paid', desc: 'PT-1003 - $45.00', time: '2 hours ago', read: true, path: '/billing' }
  ]);

  // Dynamic Real-time Messages State
  const [messages, setMessages] = useState([
    { id: '1', sender: 'Dr. Aisha Ibrahim', text: 'Can you check the chart for room 2?', time: '10 mins ago', avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=120', path: '/settings', read: false },
    { id: '2', sender: 'Dr. Hassan Ali', text: 'I have approved the dental report.', time: '1 hour ago', avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=120', path: '/settings', read: false }
  ]);

  // Real-time Postgres Database changes listener
  useEffect(() => {

    // 1. Appointments real-time listener (INSERT → notify doctor)
    const appointmentChannel = supabase
      .channel('layout-appointments-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, async (payload) => {
        try {
          const { data: patient } = await supabase
            .from('patients')
            .select('full_name')
            .eq('id', payload.new.patient_id)
            .single();

          const patientName = patient ? patient.full_name : 'Bukaanka Cusub';
          const timeStr = payload.new.appointment_time?.substring(0, 5) || '';

          const newNotif = {
            id: `appt-${Date.now()}`,
            title: '🏥 Bukaanka Cusub — Queue',
            desc: `${patientName}${timeStr ? ` · ${timeStr}` : ''} — Queue geli`,
            time: 'Hadda',
            read: false,
            path: '/queue'
          };

          // 🔔 Play WhatsApp-style ding
          playNotifSound();

          // 📲 OS browser notification
          showBrowserNotif(
            '🏥 Bukaanka Cusub — Queue',
            `${patientName} — Queue ku jira. Click si aad u aragto.`,
            () => navigate('/queue')
          );

          setNotifications(prev => [newNotif, ...prev]);
        } catch (err) {
          console.error(err);
        }
      })
      .subscribe();

    // 2. Lab requests real-time listener (UPDATE → completed)
    const labChannel = supabase
      .channel('layout-labs-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lab_requests' }, async (payload) => {
        if (payload.new.status === 'Completed' || payload.new.status === 'completed') {
          try {
            const { data: patient } = await supabase
              .from('patients')
              .select('full_name')
              .eq('id', payload.new.patient_id)
              .single();

            const patientName = patient ? patient.full_name : 'Bukaanka';
            const newNotif = {
              id: `lab-${Date.now()}`,
              title: '🧪 Lab Natiijad Diyaar',
              desc: `${patientName} — Natiijadu waa diyaar`,
              time: 'Hadda',
              read: false,
              path: '/laboratory'
            };

            // 🔔 Play sound
            playNotifSound();

            // 📲 OS notification
            showBrowserNotif(
              '🧪 Lab Natiijad Diyaar',
              `${patientName} natiijadu diyaar tahay. Click si aad u aragto.`,
              () => navigate('/laboratory')
            );

            setNotifications(prev => [newNotif, ...prev]);
          } catch (err) {
            console.error(err);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentChannel);
      supabase.removeChannel(labChannel);
    };
  }, [navigate]);

  const handleNotificationClick = (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setIsNotificationsOpen(false);
    navigate(notif.path);
  };

  const handleMessageClick = (msg) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
    setIsMessagesOpen(false);
    navigate(msg.path, { state: { activeTab: 'profile' } });
  };

  useEffect(() => {
    if (user?.id) {
      setAvatar(localStorage.getItem(`cayush-avatar-${user.id}`) || '');
    }
  }, [user]);

  useEffect(() => {
    const handleAvatarChange = () => {
      if (user?.id) {
        setAvatar(localStorage.getItem(`cayush-avatar-${user.id}`) || '');
      }
    };
    window.addEventListener('avatar-changed', handleAvatarChange);
    return () => window.removeEventListener('avatar-changed', handleAvatarChange);
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const mainNavItems = [
    { name: 'Patients', icon: <Users size={18} />, path: '/patients' },
    { name: 'Appointments', icon: <CalendarDays size={18} />, path: '/appointments' },
    { name: 'Doctor Queue', icon: <Clock size={18} />, path: '/queue' },
    { name: 'Inpatients', icon: <Bed size={18} />, path: '/inpatients' },
    { name: 'Doctors', icon: <Users2 size={18} />, path: '/doctors' },
    { name: 'Departments', icon: <Settings size={18} />, path: '/departments' },
    { name: 'Staff', icon: <Users2 size={18} />, path: '/staff' },
    { name: 'Pharmacy', icon: <Activity size={18} />, path: '/pharmacy' },
    { name: 'Laboratory', icon: <Beaker size={18} />, path: '/laboratory' },
    { name: 'Radiology', icon: <Beaker size={18} />, path: '/radiology' },
    { name: 'Prescription Writer', icon: <User size={18} />, path: '/prescription-writer' },
    { name: 'Vaccinations', icon: <Heart size={18} />, path: '/vaccinations' },
    { name: 'Certificates', icon: <Mail size={18} />, path: '/certificates' },
    { name: 'Encounters', icon: <FileText size={18} />, path: '/encounters' },
    { name: 'Referrals', icon: <ArrowUpRight size={18} />, path: '/referrals' },
    { name: 'Procedures', icon: <ClipboardList size={18} />, path: '/procedures' },
    { name: 'Maternity', icon: <Heart size={18} />, path: '/maternity' },
    { name: 'Emergency', icon: <Activity size={18} />, path: '/emergency' }
  ];

  const managementNavItems = [
    { name: 'Billing', icon: <DollarSign size={18} />, path: '/billing' },
    { name: 'Debts', icon: <Bell size={18} />, path: '/debts' },
    { name: 'Expenses', icon: <DollarSign size={18} />, path: '/expenses' },
    { name: 'Procurement', icon: <Activity size={18} />, path: '/procurement' },
    { name: 'Attendance', icon: <Clock size={18} />, path: '/attendance' },
    { name: 'Reports', icon: <BarChart2 size={18} />, path: '/reports' },
    { name: 'Settings', icon: <Settings size={18} />, path: '/settings' }
  ];

  const role = profile?.role || 'Receptionist';

  const filteredMainNavItems = mainNavItems.filter(item => {
    if (role === 'Admin') return true;
    if (role === 'Doctor') {
      return ['Patients', 'Doctor Queue', 'Prescription Writer', 'Vaccinations', 'Certificates', 'Encounters', 'Referrals', 'Procedures', 'Maternity', 'Emergency'].includes(item.name);
    }
    if (role === 'Pharmacist') {
      return ['Pharmacy'].includes(item.name);
    }
    if (role === 'Lab Technician') {
      return ['Laboratory', 'Radiology'].includes(item.name);
    }
    if (role === 'Receptionist') {
      return ['Patients', 'Appointments', 'Inpatients', 'Certificates', 'Referrals', 'Procedures', 'Maternity', 'Emergency'].includes(item.name);
    }
    return false;
  });

  const filteredManagementNavItems = managementNavItems.filter(item => {
    if (role === 'Admin') return true;
    if (role === 'Receptionist') {
      return ['Billing', 'Debts', 'Attendance'].includes(item.name);
    }
    if (role === 'Doctor' || role === 'Pharmacist' || role === 'Lab Technician') {
      return ['Attendance', 'Procurement'].includes(item.name);
    }
    return false;
  });

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header-custom">
          <div className="logo-area">
            <img
              src="/logo.png"
              alt="Cayuush Clinic Logo"
              style={{
                width: '100%',
                maxWidth: '180px',
                height: 'auto',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1) drop-shadow(0 0 6px rgba(20,184,166,0.4))',
                borderRadius: '6px',
              }}
            />
          </div>
          <button className="mobile-close-btn" onClick={toggleSidebar}>
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-nav-scrollable">
          {/* Dashboard Item */}
          <div className="sidebar-nav-section-title">DASHBOARD</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><LayoutDashboard size={18} /></span>
            <span className="nav-text">Dashboard</span>
          </NavLink>

          {/* Main Section */}
          <div className="sidebar-nav-section-title">MAIN</div>
          {filteredMainNavItems.map((item) => (
            <NavLink 
              key={item.name} 
              to={item.path} 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.name}</span>
            </NavLink>
          ))}

          {/* Management Section */}
          {filteredManagementNavItems.length > 0 && (
            <>
              <div className="sidebar-nav-section-title">MANAGEMENT</div>
              {filteredManagementNavItems.map((item) => (
                <NavLink 
                  key={item.name} 
                  to={item.path} 
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.name}</span>
                </NavLink>
              ))}
            </>
          )}
          {/* Patient Portal Link (Admin Only) */}
          {role === 'Admin' && (
            <>
              <div className="sidebar-nav-section-title">PORTAL</div>
              <a href="/portal" target="_blank" rel="noreferrer" className="nav-item" style={{ textDecoration: 'none' }}>
                <span className="nav-icon">🌐</span>
                <span className="nav-text">Patient Portal</span>
              </a>
            </>
          )}
        </div>

        {/* Help & Support Card */}
        <div className="help-support-wrapper">
          <div className="help-support-card">
            <HelpCircle size={18} />
            <span>Help &amp; Support</span>
          </div>
        </div>

        {/* Footer controls */}
        <div className="sidebar-footer-controls">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        
        {/* Unified Top Header */}
        <header className="main-header-new">
          <div className="header-left">
            <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
            <div className="header-search-bar">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Search patients, appointments, invoices..." />
            </div>
          </div>
          
          <div className="header-right">
            <div style={{ position: 'relative' }}>
              <button className="icon-btn-badge" onClick={handleToggleNotifications} title="Notifications">
                <Bell size={20} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="badge-count red">{notifications.filter(n => !n.read).length}</span>
                )}
              </button>
              {isNotificationsOpen && (
                <div className="header-dropdown notifications-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="dropdown-header">
                    <h4>Notifications</h4>
                    <span className="mark-read" onClick={() => setNotifications(prev => prev.map(n => ({...n, read: true})))}>Mark all as read</span>
                  </div>
                  <div className="dropdown-items">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`dropdown-item ${!notif.read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notif)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={`item-icon-dot ${!notif.read ? 'blue' : 'gray'}`}>●</div>
                        <div className="item-content">
                          <p className="item-text"><strong>{notif.title}:</strong> {notif.desc}</p>
                          <span className="item-time">{notif.time}</span>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', fontSize: '0.82rem' }}>
                        No notifications.
                      </p>
                    )}
                  </div>
                  <div className="dropdown-footer">
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/queue'); setIsNotificationsOpen(false); }}>View all notifications</a>
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button className="icon-btn-badge" onClick={handleToggleMessages} title="Messages">
                <Mail size={20} />
                {messages.filter(m => !m.read).length > 0 && (
                  <span className="badge-count blue">{messages.filter(m => !m.read).length}</span>
                )}
              </button>
              {isMessagesOpen && (
                <div className="header-dropdown messages-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="dropdown-header">
                    <h4>Messages</h4>
                    <span className="new-msg" onClick={() => { navigate('/settings'); setIsMessagesOpen(false); }}>Profile Settings</span>
                  </div>
                  <div className="dropdown-items">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`dropdown-item ${!msg.read ? 'unread' : ''}`}
                        onClick={() => handleMessageClick(msg)}
                        style={{ cursor: 'pointer' }}
                      >
                        <img src={msg.avatar} alt="" className="item-avatar" />
                        <div className="item-content">
                          <h5 className="item-sender">{msg.sender}</h5>
                          <p className="item-text">{msg.text}</p>
                          <span className="item-time">{msg.time}</span>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', fontSize: '0.82rem' }}>
                        No messages.
                      </p>
                    )}
                  </div>
                  <div className="dropdown-footer">
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/settings'); setIsMessagesOpen(false); }}>Go to Settings</a>
                  </div>
                </div>
              )}
            </div>
            
            <div className="profile-separator"></div>

            <div style={{ position: 'relative' }}>
              <div className="header-profile-badge" onClick={handleToggleProfileMenu} title="User Profile Menu">
                {avatar ? (
                  <img 
                    src={avatar} 
                    alt="Avatar" 
                    className="profile-avatar" 
                  />
                ) : (
                  <div className="profile-avatar-initials">
                    {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="profile-details-mini">
                  <span className="profile-name">{profile?.full_name || 'User'}</span>
                  <span className="profile-role">{profile?.role || 'Staff'}</span>
                </div>
                <ChevronDown size={14} className="profile-chevron" />
              </div>

              {isProfileMenuOpen && (
                <div className="header-dropdown profile-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="profile-dropdown-header">
                    <h5 className="dropdown-user-name">{profile?.full_name || 'User'}</h5>
                    <span className="dropdown-user-email">{profile?.email || user?.email}</span>
                  </div>
                  <div className="dropdown-items-menu">
                    <div className="dropdown-menu-item" onClick={() => {
                      navigate('/settings', { state: { activeTab: 'profile' } });
                      setIsProfileMenuOpen(false);
                    }}>
                      <User size={16} />
                      <span>Profile Settings</span>
                    </div>
                    <div className="dropdown-menu-item" onClick={() => {
                      navigate('/settings', { state: { activeTab: 'clinic' } });
                      setIsProfileMenuOpen(false);
                    }}>
                      <Settings size={16} />
                      <span>System Settings</span>
                    </div>
                    <div className="dropdown-divider"></div>
                    <div className="dropdown-menu-item logout" onClick={handleLogout}>
                      <LogOut size={16} />
                      <span>Logout</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-content-wrapper">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default Layout;
