// src/pages/HospitalLogin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import './Login.css';

const HospitalLogin = () => {
  const { hospitalSlug } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { setTenant } = useTenant();

  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHospital, setLoadingHospital] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // ✅ Fetch hospital by slug on mount
  useEffect(() => {
    const fetchHospital = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3000/api/hospitals/slug/${hospitalSlug}`
        );
        setHospital(res.data);
      } catch (error) {
        console.error('Hospital fetch failed:', error);
        setNotFound(true);
      } finally {
        setLoadingHospital(false);
      }
    };
    if (hospitalSlug) fetchHospital();
  }, [hospitalSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const trimmedIdentifier = identifier.trim();
    const isEmail = trimmedIdentifier.includes('@');

    try {
      const payload = isEmail
        ? { email: trimmedIdentifier, password, hospitalSlug }
        : { username: trimmedIdentifier.toLowerCase(), password, hospitalSlug };

      const response = await axios.post(
        'http://localhost:3000/api/auth/login',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { token, staff } = response.data;

      // ✅ Set tenant context (handles both lowercase `settings` and capital `Settings`)
      if (staff.tenantId) {
        setTenant(
          staff.tenantId,
          hospital,
          hospital?.settings || hospital?.Settings || null
        );
      }

      login(token, staff);
      navigate('/');
      toast.success(`Welcome to ${hospital?.name || 'the hospital'}!`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ============ LOADING STATE ============
  if (loadingHospital) {
    return (
      <div className="login-screen app-container">
        <div className="login-container">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner" />
            <p style={{ marginTop: '16px', color: '#6b7280' }}>
              Loading hospital...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ NOT FOUND STATE ============
  if (notFound || !hospital) {
    return (
      <div className="login-screen app-container">
        <div className="login-container" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '64px' }}>🏥</span>
          <h2 style={{ color: '#1a1a2e', marginTop: '12px' }}>
            Hospital Not Found
          </h2>
          <p style={{ color: '#6b7280' }}>
            The hospital "<code>{hospitalSlug}</code>" doesn't exist or is inactive.
          </p>
          <Link
            to="/login"
            className="btn btn-primary"
            style={{
              display: 'inline-block',
              marginTop: '16px',
              textDecoration: 'none',
              padding: '10px 24px',
            }}
          >
            ← Go to Central Login
          </Link>
        </div>
      </div>
    );
  }

  // ============ MAIN RENDER ============
  return (
    <div className="login-screen app-container">
      <div
        className="login-container"
        style={{
          borderTop: `4px solid ${hospital.primaryColor || '#0f3460'}`,
        }}
      >
        <div className="login-header">
          {hospital.logoUrl ? (
            <img
              src={hospital.logoUrl}
              alt={hospital.name}
              style={{ maxWidth: '120px', marginBottom: '12px' }}
            />
          ) : (
            <h1 style={{ color: hospital.primaryColor || '#0f3460' }}>
              🏥 {hospital.name}
            </h1>
          )}
          <p>
            {hospital.city && hospital.state
              ? `${hospital.city}, ${hospital.state}`
              : hospital.country || ''}
          </p>
          <p className="subtitle">Electronic Medical Records System</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username or Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="samuel-chris or email@domain.com"
              required
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
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              background: hospital.primaryColor || '#0f3460',
              width: '100%',
            }}
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '13px',
            color: '#9ca3af',
          }}
        >
          Wrong hospital?{' '}
          <Link
            to="/login"
            style={{ color: hospital.primaryColor || '#0f3460' }}
          >
            Go to central login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default HospitalLogin;