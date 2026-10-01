// src/pages/ChangePassword.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import './Dashboard.css';

const ChangePassword = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('✅ Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard" style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div className="page-header">
        <h2>🔑 Change Your Password</h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Logged in as <strong>{user?.firstName} {user?.lastName}</strong> ({user?.username || user?.email})
        </p>
      </div>

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>Current Password *</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>New Password *</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <small style={{ color: '#6b7280' }}>Minimum 8 characters</small>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Confirm New Password *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Saving…' : '🔑 Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;