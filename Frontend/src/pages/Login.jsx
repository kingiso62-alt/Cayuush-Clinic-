import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, Users, Calendar as CalIcon, FlaskConical, Pill, ShieldCheck } from 'lucide-react';
import './Login.css'; 

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      // login handles setting context, useEffect will catch and navigate
    } catch (err) {
      setError(err.message || 'Invalid login credentials. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className={`login-container-new ${shake ? 'shake-animation' : ''}`}>
        
        {/* Left Side: Brand & Background */}
        <div className="login-brand-new">
          <div className="brand-content-new">
            <img src="/logo.png" alt="Cayuush Clinic Logo" className="clinic-logo-new" />
            
            <div className="brand-tagline-new">
              <h2>Advanced Medical Management System</h2>
            </div>
            
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon bg-pink">
                  <Users size={20} color="#d94c9e" />
                </div>
                <span>Patients Management</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon bg-green">
                  <CalIcon size={20} color="#1a7b44" />
                </div>
                <span>Appointments Scheduling</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon bg-purple">
                  <FlaskConical size={20} color="#8b5cf6" />
                </div>
                <span>Laboratory System</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon bg-blue">
                  <Pill size={20} color="#0ea5e9" />
                </div>
                <span>Pharmacy Management</span>
              </div>
            </div>
          </div>
          <div className="brand-bg-image"></div>
        </div>

        {/* Right Side: Form */}
        <div className="login-form-wrapper-new">
          <div className="form-header-new">
            <div className="shield-icon">
              <ShieldCheck size={32} color="#10B981" />
            </div>
            <h2>Welcome <span className="text-green">Back</span></h2>
            <p>Please enter your details to sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-new">
            <div className="input-group-new">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper-new">
                <div className="icon-box">
                  <Mail size={18} color="white" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cayuush.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="input-group-new">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper-new">
                <div className="icon-box">
                  <Lock size={18} color="white" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
                <button 
                  type="button" 
                  className="password-toggle-new"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-options-new">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              {/* Forgot Password Link Removed as Requested */}
            </div>

            <button 
              type="submit" 
              className={`login-submit-btn-new ${isLoading ? 'loading' : ''}`}
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={18} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  Sign In <span style={{marginLeft: '8px'}}>→</span>
                </>
              )}
            </button>
          </form>

          {/* Social Logins Removed as Requested */}
          
          <div className="secure-badge-bottom-new">
            <p><ShieldCheck size={14} color="#10B981" style={{marginRight: '4px'}} /> Secure login powered by <span className="text-green font-bold">Cayuush IT Dept</span></p>
            <p className="text-muted">All data is encrypted and secure 🔒</p>
          </div>

          {/* Error Toast */}
          <div className={`error-toast ${error ? 'show' : ''}`}>
            {error}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
