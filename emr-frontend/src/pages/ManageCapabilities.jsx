// src/pages/ManageCapabilities.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api/client';
import './Dashboard.css';

const SENIORITY_LEVELS = ['JUNIOR', 'STAFF', 'SENIOR', 'HOD', 'ADMIN'];

// Human labels for capabilities
const CAPABILITY_LABELS = {
  'records.edit_contact_info': '📞 Edit patient contact info',
  'records.edit_identity': '🆔 Edit patient identity',
  'records.delete_patient': '🗑️ Delete patient file',
  'billing.reverse_transaction': '↩️ Reverse transaction (under threshold)',
  'billing.reverse_large': '↩️ Reverse large transaction',                     
  'billing.void_receipt': '🚫 Void receipt',
  'wallet.freeze': '🧊 Freeze patient wallet',
};

const ManageCapabilities = () => {
  const { user } = useAuth();
  const [caps, setCaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // id of the row being saved

  const canManage = ['Admin', 'ITAdmin'].includes(user?.role);

  const fetchCaps = async () => {
    setLoading(true);
    try {
      const res = await api.get('/capabilities');
      setCaps(res.data);
    } catch (error) {
      console.error('Fetch capabilities error:', error);
      toast.error('Failed to load capabilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) fetchCaps();
    else setLoading(false);
  }, [canManage]);

  const updateCapability = async (cap, patch) => {
    setSaving(cap.id);
    try {
      const res = await api.patch(`/capabilities/${cap.id}`, patch);
      setCaps((prev) => prev.map((c) => (c.id === cap.id ? res.data : c)));
      toast.success(`Updated ${cap.capability}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(null);
    }
  };

  if (!canManage) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '48px' }}>🔒</span>
          <h3 style={{ marginTop: 16 }}>Access Denied</h3>
          <p style={{ color: '#6b7280' }}>
            Only Admin and ITAdmin can manage capabilities.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="spinner" />;

  // Group by role for readability
  const byRole = caps.reduce((acc, cap) => {
    if (!acc[cap.role]) acc[cap.role] = [];
    acc[cap.role].push(cap);
    return acc;
  }, {});

  const roles = Object.keys(byRole).sort();

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0 }}>🔐 Capabilities & Seniority</h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Control who can perform sensitive actions. A capability requires
            the user to be at or above the specified seniority level.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={fetchCaps}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: '#1e3a5f',
        }}
      >
        <strong>How it works:</strong> Junior &lt; Staff &lt; Senior &lt; HOD &lt; Admin.
        If a user is below the required level for a capability, they'll see a
        "Insufficient seniority" message. Department managers automatically
        get HOD for their own department.
      </div>

      {roles.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            color: '#6b7280',
            background: 'white',
            borderRadius: 12,
          }}
        >
          No capabilities configured yet.
        </div>
      ) : (
        roles.map((role) => (
          <div
            key={role}
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px 0',
                fontSize: 16,
                fontWeight: 700,
                color: '#1a1a2e',
              }}
            >
              {role}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#6b7280',
                }}
              >
                ({byRole[role].length} capabilities)
              </span>
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>
                    Capability
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>
                    Key
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', minWidth: 140 }}>
                    Minimum Seniority
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>
                    Enabled
                  </th>
                </tr>
              </thead>
              <tbody>
                {byRole[role].map((cap) => (
                  <tr key={cap.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      {CAPABILITY_LABELS[cap.capability] || cap.capability}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <code
                        style={{
                          background: '#f3f4f6',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          color: '#374151',
                        }}
                      >
                        {cap.capability}
                      </code>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={cap.minSeniority}
                        onChange={(e) =>
                          updateCapability(cap, { minSeniority: e.target.value })
                        }
                        disabled={saving === cap.id}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #d1d5db',
                          background: 'white',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          color:
                            cap.minSeniority === 'ADMIN'
                              ? '#991b1b'
                              : cap.minSeniority === 'HOD'
                                ? '#7c3aed'
                                : cap.minSeniority === 'SENIOR'
                                  ? '#0369a1'
                                  : cap.minSeniority === 'STAFF'
                                    ? '#065f46'
                                    : '#6b7280',
                        }}
                      >
                        {SENIORITY_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={cap.isEnabled}
                        onChange={(e) =>
                          updateCapability(cap, { isEnabled: e.target.checked })
                        }
                        disabled={saving === cap.id}
                        style={{
                          width: 18,
                          height: 18,
                          cursor: 'pointer',
                          accentColor: '#0f3460',
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

export default ManageCapabilities;