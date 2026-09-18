// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { setTenant } = useTenant();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    try {
      // Send as "identifier" — the backend handles email, prefixed username, or bare username
      const response = await axios.post(
        'http://localhost:3000/api/auth/login',
        { identifier: trimmedIdentifier, password: trimmedPassword },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { token, staff } = response.data;

      if (staff.tenantId) {
        // Fetch full hospital data for branding
        try {
          const hospitalRes = await axios.get(
            `http://localhost:3000/api/hospitals/${staff.tenantId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setTenant(
            staff.tenantId,
            hospitalRes.data,
            hospitalRes.data.Settings || hospitalRes.data.settings
          );
        } catch (err) {
          // Fallback: just the ID
          console.error('Failed to fetch hospital details:', err);
          setTenant(staff.tenantId);
        }
      }

      login(token, staff);
      navigate('/');
      toast.success(`Welcome, ${staff.firstName}!`);
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 409 && data?.code === 'AMBIGUOUS_USERNAME') {
        toast.error(
          data.error ||
            'This username exists in multiple hospitals. Please include your hospital prefix (e.g., caretech-admin).'
        );
      } else {
        const message = data?.error || 'Login failed. Try again.';
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen app-container">
      <div className="login-container">
        <div className="login-header">
          <h1>🏥 NexGen EMR</h1>
          <p>Medical Centre, Lagos</p>
          <p className="subtitle">Electronic Medical Records System</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username or Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g., caretech-admin"
              required
              autoComplete="username"
            />
            <small
              style={{
                color: '#9ca3af',
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
              }}
            >
              Your username starts with your hospital prefix.
              <br />
              You can also use your email address.
            </small>
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

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '13px',
            color: '#6b7280',
          }}
        >
          Prefer a hospital-specific login? Ask your admin for your hospital URL (e.g.{' '}
          /h/your-hospital/login).
        </p>

        <p
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '12px',
            color: '#9ca3af',
          }}
        >
          Platform operator?{' '}
          <Link to="/platform/login" style={{ color: '#dc2626' }}>
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;