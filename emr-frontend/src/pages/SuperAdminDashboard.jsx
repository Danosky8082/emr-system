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
//   2. Add a trial banner to Layout.jsx
//   3. Add a 402 interceptor to axios
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import api from '../api/client';
import './Dashboard.css';
import { clearAllSessions } from '../utils/clearAllSessions';
import { QRCodeSVG } from 'qrcode.react';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { token, user, logout } = usePlatformAuth();

  // ============================================================
  // TAB STATE
  // ============================================================
  const [activeTab, setActiveTab] = useState('hospitals');

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
  // ONBOARDING LINK STATE
  // ============================================================
  const [onboardingLinkFor, setOnboardingLinkFor] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingView, setOnboardingView] = useState('link'); // 'link' | 'qr'

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
  // API CLIENT
  // ============================================================
  const apiClient = api;

  // ============================================================
  // HOSPITAL DATA
  // ============================================================
  const fetchData = async () => {
    setLoading(true);
    try {
      const [hospitalsRes, statsRes] = await Promise.all([
        apiClient.get('/platform/hospitals'),
        apiClient.get('/platform/stats'),
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
      const res = await apiClient.get('/platform/users');
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
      const res = await apiClient.post('/platform/hospitals', formData);
      toast.success(
        `Hospital created with ${res.data?._meta?.rolesCreated ?? 20} role permissions!`
      );
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
      await apiClient.patch(`/platform/hospitals/${id}/suspend`);
      toast.success('Hospital suspended');
      fetchData();
    } catch (error) {
      toast.error('Failed to suspend');
    }
  };

  const handleReactivate = async (id) => {
    try {
      await apiClient.patch(`/platform/hospitals/${id}/reactivate`);
      toast.success('Hospital reactivated');
      fetchData();
    } catch (error) {
      toast.error('Failed to reactivate');
    }
  };

  // ============================================================
  // ONBOARDING LINK HANDLER — MUST live inside the component
  // so it can call setOnboardingLinkFor / setOnboardingData / etc.
  // ============================================================
  const handleGetOnboardingLink = async (hospital) => {
    setOnboardingLinkFor(hospital);
    setOnboardingData(null);
    setOnboardingView('link');   // always open on the Copy & Paste tab
    setOnboardingLoading(true);

    try {
      const res = await apiClient.post(
        `/platform/hospitals/${hospital.id}/onboarding-link`
      );
      setOnboardingData(res.data);
    } catch (error) {
      const msg =
        (typeof error.response?.data === 'object' && error.response?.data?.error) ||
        error.message ||
        'Failed to generate onboarding link';
      toast.error(msg);
      setOnboardingLinkFor(null);
    } finally {
      setOnboardingLoading(false);
    }
  };

  // ✅ Update auto-advance setting
  const handleAutoAdvanceChange = async (hospitalId, value) => {
    const normalized = value === '' ? null : parseInt(value, 10);

    if (normalized !== null && (isNaN(normalized) || normalized < 1 || normalized > 1440)) {
      toast.error('Must be between 1 and 1440 minutes');
      return;
    }

    try {
      await apiClient.patch(`/platform/hospitals/${hospitalId}/settings`, {
        autoAdvanceBillingAfterMinutes: normalized,
      });
      toast.success(
        normalized
          ? `Auto-advance set to ${normalized} minute(s)`
          : 'Auto-advance disabled (manual click required)'
      );
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update setting');
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
      const res = await apiClient.post('/platform/backfill-permissions');
      const total = res.data.results.reduce((sum, r) => sum + r.rolesCreated, 0);
      toast.success(`Fixed permissions for ${res.data.results.length} hospitals (${total} roles recreated)`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Backfill failed');
    }
  };

  const handleBackfillStarterData = async () => {
    if (!window.confirm(
      'Recreate clinics, wards, departments, services, and configs for ALL hospitals?\n\n' +
      'This will DELETE and recreate all starter data using the canonical templates.\n\n' +
      'Use this only if a hospital is missing starter data.'
    )) return;

    try {
      const res = await apiClient.post('/platform/backfill-starter-data');
      const summary = res.data.results
        .map(r => `  • ${r.hospital}: ${r.clinics}c / ${r.wards}w / ${r.departments}d / ${r.services}s / ${r.configs}cfg`)
        .join('\n');
      toast.success(`Fixed starter data for ${res.data.results.length} hospitals`);
      console.log('Starter data backfill results:\n' + summary);
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
      await apiClient.post('/platform/users', userForm);
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
      await apiClient.patch(`/platform/users/${u.id}`, { isActive: !u.isActive });
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
      await apiClient.patch(`/platform/users/${u.id}`, { role: newRole });
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
      await apiClient.post(`/platform/users/${u.id}/reset-password`, { newPassword });
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

        <div className="platform-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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

              <button
                onClick={handleBackfillStarterData}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#dbeafe',
                  color: '#1e40af',
                  border: '1px solid #93c5fd',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Recreate clinics, wards, departments, services, and configs for all hospitals"
              >
                📦 Fix Starter Data
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
                  <th style={{ minWidth: '160px' }}>Name</th>
                  <th>Slug</th>
                  <th>Code</th>
                  <th style={{ minWidth: '80px' }}>Plan</th>
                  <th>Status</th>
                  <th>Staff</th>
                  <th>Patients</th>
                  <th title="Auto-advance PENDING_BILLING → BILLING_CLEARED after N minutes (empty = disabled)">⏱️ Auto-Advance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map((h) => {
                  const trial = getTrialStatus(h);
                  const autoAdvanceValue = h.Settings?.autoAdvanceBillingAfterMinutes ?? '';
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            min="1"
                            max="1440"
                            placeholder="Off"
                            defaultValue={autoAdvanceValue}
                            onBlur={(e) => {
                              const newValue = e.target.value.trim();
                              const currentValue = autoAdvanceValue === '' ? '' : String(autoAdvanceValue);
                              if (newValue !== currentValue) {
                                handleAutoAdvanceChange(h.id, newValue);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            style={{
                              width: '70px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '13px',
                              textAlign: 'center',
                            }}
                            title="Minutes until auto-advance. Leave empty to disable."
                          />
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>min</span>
                        </div>
                      </td>
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

                          <button
                            onClick={() => handleGetOnboardingLink(h)}
                            title={`Get copyable onboarding link for ${h.name}`}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🔗 Onboarding Link
                          </button>

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
                    <td colSpan="9" className="text-center">
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
          ONBOARDING LINK MODAL
          ============================================================ */}
      {onboardingLinkFor && (
        <div
          className="modal-overlay"
          onClick={() => {
            setOnboardingLinkFor(null);
            setOnboardingData(null);
            setOnboardingView('link');
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <div className="modal-header">
              <h3>🔗 Onboarding Link — {onboardingLinkFor.name}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setOnboardingLinkFor(null);
                  setOnboardingData(null);
                  setOnboardingView('link');
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {onboardingLoading && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner" />
                  <p style={{ color: '#6b7280', marginTop: '12px' }}>
                    Generating link…
                  </p>
                </div>
              )}

              {onboardingData && (
                <>
                  {/* ── View tabs ── */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      marginBottom: '16px',
                      padding: '4px',
                      background: '#f3f4f6',
                      borderRadius: '10px',
                    }}
                  >
                    <button
                      onClick={() => setOnboardingView('link')}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '8px',
                        background: onboardingView === 'link' ? 'white' : 'transparent',
                        color: onboardingView === 'link' ? '#1f2937' : '#6b7280',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow:
                          onboardingView === 'link' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      📋 Copy &amp; Paste
                    </button>
                    <button
                      onClick={() => setOnboardingView('qr')}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '8px',
                        background: onboardingView === 'qr' ? 'white' : 'transparent',
                        color: onboardingView === 'qr' ? '#1f2937' : '#6b7280',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow:
                          onboardingView === 'qr' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      📱 QR Code
                    </button>
                  </div>

                  {/* ═══════════════════════════════════════════════
                      VIEW 1 — COPY & PASTE
                      ═══════════════════════════════════════════════ */}
                  {onboardingView === 'link' && (
                    <>
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
                        🔒 Nothing is sent automatically. Copy the link or the full
                        message below, then send it to the hospital admin via WhatsApp,
                        email, SMS, or however you prefer.
                      </div>

                      {/* Staff login URL */}
                      <div style={{ marginBottom: '16px' }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#374151',
                            marginBottom: '4px',
                          }}
                        >
                          Staff Login URL
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            readOnly
                            value={onboardingData.url}
                            onFocus={(e) => e.target.select()}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '13px',
                              fontFamily: 'monospace',
                              background: '#f9fafb',
                            }}
                          />
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(onboardingData.url);
                                toast.success('URL copied');
                              } catch {
                                toast.error('Clipboard not available');
                              }
                            }}
                            style={{
                              padding: '10px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#0f3460',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>

                      {/* Patient portal URL */}
                      <div style={{ marginBottom: '16px' }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#374151',
                            marginBottom: '4px',
                          }}
                        >
                          Patient Portal URL (optional — share with patients)
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            readOnly
                            value={onboardingData.patientPortalUrl}
                            onFocus={(e) => e.target.select()}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '13px',
                              fontFamily: 'monospace',
                              background: '#f9fafb',
                            }}
                          />
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  onboardingData.patientPortalUrl
                                );
                                toast.success('Patient portal URL copied');
                              } catch {
                                toast.error('Clipboard not available');
                              }
                            }}
                            style={{
                              padding: '10px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#6b7280',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>

                      {/* Admin credentials summary */}
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          marginBottom: '16px',
                          fontSize: '13px',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px 16px',
                        }}
                      >
                        <div>
                          <span style={{ color: '#6b7280' }}>Admin name</span>
                          <div style={{ fontWeight: 600 }}>{onboardingData.adminName}</div>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Login username</span>
                          <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {onboardingData.adminUsername}
                          </div>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#6b7280' }}>Admin email</span>
                          <div style={{ fontWeight: 600 }}>
                            {onboardingData.adminEmail || (
                              <span style={{ color: '#ef4444' }}>⚠️ none on file</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pre-written message */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#374151',
                            marginBottom: '4px',
                          }}
                        >
                          Pre-written message (paste into WhatsApp / Gmail)
                        </label>
                        <textarea
                          readOnly
                          value={onboardingData.message}
                          onFocus={(e) => e.target.select()}
                          rows={12}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            background: '#f9fafb',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* ═══════════════════════════════════════════════
                      VIEW 2 — QR CODE
                      ═══════════════════════════════════════════════ */}
                  {onboardingView === 'qr' && (
                    <>
                      <div
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #3b82f6',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          marginBottom: '20px',
                          fontSize: '13px',
                          color: '#1e3a5f',
                        }}
                      >
                        📱 Show this QR code to the hospital admin. They scan it with their
                        phone camera and land directly on the login page — no typing needed.
                      </div>

                      {/* Print target */}
                      <div
                        id="onboarding-qr-print-area"
                        style={{
                          background: 'white',
                          border: '2px dashed #0f3460',
                          borderRadius: '16px',
                          padding: '32px 24px',
                          textAlign: 'center',
                        }}
                      >
                        <img
                          src="/logo.png"
                          alt="NexGen EMR"
                          style={{
                            width: '56px',
                            height: '56px',
                            objectFit: 'contain',
                            marginBottom: '8px',
                          }}
                        />
                        <div
                          style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            color: '#0f3460',
                            marginBottom: '4px',
                          }}
                        >
                          {onboardingData.hospitalName}
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            marginBottom: '20px',
                          }}
                        >
                          Staff Login
                        </div>

                        <div
                          style={{
                            display: 'inline-block',
                            padding: '16px',
                            background: 'white',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          <QRCodeSVG
  value={onboardingData.url}
  size={220}
  level="H"
  marginSize={4}
                          />
                          <QRCodeSVG
  value={onboardingData.patientPortalUrl}
  size={80}
  level="M"
/>
                        </div>

                        <div
                          style={{
                            marginTop: '20px',
                            fontSize: '13px',
                            color: '#374151',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                          }}
                        >
                          {onboardingData.url}
                        </div>

                        <div
                          style={{
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid #e5e7eb',
                            fontSize: '12px',
                            color: '#6b7280',
                          }}
                        >
                          <div>
                            <strong>Username:</strong>{' '}
                            <span style={{ fontFamily: 'monospace' }}>
                              {onboardingData.adminUsername}
                            </span>
                          </div>
                          <div>
                            <strong>Password:</strong> the one set during registration
                          </div>
                        </div>
                      </div>

                      {/* Patient portal QR (smaller) */}
                      <div
                        style={{
                          marginTop: '20px',
                          background: '#f0fdf4',
                          border: '1px solid #10b981',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                        }}
                      >
                        <div
                          style={{
                            padding: '8px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            flexShrink: 0,
                          }}
                        >
                          <QRCode
                            value={onboardingData.patientPortalUrl}
                            size={80}
                            level="M"
                          />
                        </div>
                        <div style={{ flex: 1, fontSize: '13px', color: '#065f46' }}>
                          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                            🚑 Patient Portal (optional)
                          </div>
                          <div style={{ fontSize: '12px', color: '#374151' }}>
                            Patients scan this to reach the portal. Print on posters or ID
                            cards if you like.
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                onboardingData.patientPortalUrl
                              );
                              toast.success('Patient portal URL copied');
                            } catch {
                              toast.error('Clipboard not available');
                            }
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#10b981',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            fontSize: '12px',
                          }}
                        >
                          📋 Copy URL
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setOnboardingLinkFor(null);
                  setOnboardingData(null);
                  setOnboardingView('link');
                }}
              >
                Close
              </button>

              {onboardingData && onboardingView === 'link' && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(onboardingData.message);
                        toast.success('Full message copied — paste anywhere');
                      } catch {
                        toast.error('Clipboard not available');
                      }
                    }}
                    style={{ background: '#10b981' }}
                  >
                    📋 Copy Full Message
                  </button>

                  {onboardingData.adminEmail && (
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        onboardingData.message
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{
                        background: '#25D366',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      💬 Share via WhatsApp
                    </a>
                  )}

                  {onboardingData.adminEmail && (
                    <a
                      href={`mailto:${onboardingData.adminEmail}?subject=${encodeURIComponent(
                        `Welcome to NexGen EMR — ${onboardingData.hospitalName}`
                      )}&body=${encodeURIComponent(onboardingData.message)}`}
                      className="btn btn-primary"
                      style={{
                        background: '#dc2626',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      ✉️ Open in Gmail
                    </a>
                  )}
                </>
              )}

              {onboardingData && onboardingView === 'qr' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const printContent =
                      document.getElementById('onboarding-qr-print-area')?.outerHTML;
                    if (!printContent) return;

                    const w = window.open('', '_blank', 'width=520,height=760');
                    if (!w) {
                      toast.error('Please allow popups to print');
                      return;
                    }
                    w.document.write(`
                      <html>
                        <head>
                          <title>Onboarding QR — ${onboardingData.hospitalName}</title>
                          <style>
                            body {
                              font-family: Arial, sans-serif;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              min-height: 100vh;
                              margin: 0;
                              padding: 20px;
                              box-sizing: border-box;
                            }
                            #onboarding-qr-print-area {
                              border: 2px dashed #0f3460 !important;
                              border-radius: 16px !important;
                              padding: 32px 24px !important;
                              text-align: center !important;
                              max-width: 400px;
                              background: white !important;
                            }
                            img { max-width: 56px; height: 56px; object-fit: contain; }
                            svg { display: inline-block; }
                          </style>
                        </head>
                        <body>${printContent}</body>
                      </html>
                    `);
                    w.document.close();
                    w.focus();
                    setTimeout(() => {
                      w.print();
                      w.close();
                    }, 400);
                  }}
                  style={{ background: '#0f3460' }}
                >
                  🖨️ Print QR
                </button>
              )}
            </div>
          </div>
        </div>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                  default 20 role permission matrix + full starter data
                  (clinics, wards, departments, services). It does NOT create
                  an admin account. Use <strong>Register New Hospital</strong> for
                  full onboarding (hospital + admin + starter data).
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