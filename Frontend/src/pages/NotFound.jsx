import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--bg-base)',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '20px',
        background: 'rgba(245,158,11,0.1)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <AlertTriangle size={40} color="#F59E0B" />
      </div>

      <h1 style={{
        fontSize: '6rem',
        fontWeight: '900',
        background: 'linear-gradient(135deg, var(--primary-brand), #3B82F6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1,
        marginBottom: '8px'
      }}>
        404
      </h1>

      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '12px' }}>
        Page Not Found
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '380px', marginBottom: '32px' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>

      <button
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--primary-brand)',
          color: 'white',
          border: 'none',
          padding: '14px 28px',
          borderRadius: '14px',
          fontWeight: '600',
          fontSize: '1rem',
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(16,185,129,0.3)',
          transition: 'all 0.2s'
        }}
      >
        <Home size={18} /> Back to Dashboard
      </button>
    </div>
  );
};

export default NotFound;
