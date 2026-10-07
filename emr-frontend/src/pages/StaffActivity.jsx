// src/pages/StaffActivity.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api/client';
import './Dashboard.css';

const StaffActivity = () => {
  const { user } = useAuth();

  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [onlyOutliers, setOnlyOutliers] = useState(false);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const canView = ['Admin', 'ITAdmin', 'HR', 'Accountant'].includes(user?.role);

  const loadActivity = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        params.append('from', from);
        params.append('to', to);
      }
      const res = await api.get(`/analytics/staff-activity?${params.toString()}`);
      setData(res.data);
    } catch (error) {
      console.error('Staff activity load error:', error);
      toast.error(error.response?.data?.error || 'Failed to load staff activity');
    } finally {
      setLoading(false);
    }
  }, [period, from, to, canView]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  // ── CSV export ──
  const exportCSV = () => {
    if (!data || !data.staff || data.staff.length === 0) {
      toast.error('Nothing to export');
      return;
    }

    const headers = [
      'Staff',
      'Role',
      'Department',
      'Status',
      'Total Transactions',
      'Prescriptions Written',
      'Prescriptions Dispensed',
      'Bills Processed',
      'Amount Handled (NGN)',
      'Wallet Deposits',
      'Wallet Payments',
      'Wallet Refunds',
      'Refund Amount (NGN)',
      'Medication Events',
      'Outlier Flags',
      'Last Activity',
    ];

    const rows = data.staff.map(s => [
      `"${(s.staff?.name || '').replace(/"/g, '""')}"`,
      s.staff?.role || '',
      `"${(s.staff?.department || '').replace(/"/g, '""')}"`,
      s.staff?.isActive ? 'Active' : 'Inactive',
      s.totalTransactions,
      s.prescriptionsWritten,
      s.prescriptionsDispensed,
      s.billsProcessed,
      s.amountHandled,
      s.walletDeposits,
      s.walletPayments,
      s.walletRefunds,
      s.refundAmount,
      s.medicationEvents,
      s.flags && s.flags.length > 0
        ? s.flags.map(f => `${f.label} (${f.zScore}σ)`).join('; ')
        : '',
      s.lastActivityAt ? new Date(s.lastActivityAt).toISOString() : '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = period === 'custom' ? `${from}-to-${to}` : period;
    a.download = `staff-activity-${label}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.staff.length} staff rows`);
  };

  const formatCurrency = (n) =>
    `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (!canView) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '48px' }}>🔒</span>
          <h3 style={{ color: '#1f2937', marginTop: '16px' }}>Access Denied</h3>
          <p style={{ color: '#6b7280' }}>
            Staff activity monitoring is restricted to Admin, ITAdmin, HR, and Accountant.
          </p>
        </div>
      </div>
    );
  }

  // ── Client-side filter pipeline ──
  const filteredStaff = (data?.staff || []).filter(s => {
    if (onlyOutliers && !s.isOutlier) return false;
    if (roleFilter !== 'ALL' && s.staff?.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${s.staff?.name || ''} ${s.staff?.role || ''} ${s.staff?.department || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Unique roles in the current dataset (for the filter dropdown)
  const availableRoles = [
    ...new Set((data?.staff || []).map(s => s.staff?.role).filter(Boolean)),
  ].sort();

  return (
    <div className="dashboard">
      {/* ═══ HEADER ═══ */}
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
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
            👥 Staff Activity Monitor
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Transactions, prescriptions, and refunds by staff member — with statistical outliers flagged
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={exportCSV}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📥 Export CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={loadActivity}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ═══ PERIOD SELECTOR ═══ */}
      <div
        style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              background: 'white',
              minWidth: '160px',
            }}
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 90 days</option>
            <option value="year">Last 365 days</option>
            <option value="custom">Custom range…</option>
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
          </>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
            Role
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              background: 'white',
              minWidth: '140px',
            }}
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, role, department..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
          />
        </div>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: onlyOutliers ? '#fef2f2' : '#f8fafc',
            border: onlyOutliers ? '1px solid #ef4444' : '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: onlyOutliers ? '#991b1b' : '#374151',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={onlyOutliers}
            onChange={(e) => setOnlyOutliers(e.target.checked)}
            style={{ accentColor: '#ef4444' }}
          />
          🚩 Only outliers
        </label>
      </div>

      {/* ═══ LOADING / DATA ═══ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" />
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Aggregating staff activity…</p>
        </div>
      ) : !data ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
          No staff activity data available.
        </p>
      ) : (
        <>
          {/* ═══ SUMMARY CARDS ═══ */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <div className="stat-value">{data.summary.activeStaffCount}</div>
                <div className="stat-label">Active Staff</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-value">{data.summary.totalTransactions}</div>
                <div className="stat-label">Total Transactions</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#10b981' }}>
                  {formatCurrency(data.summary.totalAmountHandled)}
                </div>
                <div className="stat-label">Amount Handled</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="stat-icon">↩️</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#ef4444' }}>
                  {formatCurrency(data.summary.totalRefunds)}
                </div>
                <div className="stat-label">Total Refunds</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-icon">🚩</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#f59e0b' }}>
                  {data.summary.outlierCount}
                </div>
                <div className="stat-label">Outliers Flagged</div>
              </div>
            </div>
          </div>

          {/* ═══ OUTLIER CALLOUT (if any) ═══ */}
          {data.summary.outlierCount > 0 && !onlyOutliers && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '22px' }}>🚩</span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#991b1b' }}>
                  {data.summary.outlierCount} staff member(s) flagged as statistical outliers
                </strong>
                <p style={{ margin: '2px 0 0 0', color: '#7f1d1d', fontSize: '13px' }}>
                  Their activity is &gt;2σ above the team mean on one or more metrics. This is a
                  heuristic — check the flagged rows below before drawing conclusions.
                </p>
              </div>
              <button
                onClick={() => setOnlyOutliers(true)}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Show only outliers
              </button>
            </div>
          )}

          {/* ═══ STATS LEGEND ═══ */}
          {data.metrics && data.metrics.some(m => m.mean !== null) && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 18px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#6b7280',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '20px',
              }}
            >
              <span style={{ fontWeight: '600', color: '#374151' }}>Team baselines:</span>
              {data.metrics
                .filter(m => m.mean !== null)
                .map(m => (
                  <span key={m.key}>
                    {m.label}: mean <strong>{m.mean.toLocaleString()}</strong>, σ <strong>{m.stddev.toLocaleString()}</strong>
                  </span>
                ))}
            </div>
          )}

          {/* ═══ MAIN TABLE ═══ */}
          <div className="table-container">
            {filteredStaff.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                <span style={{ fontSize: '48px' }}>📭</span>
                <p style={{ marginTop: '12px', fontSize: '16px' }}>
                  {onlyOutliers
                    ? 'No outliers detected in this period'
                    : 'No staff activity matches the current filters'}
                </p>
                <p style={{ fontSize: '14px' }}>
                  {onlyOutliers
                    ? 'Try widening the period or clearing the outlier filter.'
                    : 'Try a different period or clear the role/search filter.'}
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Role</th>
                    <th>Dept</th>
                    <th style={{ textAlign: 'right' }}>Tx</th>
                    <th style={{ textAlign: 'right' }}>Rx Written</th>
                    <th style={{ textAlign: 'right' }}>Rx Dispensed</th>
                    <th style={{ textAlign: 'right' }}>Bills</th>
                    <th style={{ textAlign: 'right' }}>Amount Handled</th>
                    <th style={{ textAlign: 'right' }}>Refunds</th>
                    <th style={{ textAlign: 'right' }}>Refund ₦</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(row => (
                    <tr
                      key={row.staffId}
                      style={{
                        background: row.isOutlier ? '#fef2f2' : row.staff?.isActive ? 'white' : '#f9fafb',
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: '600' }}>
                          {row.staff?.name}
                          {row.isOutlier && (
                            <span style={{ marginLeft: '8px', fontSize: '12px' }} title="Statistical outlier">
                              🚩
                            </span>
                          )}
                        </div>
                        {row.lastActivityAt && (
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                            Last: {new Date(row.lastActivityAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td>
                        {row.staff?.role ? (
                          <span
                            style={{
                              padding: '2px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: '#eff6ff',
                              color: '#1e40af',
                            }}
                          >
                            {row.staff.role}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '13px', color: '#6b7280' }}>
                        {row.staff?.department || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        {row.totalTransactions}
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.prescriptionsWritten || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{row.prescriptionsDispensed || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{row.billsProcessed || '—'}</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                        {row.amountHandled > 0 ? formatCurrency(row.amountHandled) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.walletRefunds || '—'}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: row.refundAmount > 0 ? '#ef4444' : '#9ca3af',
                          fontWeight: row.refundAmount > 0 ? '600' : 'normal',
                        }}
                      >
                        {row.refundAmount > 0 ? formatCurrency(row.refundAmount) : '—'}
                      </td>
                      <td>
                        {row.flags && row.flags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {row.flags.map((f, i) => (
                              <span
                                key={i}
                                title={`${f.label}: ${f.value.toLocaleString()} vs team mean ${f.mean.toLocaleString()} (${f.zScore}σ)`}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {f.label} {f.zScore}σ
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#10b981', fontSize: '12px' }}>✅ Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280', textAlign: 'right' }}>
            Showing <strong>{filteredStaff.length}</strong> of{' '}
            <strong>{(data.staff || []).length}</strong> staff
          </div>
        </>
      )}
    </div>
  );
};

export default StaffActivity;