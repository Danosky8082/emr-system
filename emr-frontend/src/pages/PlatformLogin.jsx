// src/pages/PlatformLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import './Login.css';
import api from '../api/client';

const PlatformLogin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = usePlatformAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/platform/login', {
        identifier: identifier.trim(),
        password,
      });
      login(res.data.token, res.data.user);
      toast.success(`Welcome, ${res.data.user.firstName}!`);
      navigate('/super-admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen app-container">
      <div className="login-container" style={{ borderTop: '4px solid #dc2626' }}>
        <div className="login-header" style={{ textAlign: 'center' }}>
  <img
    src="/logo.png"
    alt="NexGen EMR"
    style={{
      width: '72px',
      height: '72px',
      objectFit: 'contain',
      marginBottom: '10px',
      filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
    }}
  />
  <h1 style={{ color: '#dc2626', marginTop: 0 }}>Platform Access</h1>
  <p className="subtitle">Restricted — NexGen EMR operators only</p>
</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username or Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="platform-admin"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ background: '#dc2626', color: 'white' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#9ca3af' }}>
          Tenant staff should use <a href="/login" style={{ color: '#0f3460' }}>the main login</a>.
        </p>
      </div>
    </div>
  );
};

export default PlatformLogin;