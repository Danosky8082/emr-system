// src/pages/SuperAdminDashboard.jsx
//
// ============================================================
// ⚠️  PRE-LAUNCH TODO — TRIAL ENFORCEMENT
//
// The "trial" plan is currently INFORMATIONAL ONLY. This component
// displays the trial countdown in the Plan column, but nothing
// actually blocks a hospital when their trial expires.
//
// When you're ready to launch (see docs/trial-enforcement.md):
//   1. Add enforceTenantStatus() middleware in server.js
//      → blocks API calls with 402 TRIAL_EXPIRED
//   2. Add a trial banner to Layout.jsx
//      → warns staff when days remaining <= 7
//   3. Add a 402 interceptor to axios
//      → redirects to /upgrade when trial expires
//
// Nothing in THIS file needs to change for enforcement to work —
// it already surfaces trial status correctly.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import './Dashboard.css';
import { clearAllSessions } from '../utils/clearAllSessions';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { token, user, logout } = usePlatformAuth();

  // ============================================================
  // TAB STATE
  // ============================================================
  const [activeTab, setActiveTab] = useState('hospitals'); // 'hospitals' | 'users'

  // ============================================================
  // HOSPITAL STATE
  // ============================================================
  const [hospitals, setHospitals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', slug: '', code: '', email: '', phone: '',
    address: '', city: '', state: '', plan: 'trial',
  });

  // ============================================================
  // PLATFORM USERS STATE
  // ============================================================
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'PlatformSupport',
  });

  // ============================================================
  // AXIOS CLIENT (single instance + request interceptor)
  //
  // ✅ useMemo ensures ONE axios instance lives for the component's
  //    lifetime — so every request (GET, POST, PATCH, DELETE) uses
  //    the same client.
  //
  // ✅ The request interceptor reads the token FRESH on every request,
  //    so even after state updates / re-renders, the Authorization
  //    header is always attached.
  // ============================================================
  const apiClient = useMemo(() => {
    const client = axios.create({
      baseURL: 'http://localhost:3000/api/platform',
    });

    client.interceptors.request.use((config) => {
      // Prefer the in-memory token, fall back to localStorage
      const currentToken = token || localStorage.getItem('platform_token');
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    });

    return client;
  }, [token]);

  // ============================================================
  // HOSPITAL DATA
  // ============================================================
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

  // ============================================================
  // PLATFORM USERS DATA
  // ============================================================
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/platform/login');
      } else {
        toast.error('Failed to load platform users');
      }
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      fetchUsers();
    } else {
      navigate('/platform/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ============================================================
  // HOSPITAL HANDLERS
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/hospitals', formData);
      toast.success(`Hospital created with ${res.data?._meta?.rolesCreated ?? 20} role permissions!`);
      setShowModal(false);
      setFormData({
        name: '', slug: '', code: '', email: '', phone: '',
        address: '', city: '', state: '', plan: 'trial',
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

  const handleBackfillPermissions = async () => {
    if (!window.confirm(
      'Recreate role permissions for ALL hospitals?\n\n' +
      'This will DELETE and recreate every RolePermission row for every hospital ' +
      'using the canonical 20-role template.\n\n' +
      'Use this only if permissions look broken.'
    )) return;

    try {
      const res = await apiClient.post('/backfill-permissions');
      const total = res.data.results.reduce((sum, r) => sum + r.rolesCreated, 0);
      toast.success(`Fixed permissions for ${res.data.results.length} hospitals (${total} roles recreated)`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Backfill failed');
    }
  };

  // ============================================================
  // PLATFORM USER HANDLERS
  // ============================================================
  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!userForm.username || !userForm.email || !userForm.password || !userForm.firstName || !userForm.lastName) {
      toast.error('All fields are required');
      return;
    }

    if (userForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await apiClient.post('/users', userForm);
      toast.success(`✅ Platform user "${userForm.username}" created!`);
      setShowUserModal(false);
      setUserForm({
        username: '', email: '', password: '',
        firstName: '', lastName: '', role: 'PlatformSupport',
      });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create platform user');
    }
  };

  const handleToggleActive = async (u) => {
    if (u.id === user?.id) {
      toast.error('You cannot deactivate yourself');
      return;
    }
    if (!window.confirm(`${u.isActive ? 'Deactivate' : 'Activate'} ${u.username}?`)) return;
    try {
      await apiClient.patch(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleChangeRole = async (u, newRole) => {
    if (u.id === user?.id && newRole !== 'PlatformAdmin') {
      toast.error('You cannot change your own role');
      return;
    }
    try {
      await apiClient.patch(`/users/${u.id}`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update role');
    }
  };

  const handleResetUserPassword = async (u) => {
    const newPassword = prompt(
      `Enter new password for ${u.username} (minimum 8 characters):`
    );
    if (!newPassword) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await apiClient.post(`/users/${u.id}/reset-password`, { newPassword });
      toast.success(`Password reset for ${u.username}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================
  const handleLogout = () => {
    clearAllSessions();
    logout();
    navigate('/platform/login');
  };

  // ============================================================
  // HELPERS
  // ============================================================
  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-NG', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ────────────────────────────────────────────────────────────
  // Trial status — INFORMATIONAL ONLY while developing.
  // Currently just renders a colored badge (Xd left / expired).
  // When enforcement is enabled, this same data will drive the
  // trial banner in Layout.jsx and the 402 interceptor.
  // ────────────────────────────────────────────────────────────
  const getTrialStatus = (h) => {
    if (h.plan !== 'trial' || !h.trialEndsAt) {
      return { label: h.plan, color: '#6b7280', bg: '#f3f4f6' };
    }
    const daysLeft = Math.ceil(
      (new Date(h.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft < 0) {
      return { label: 'Trial expired', color: '#991b1b', bg: '#fee2e2' };
    }
    if (daysLeft <= 3) {
      return { label: `${daysLeft}d left`, color: '#92400e', bg: '#fef3c7' };
    }
    return { label: `${daysLeft}d left`, color: '#065f46', bg: '#d1fae5' };
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      PlatformAdmin: { bg: '#fee2e2', color: '#991b1b' },
      PlatformSupport: { bg: '#dbeafe', color: '#1e40af' },
      PlatformBilling: { bg: '#fef3c7', color: '#92400e' },
    };
    return colors[role] || { bg: '#f3f4f6', color: '#374151' };
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      {/* ============ PAGE HEADER ============ */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>🌐 NexGen EMR Platform — Overview</h2>
          {user && (
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
              Signed in as <strong>{user.firstName} {user.lastName}</strong> ({user.role})
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {activeTab === 'hospitals' && (
            <>
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

              <button
                onClick={handleBackfillPermissions}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fcd34d',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Recreate role permissions for all hospitals using the canonical template"
              >
                🔧 Fix Permissions
              </button>
            </>
          )}

          {activeTab === 'users' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowUserModal(true)}
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
              <span style={{ fontSize: '16px' }}>➕</span>
              Add Platform User
            </button>
          )}

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
            🚪 Logout
          </button>
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          padding: '6px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          maxWidth: '500px',
        }}
      >
        <button
          onClick={() => setActiveTab('hospitals')}
          style={{
            flex: 1,
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            background: activeTab === 'hospitals' ? '#0f3460' : 'transparent',
            color: activeTab === 'hospitals' ? 'white' : '#6b7280',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🏥 Hospitals ({hospitals.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            flex: 1,
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            background: activeTab === 'users' ? '#0f3460' : 'transparent',
            color: activeTab === 'users' ? 'white' : '#6b7280',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          👥 Platform Users ({users.length})
        </button>
      </div>

      {/* ============================================================
          HOSPITALS TAB
          ============================================================ */}
      {activeTab === 'hospitals' && (
        <>
          {stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🏥</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalHospitals}</div>
                  <div className="stat-label">Total Hospitals</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.activeHospitals}</div>
                  <div className="stat-label">Active</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalStaff}</div>
                  <div className="stat-label">Total Staff</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👤</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalPatients}</div>
                  <div className="stat-label">Total Patients</div>
                </div>
              </div>
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Code</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Staff</th>
                  <th>Patients</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map((h) => {
                  const trial = getTrialStatus(h);
                  return (
                    <tr key={h.id}>
                      <td>
                        <strong>{h.name}</strong>
                        {h.usernamePrefix && (
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            prefix: <code>{h.usernamePrefix}</code>
                          </div>
                        )}
                      </td>
                      <td>
                        <code>/{h.slug}</code>
                      </td>
                      <td>{h.code}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            background: trial.bg,
                            color: trial.color,
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {h.plan}
                          {h.plan === 'trial' && (
                            <span style={{ marginLeft: '6px', opacity: 0.8 }}>
                              • {trial.label}
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            h.isActive ? 'status-active' : 'status-inactive'
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td>{h._count?.Staff || 0}</td>
                      <td>{h._count?.Patient || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <a
                            href={`/h/${h.slug}/login`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: '#e5e7eb',
                              color: '#1f2937',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            🔗 Login
                          </a>
                          {h.isActive ? (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleSuspend(h.id)}
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                            >
                              🚫 Suspend
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleReactivate(h.id)}
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                            >
                              ✅ Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {hospitals.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center">
                      No hospitals registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ============================================================
          PLATFORM USERS TAB
          ============================================================ */}
      {activeTab === 'users' && (
        <>
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: '#1e3a5f',
            }}
          >
            <span style={{ fontSize: '20px' }}>🔐</span>
            <div>
              <strong>Platform Users</strong> have cross-tenant access to manage
              hospitals, view stats, and onboard new hospitals. Be careful who you
              grant <strong>PlatformAdmin</strong> to — they have full control.
            </div>
          </div>

          {usersLoading ? (
            <div className="spinner" />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const roleColors = getRoleBadgeColor(u.role);
                    const isSelf = u.id === user?.id;
                    return (
                      <tr
                        key={u.id}
                        style={isSelf ? { background: '#f0f9ff' } : undefined}
                      >
                        <td>
                          <code>{u.username}</code>
                          {isSelf && (
                            <span
                              style={{
                                marginLeft: '8px',
                                fontSize: '10px',
                                background: '#0f3460',
                                color: 'white',
                                padding: '1px 8px',
                                borderRadius: '10px',
                                fontWeight: 600,
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </td>
                        <td>
                          {u.firstName} {u.lastName}
                        </td>
                        <td style={{ fontSize: '13px', color: '#6b7280' }}>
                          {u.email}
                        </td>
                        <td>
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u, e.target.value)}
                            disabled={isSelf}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: roleColors.bg,
                              color: roleColors.color,
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: isSelf ? 'not-allowed' : 'pointer',
                              opacity: isSelf ? 0.6 : 1,
                            }}
                          >
                            <option value="PlatformAdmin">PlatformAdmin</option>
                            <option value="PlatformSupport">PlatformSupport</option>
                            <option value="PlatformBilling">PlatformBilling</option>
                          </select>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              u.isActive ? 'status-active' : 'status-inactive'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#6b7280' }}>
                          {formatDate(u.lastLogin)}
                        </td>
                        <td>
                          <div
                            style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}
                          >
                            <button
                              onClick={() => handleResetUserPassword(u)}
                              style={{
                                background: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🔑 Reset PW
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleToggleActive(u)}
                                style={{
                                  background: u.isActive ? '#ef4444' : '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {u.isActive ? '🚫 Deactivate' : '✅ Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center">
                        No platform users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ============================================================
          HOSPITAL QUICK-ADD MODAL
          ============================================================ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Create New Hospital (Quick Stub)</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#78350f',
                  }}
                >
                  ⚠️ <strong>Quick Add</strong> creates the hospital record + the
                  default 20 role permission matrix. It does NOT create an admin
                  account. Use <strong>Register New Hospital</strong> for full
                  onboarding (hospital + admin + starter data).
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Hospital Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Slug * (url-friendly)</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                        })
                      }
                      placeholder="lagos-general"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Code *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="LGH001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Plan</label>
                    <select
                      value={formData.plan}
                      onChange={(e) =>
                        setFormData({ ...formData, plan: e.target.value })
                      }
                    >
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
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          ADD PLATFORM USER MODAL
          ============================================================ */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '550px' }}
          >
            <div className="modal-header">
              <h3>➕ Add Platform User</h3>
              <button
                className="modal-close"
                onClick={() => setShowUserModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#1e3a5f',
                  }}
                >
                  🔐 Platform users can access the Super Admin dashboard to manage
                  hospitals across all tenants.
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={userForm.firstName}
                      onChange={(e) =>
                        setUserForm({ ...userForm, firstName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={userForm.lastName}
                      onChange={(e) =>
                        setUserForm({ ...userForm, lastName: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    placeholder="e.g., platform-support-1"
                    required
                  />
                  <small style={{ color: '#6b7280' }}>
                    Lowercase letters, numbers, and dashes only
                  </small>
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm({ ...userForm, email: e.target.value })
                    }
                    placeholder="user@nexgen.health"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                  <small style={{ color: '#6b7280' }}>
                    Share securely — user can change it after first login
                  </small>
                </div>

                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value })
                    }
                    required
                  >
                    <option value="PlatformAdmin">
                      PlatformAdmin — Full access (hospitals + users)
                    </option>
                    <option value="PlatformSupport">
                      PlatformSupport — Hospital management only
                    </option>
                    <option value="PlatformBilling">
                      PlatformBilling — Billing & subscription management
                    </option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUserModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Platform User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;