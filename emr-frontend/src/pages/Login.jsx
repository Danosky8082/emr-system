// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import api from '../api/client';
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
      // ─────────────────────────────────────────────────────────
      // 1. Authenticate — backend accepts email, prefixed
      //    username ("caretech-admin"), or bare username ("admin").
      // ─────────────────────────────────────────────────────────
      const response = await api.post('/auth/login', {
        identifier: trimmedIdentifier,
        password: trimmedPassword,
      });

      const { token, staff } = response.data;

      if (!token || !staff) {
        toast.error('Login response was missing a token or staff record.');
        return;
      }

      // ─────────────────────────────────────────────────────────
      // 2. Save the token FIRST so the api client picks it up
      //    from localStorage on the next request.
      // ─────────────────────────────────────────────────────────
      login(token, staff);

      // ─────────────────────────────────────────────────────────
      // 3. Fetch the hospital record for branding (name, colors,
      //    logo, settings). Non-blocking — if it fails, we still
      //    let the user in with the tenantId only.
      // ─────────────────────────────────────────────────────────
      if (staff.tenantId) {
        try {
          const hospitalRes = await api.get(`/hospitals/${staff.tenantId}`);
          const settings =
            hospitalRes.data?.Settings ||
            hospitalRes.data?.settings ||
            null;

          setTenant(staff.tenantId, hospitalRes.data, settings);
        } catch (err) {
          console.warn('Failed to fetch hospital details:', err.message);
          setTenant(staff.tenantId);
        }
      }

      // ─────────────────────────────────────────────────────────
      // 4. Redirect and greet
      // ─────────────────────────────────────────────────────────
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
        const message = data?.error || 'Login failed. Please try again.';
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen app-container">
      <div className="login-container">
        <div className="login-header" style={{ textAlign: 'center' }}>
  <img
    src="/logo.png"
    alt="NexGen EMR"
    style={{
      width: '88px',
      height: '88px',
      objectFit: 'contain',
      marginBottom: '12px',
      filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
    }}
  />
  <h1 style={{ marginBottom: '4px' }}>NexGen EMR</h1>
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
  placeholder="Username, Employee ID, or Email"
              required
              autoComplete="username"
            />
            <small style={{ color: '#9ca3af', display: 'block', marginTop: '4px', fontSize: '12px' }}>
  You can log in with:
  <br />
  • Your <strong>username</strong> (e.g. caretech-admin)
  <br />
  • Your <strong>Employee ID</strong> (e.g. ADMIN001)
  <br />
  • Your <strong>email</strong> (e.g. admin@hospital.com)
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
          Prefer a hospital-specific login? Ask your admin for your hospital URL
          (e.g. /h/your-hospital/login).
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