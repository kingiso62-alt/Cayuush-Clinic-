import React, { useState, useEffect } from 'react';
import { Save, Building2, User, Moon, Sun, Monitor, Loader2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

const Settings = () => {
  const { user, profile, refreshProfile } = useAuth();
  
  const [activeTab, setActiveTab] = useState('clinic');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Clinic Settings
  const [clinicSettings, setClinicSettings] = useState({
    id: null,
    clinic_name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: 'USD'
  });

  // User Profile State
  const [profileState, setProfileState] = useState({
    full_name: '',
    email: user?.email || '',
    phone: ''
  });

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem('cayush-theme') || 'system');

  // Avatar State
  const [avatar, setAvatar] = useState('');

  // Password States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchProfile();
    if (user?.id) {
      setAvatar(localStorage.getItem(`cayush-avatar-${user.id}`) || '');
    }
  }, [user]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('clinic_settings').select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error; // Ignore not found error initially
      
      if (data) {
        setClinicSettings(data);
      }
    } catch (error) {
      console.error('Error fetching clinic settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      if (data) {
        setProfileState({
          full_name: data.full_name || '',
          email: data.email || user.email,
          phone: data.phone || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleClinicChange = (e) => {
    setClinicSettings({ ...clinicSettings, [e.target.name]: e.target.value });
  };

  const handleProfileChange = (e) => {
    setProfileState({ ...profileState, [e.target.name]: e.target.value });
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('cayush-theme', newTheme);
    
    // Apply theme immediately
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        localStorage.setItem(`cayush-avatar-${user.id}`, base64);
        setAvatar(base64);
        window.dispatchEvent(new Event('avatar-changed'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    localStorage.removeItem(`cayush-avatar-${user.id}`);
    setAvatar('');
    window.dispatchEvent(new Event('avatar-changed'));
  };

  const saveClinicSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (clinicSettings.id) {
        // Update
        const { error } = await supabase
          .from('clinic_settings')
          .update({
            clinic_name: clinicSettings.clinic_name,
            address: clinicSettings.address,
            phone: clinicSettings.phone,
            email: clinicSettings.email,
            website: clinicSettings.website,
            currency: clinicSettings.currency,
            updated_by: user.id
          })
          .eq('id', clinicSettings.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('clinic_settings')
          .insert([{
            clinic_name: clinicSettings.clinic_name,
            address: clinicSettings.address,
            phone: clinicSettings.phone,
            email: clinicSettings.email,
            website: clinicSettings.website,
            currency: clinicSettings.currency,
            updated_by: user.id
          }]);
        if (error) throw error;
        fetchSettings(); // Re-fetch to get ID
      }
      alert('Clinic settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfileSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileState.full_name,
          phone: profileState.phone
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile(); // Refresh AuthContext so Sidebar/Header re-renders!
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError('');
    setPasswordStatus('');

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setPasswordStatus('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Error changing password:', err);
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-layout" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
        <Loader2 className="spinner" size={40} color="var(--primary-brand)" />
      </div>
    );
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div className="page-title">
          <h1>System Settings</h1>
          <p>Manage clinic preferences, your profile, and system behavior</p>
        </div>
      </div>

      <div className="settings-container">
        {/* Settings Sidebar */}
        <div className="settings-sidebar">
          <button 
            className={`settings-tab ${activeTab === 'clinic' ? 'active' : ''}`}
            onClick={() => setActiveTab('clinic')}
          >
            <Building2 size={18} /> Clinic Information
          </button>
          <button 
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} /> My Profile
          </button>
          <button 
            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Monitor size={18} /> Appearance
          </button>
          {profile?.role === 'Admin' && (
            <button 
              className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={18} /> Security & Roles
            </button>
          )}
        </div>

        {/* Settings Content */}
        <div className="settings-content">
          
          {/* CLINIC SETTINGS */}
          {activeTab === 'clinic' && (
            <div className="fade-in">
              <h2>Clinic Information</h2>
              <p className="text-muted" style={{marginBottom: '24px'}}>These details appear on patient invoices, prescriptions, and reports.</p>
              
              <form onSubmit={saveClinicSettings}>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Clinic Name</label>
                    <input type="text" className="premium-input" name="clinic_name" value={clinicSettings.clinic_name} onChange={handleClinicChange} required />
                  </div>
                  <div className="form-group full">
                    <label>Physical Address</label>
                    <input type="text" className="premium-input" name="address" value={clinicSettings.address} onChange={handleClinicChange} />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="text" className="premium-input" name="phone" value={clinicSettings.phone} onChange={handleClinicChange} />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" className="premium-input" name="email" value={clinicSettings.email} onChange={handleClinicChange} />
                  </div>
                  <div className="form-group">
                    <label>Website</label>
                    <input type="text" className="premium-input" name="website" value={clinicSettings.website || ''} onChange={handleClinicChange} />
                  </div>
                  <div className="form-group">
                    <label>Default Currency</label>
                    <select className="premium-input" name="currency" value={clinicSettings.currency} onChange={handleClinicChange}>
                      <option value="USD">USD ($)</option>
                      <option value="SOS">SOS (Sh.So)</option>
                    </select>
                  </div>
                </div>
                
                <div style={{marginTop: '32px', display: 'flex', justifyContent: 'flex-end'}}>
                  <button type="submit" className="premium-btn" disabled={isSaving}>
                    {isSaving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <div className="fade-in">
              <h2>My Profile</h2>
              <p className="text-muted" style={{marginBottom: '24px'}}>Manage your personal account details.</p>
              
              {/* Profile Picture Upload Header */}
              <div style={{display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px'}}>
                {avatar ? (
                  <img 
                    src={avatar} 
                    alt="Avatar Preview" 
                    style={{width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-blue)'}} 
                  />
                ) : (
                  <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue) 0%, #1D4ED8 100%)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', fontWeight: 'bold'}}>
                    {profileState.full_name ? profileState.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div>
                  <h3 style={{fontSize: '1.2rem', color: 'var(--text-main)', margin: '0'}}>{profileState.full_name}</h3>
                  <p style={{color: 'var(--text-muted)', margin: '2px 0 12px 0'}}>{profile?.role || 'Staff'}</p>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <label className="btn-secondary-custom" style={{padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer', display: 'inline-block'}}>
                      Upload Photo
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{display: 'none'}} />
                    </label>
                    {avatar && (
                      <button type="button" className="btn-secondary-custom" style={{padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', color: 'var(--accent-red)'}} onClick={handleRemoveAvatar}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Details Edit Form */}
              <form onSubmit={saveProfileSettings}>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Full Name</label>
                    <input type="text" className="premium-input" name="full_name" value={profileState.full_name} onChange={handleProfileChange} required />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" className="premium-input" name="email" value={profileState.email} disabled style={{opacity: 0.7}} />
                    <small style={{color: 'var(--text-muted)', marginTop: '4px', display: 'block'}}>Email cannot be changed.</small>
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="text" className="premium-input" name="phone" value={profileState.phone} onChange={handleProfileChange} />
                  </div>
                </div>
                
                <div style={{marginTop: '20px', display: 'flex', justifyContent: 'flex-end'}}>
                  <button type="submit" className="premium-btn" disabled={isSaving}>
                    {isSaving ? 'Saving...' : <><Save size={16} /> Update Profile</>}
                  </button>
                </div>
              </form>

              <div className="doc-divider" style={{margin: '32px 0', height: '1px', backgroundColor: 'var(--border-color)'}}></div>

              {/* CHANGE PASSWORD FORM */}
              <h2>Change Password</h2>
              <p className="text-muted" style={{marginBottom: '20px'}}>Update your account password securely.</p>
              
              {passwordError && <div className="error-alert-box">{passwordError}</div>}
              {passwordStatus && <div style={{backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--primary-brand)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '20px'}}>{passwordStatus}</div>}

              <form onSubmit={handlePasswordChange}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>New Password</label>
                    <input 
                      type="password" 
                      className="premium-input" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="Min 6 characters"
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <input 
                      type="password" 
                      className="premium-input" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="Repeat new password"
                      required 
                    />
                  </div>
                </div>
                
                <div style={{marginTop: '20px', display: 'flex', justifyContent: 'flex-end'}}>
                  <button type="submit" className="premium-btn" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* APPEARANCE SETTINGS */}
          {activeTab === 'appearance' && (
            <div className="fade-in">
              <h2>Appearance</h2>
              <p className="text-muted" style={{marginBottom: '24px'}}>Customize how the system looks on this device.</p>
              
              <div className="theme-options">
                <div 
                  className={`theme-card ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <div className="theme-preview light">
                    <Sun size={24} color="#F59E0B" />
                  </div>
                  <h4>Light Mode</h4>
                </div>

                <div 
                  className={`theme-card ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <div className="theme-preview dark">
                    <Moon size={24} color="#60A5FA" />
                  </div>
                  <h4>Dark Mode</h4>
                </div>

                <div 
                  className={`theme-card ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('system')}
                >
                  <div className="theme-preview system">
                    <Monitor size={24} color="var(--text-main)" />
                  </div>
                  <h4>System Default</h4>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="fade-in">
              <h2>Security & User Management</h2>
              <p className="text-muted" style={{marginBottom: '24px'}}>This section is currently read-only in the application. To add new users or change passwords, please use the Supabase Dashboard directly.</p>
              
              <div style={{padding: '24px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px'}}>
                <h4 style={{color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                  <Shield size={18} /> Admin Access Required
                </h4>
                <p style={{color: 'var(--text-main)', fontSize: '0.95rem'}}>
                  User authentication and role assignments are securely managed via Supabase Auth.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
