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
  const [transitioning, setTransitioning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const { setTenant } = useTenant();
  const navigate = useNavigate();

    // Read the last-used hospital slug from a cookie set at login time.
  // localStorage is wiped on logout, but cookies persist for 30 days.
  const lastHospitalSlug =
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('last_hospital_slug='))
      ?.split('=')[1] || null;
  const lastHospitalName = decodeURIComponent(
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('last_hospital_name='))
      ?.split('=')[1] || ''
  );

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

            login(token, staff);

      // Remember which hospital this user belongs to (30 days)
      try {
        const h = await api.get(`/hospitals/${staff.tenantId}`);
        if (h.data?.slug) {
          document.cookie = `last_hospital_slug=${h.data.slug}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
          if (h.data.name) {
            document.cookie = `last_hospital_name=${encodeURIComponent(h.data.name)}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
          }
        }
      } catch { /* non-fatal */ }

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

      // ── Door-opening transition ────────────────────────────────
      setTransitioning(true);
      console.log('DOORS OPENING');
await new Promise((resolve) => setTimeout(resolve, 900));
// ── End transition ─────────────────────────────────────────

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
  <>
    {/* ═══ DOOR-OPENING TRANSITION OVERLAY ═══ */}
    {transitioning && (
      <div className="door-transition">
        <div className="door-left" />
        <div className="door-right" />
      </div>
    )}

    <div className={`login-screen ${transitioning ? 'is-transitioning' : ''}`}>
      <div className="login-container">
        {/* Header */}
        <div className="login-header">
          <img src="/logo.png" alt="NexGen EMR" />
          <h1>NexGen EMR</h1>
          
          <p className="subtitle">Electronic Medical Records</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="identifier">Username or Email</label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your username or email"
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
                <div className="login-footer">
          {lastHospitalSlug && (
            <p
              className="login-footer-help"
              style={{
                background: '#eff6ff',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                fontSize: '13px',
                color: '#1e3a5f',
              }}
            >
              🏥 {lastHospitalName ? (
                <>You last logged into <strong>{lastHospitalName}</strong>.{' '}</>
              ) : (
                <>You last logged into a hospital.{' '}</>
              )}
              <Link
                to={`/h/${lastHospitalSlug}/login`}
                style={{ fontWeight: 600, color: '#0f3460' }}
              >
                Go to hospital login →
              </Link>
            </p>
          )}
          <p className="login-footer-help">
            Having trouble? Contact your hospital administrator.
          </p>
          <p className="login-footer-platform">
            Platform operator? <Link to="/platform/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  </>
    );
  }; 

export default Login;