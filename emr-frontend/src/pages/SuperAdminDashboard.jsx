// src/pages/SuperAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { usePlatformAuth } from '../context/PlatformAuthContext';  // ✅ NEW
import './Dashboard.css';
import { clearAllSessions } from '../utils/clearAllSessions';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { token, user, logout } = usePlatformAuth();  // ✅ Platform auth, not tenant

  const [hospitals, setHospitals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', slug: '', code: '', email: '', phone: '',
    address: '', city: '', state: '', plan: 'trial'
  });

  // ✅ Reusable axios client pointed at /api/platform
  const apiClient = axios.create({
    baseURL: 'http://localhost:3000/api/platform',
  });

  // ✅ Attach token on every request (or set default headers)
  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hospitalsRes, statsRes] = await Promise.all([
        apiClient.get('/hospitals'),
        apiClient.get('/stats'),
      ]);
      setHospitals(hospitalsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      // ✅ Handle expired/invalid platform token
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/platform/login');
      } else {
        toast.error('Failed to load hospitals');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      // No platform token — bounce to login
      navigate('/platform/login');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/hospitals', formData);
      toast.success('Hospital created!');
      setShowModal(false);
      setFormData({
        name: '', slug: '', code: '', email: '', phone: '',
        address: '', city: '', state: '', plan: 'trial'
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create hospital');
    }
  };

  const handleSuspend = async (id) => {
    if (!window.confirm('Suspend this hospital? Staff will be unable to log in.')) return;
    try {
      await apiClient.patch(`/hospitals/${id}/suspend`);
      toast.success('Hospital suspended');
      fetchData();
    } catch (error) {
      toast.error('Failed to suspend');
    }
  };

  const handleReactivate = async (id) => {
    try {
      await apiClient.patch(`/hospitals/${id}/reactivate`);
      toast.success('Hospital reactivated');
      fetchData();
    } catch (error) {
      toast.error('Failed to reactivate');
    }
  };

  const handleLogout = () => {
  clearAllSessions();   
  logout();              
  navigate('/platform/login');
};

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      {/* ── Page header with actions ───────────────────── */}
      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h2 style={{ margin: 0 }}>🌐 NexGen EMR Platform — Overview</h2>
          {user && (
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
              Signed in as <strong>{user.firstName} {user.lastName}</strong> ({user.role})
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Full onboarding (hospital + admin + starter kit) */}
          <button
            className="btn btn-primary"
            onClick={() => navigate('/register-hospital')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0f3460',
              color: 'white',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '16px' }}>🚀</span>
            Register New Hospital
          </button>

          {/* Quick stub (hospital record only) */}
          <button
            className="btn btn-secondary"
            onClick={() => setShowModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#e5e7eb',
              color: '#1f2937',
              border: '1px solid #d1d5db',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '16px' }}>➕</span>
            Quick Add
          </button>

          {/* ✅ Platform logout */}
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon">🏥</div><div className="stat-info">
            <div className="stat-value">{stats.totalHospitals}</div>
            <div className="stat-label">Total Hospitals</div>
          </div></div>
          <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-info">
            <div className="stat-value">{stats.activeHospitals}</div>
            <div className="stat-label">Active</div>
          </div></div>
          <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-info">
            <div className="stat-value">{stats.totalStaff}</div>
            <div className="stat-label">Total Staff</div>
          </div></div>
          <div className="stat-card"><div className="stat-icon">👤</div><div className="stat-info">
            <div className="stat-value">{stats.totalPatients}</div>
            <div className="stat-label">Total Patients</div>
          </div></div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Slug</th><th>Code</th><th>Plan</th>
              <th>Status</th><th>Staff</th><th>Patients</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.map(h => (
              <tr key={h.id}>
                <td><strong>{h.name}</strong></td>
                <td><code>/{h.slug}</code></td>
                <td>{h.code}</td>
                <td><span className="role-badge">{h.plan}</span></td>
                <td>
                  <span className={`status-badge ${h.isActive ? 'status-active' : 'status-inactive'}`}>
                    {h.status}
                  </span>
                </td>
                <td>{h._count?.Staff || 0}</td>
                <td>{h._count?.Patient || 0}</td>
                <td>
                  <a
  href={`/h/${h.slug}/login`}
  target="_blank"
  rel="noreferrer"
  className="btn btn-sm btn-secondary"
  style={{
    background: '#e5e7eb',
    color: '#1f2937',
    padding: '4px 10px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: 600,
    marginRight: '6px',
  }}
>
  🔗 Login
</a>
                  {h.isActive ? (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleSuspend(h.id)}
                      style={{ marginLeft: '4px' }}
                    >
                      🚫 Suspend
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleReactivate(h.id)}
                      style={{ marginLeft: '4px' }}
                    >
                      ✅ Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Hospital (Quick Stub)</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#78350f',
                }}>
                  ⚠️ <strong>Quick Add</strong> creates the hospital record only.
                  No admin account or starter data will be created. For full onboarding,
                  use the <strong>Register New Hospital</strong> button instead.
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Hospital Name *</label>
                    <input type="text" value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required />
                  </div>
                  <div className="form-group">
                    <label>Slug * (url-friendly)</label>
                    <input type="text" value={formData.slug}
                      onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                      placeholder="lagos-general" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Code *</label>
                    <input type="text" value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      placeholder="LGH001" required />
                  </div>
                  <div className="form-group">
                    <label>Plan</label>
                    <select value={formData.plan}
                      onChange={e => setFormData({...formData, plan: e.target.value})}>
                      <option value="trial">Trial</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="text" value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input type="text" value={formData.state}
                      onChange={e => setFormData({...formData, state: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Hospital</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;