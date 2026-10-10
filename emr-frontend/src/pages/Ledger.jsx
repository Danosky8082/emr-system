// src/pages/Ledger.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import './Dashboard.css';
import Skeleton from '../components/Skeleton';

const Ledger = () => {
  const { token, user } = useAuth();

  // ── View mode: transactions or anomalies ──
  const [viewMode, setViewMode] = useState('transactions'); // 'transactions' | 'anomalies'

  const [entries, setEntries] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [summary, setSummary] = useState(null);
  const [anomalySummary, setAnomalySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL'); // for anomalies view
  const [staffList, setStaffList] = useState([]);

  // ── Fetch transactions ──
  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        type: typeFilter,
        limit: '500',
      });
      if (staffFilter) params.append('staffId', staffFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/ledger?${params.toString()}`);
      setEntries(res.data.data || []);
      setSummary(res.data.summary || null);
    } catch (error) {
      console.error('Ledger load error:', error);
      toast.error(error.response?.data?.error || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [from, to, typeFilter, staffFilter, search]);

  // ── Fetch anomalies ──
  const loadAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        limit: '300',
      });
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);

      const res = await api.get(`/ledger/anomalies?${params.toString()}`);
      setAnomalies(res.data.data || []);
      setAnomalySummary(res.data.summary || null);
    } catch (error) {
      console.error('Anomalies load error:', error);
      toast.error(error.response?.data?.error || 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  }, [from, to, severityFilter]);

  // ── Load staff once for filter dropdown ──
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const res = await api.get('/staff');
        setStaffList(res.data || []);
      } catch (error) {
        console.warn('Failed to load staff list for filter');
      }
    };
    loadStaff();
  }, []);

  // ── Reload when filters change ──
  useEffect(() => {
    if (viewMode === 'transactions') {
      loadLedger();
    } else {
      loadAnomalies();
    }
  }, [viewMode, loadLedger, loadAnomalies]);

  // ── CSV export ──
  const handleExportCSV = () => {
    if (viewMode === 'transactions') {
      if (entries.length === 0) {
        toast.error('Nothing to export');
        return;
      }

      const headers = [
        'Timestamp', 'Type', 'Subtype', 'Description',
        'Patient ID', 'Patient Name', 'Staff', 'Staff Role',
        'Amount', 'Balance After', 'Reference',
      ];

      const rows = entries.map(e => [
        new Date(e.timestamp).toISOString(),
        e.type,
        e.subtype || '',
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.patient?.hospitalId || '',
        `"${(e.patient?.name || '').replace(/"/g, '""')}"`,
        `"${(e.staff?.name || '').replace(/"/g, '""')}"`,
        e.staff?.role || '',
        e.amount ?? '',
        e.balanceAfter ?? '',
        e.reference || '',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${entries.length} entries`);
    } else {
      if (anomalies.length === 0) {
        toast.error('Nothing to export');
        return;
      }

      const headers = [
        'Timestamp', 'Pattern', 'Severity', 'Description',
        'Staff', 'Patient ID', 'Patient Name', 'Amount',
      ];

      const rows = anomalies.map(a => [
        new Date(a.timestamp).toISOString(),
        a.pattern,
        a.severity,
        `"${(a.description || '').replace(/"/g, '""')}"`,
        `"${(a.staff?.name || '').replace(/"/g, '""')}"`,
        a.patient?.hospitalId || '',
        `"${(a.patient?.name || '').replace(/"/g, '""')}"`,
        a.amount ?? a.totalAmount ?? '',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-anomalies-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${anomalies.length} anomalies`);
    }
  };

  const handleRefresh = () => {
    if (viewMode === 'transactions') loadLedger();
    else loadAnomalies();
  };

  const typeColor = (type) => {
    switch (type) {
      case 'MEDICATION': return { bg: '#dbeafe', color: '#1e40af', icon: '💊' };
      case 'PRESCRIPTION': return { bg: '#fef3c7', color: '#92400e', icon: '📝' };
      case 'BILLING': return { bg: '#d1fae5', color: '#065f46', icon: '💰' };
      case 'WALLET': return { bg: '#e0e7ff', color: '#4338ca', icon: '👛' };
      case 'TRANSFER': return { bg: '#f3e8ff', color: '#6b21a8', icon: '➡️' };
      default: return { bg: '#f3f4f6', color: '#374151', icon: '📋' };
    }
  };

  const patternInfo = (pattern) => {
    switch (pattern) {
      case 'HIGH_VOLUME_STAFF':
        return { icon: '⚡', label: 'High Volume', color: '#f59e0b' };
      case 'UNMATCHED_DISPENSE':
        return { icon: '💊', label: 'Unmatched Dispense', color: '#dc2626' };
      case 'PAYMENT_MISMATCH':
        return { icon: '⚖️', label: 'Payment Mismatch', color: '#dc2626' };
      case 'ORPHAN_REFUND':
        return { icon: '↩️', label: 'Orphan Refund', color: '#dc2626' };
      default:
        return { icon: '⚠️', label: pattern, color: '#6b7280' };
    }
  };

  const severityInfo = (severity) => {
    switch (severity) {
      case 'HIGH':
        return { bg: '#fee2e2', color: '#991b1b', label: '🔴 High' };
      case 'MEDIUM':
        return { bg: '#fef3c7', color: '#92400e', label: '🟡 Medium' };
      case 'LOW':
        return { bg: '#dbeafe', color: '#1e40af', label: '🔵 Low' };
      default:
        return { bg: '#f3f4f6', color: '#374151', label: severity };
    }
  };

  const formatCurrency = (n) => `₦${(n || 0).toLocaleString()}`;

  const canView = ['Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'].includes(user?.role);

  if (!canView) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '48px' }}>🔒</span>
          <h3 style={{ color: '#1f2937', marginTop: '16px' }}>Access Denied</h3>
          <p style={{ color: '#6b7280' }}>
            The Ledger is restricted to Admin, ITAdmin, Accountant, and BillingOfficer.
          </p>
        </div>
      </div>
    );
  }

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
            📒 {viewMode === 'transactions' ? 'Transaction Ledger' : 'Fraud Monitor'}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            {viewMode === 'transactions'
              ? 'Unified audit log of every transaction across the hospital'
              : 'Automatic detection of suspicious patterns and data errors'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* View mode toggle */}
          <div
            style={{
              display: 'flex',
              background: '#f3f4f6',
              borderRadius: '10px',
              padding: '4px',
              gap: '2px',
            }}
          >
            <button
              onClick={() => setViewMode('transactions')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '8px',
                background: viewMode === 'transactions' ? 'white' : 'transparent',
                color: viewMode === 'transactions' ? '#1f2937' : '#6b7280',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: viewMode === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              📋 Transactions
            </button>
            <button
              onClick={() => setViewMode('anomalies')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '8px',
                background: viewMode === 'anomalies' ? 'white' : 'transparent',
                color: viewMode === 'anomalies' ? '#dc2626' : '#6b7280',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: viewMode === 'anomalies' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🚨 Anomalies
              {anomalySummary?.bySeverity?.HIGH > 0 && (
                <span
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {anomalySummary.bySeverity.HIGH}
                </span>
              )}
            </button>
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📥 Export CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ═══ SUMMARY CARDS ═══ */}
      {viewMode === 'transactions' && summary && (
        <div className="stats-grid" style={{ marginBottom: '20px' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#10b981' }}>
                {formatCurrency(summary.totalAmount)}
              </div>
              <div className="stat-label">Revenue in Period</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-value">{summary.totalEntries}</div>
              <div className="stat-label">Total Entries</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-icon">💊</div>
            <div className="stat-info">
              <div className="stat-value">{summary.byType?.MEDICATION || 0}</div>
              <div className="stat-label">Medication Events</div>
            </div>
          </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <div className="stat-value">{summary.byType?.BILLING || 0}</div>
              <div className="stat-label">Billing Events</div>
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #6b21a8' }}>
            <div className="stat-icon">➡️</div>
            <div className="stat-info">
              <div className="stat-value">{summary.byType?.TRANSFER || 0}</div>
              <div className="stat-label">Stock Transfers</div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'anomalies' && anomalySummary && (
        <>
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
              <div className="stat-icon">🚨</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#dc2626' }}>
                  {anomalySummary.total}
                </div>
                <div className="stat-label">Total Flagged</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
              <div className="stat-icon">🔴</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#dc2626' }}>
                  {anomalySummary.bySeverity?.HIGH || 0}
                </div>
                <div className="stat-label">High Severity</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-icon">⚡</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#f59e0b' }}>
                  {anomalySummary.byPattern?.HIGH_VOLUME_STAFF || 0}
                </div>
                <div className="stat-label">High Volume Staff</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
              <div className="stat-icon">⚖️</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#dc2626' }}>
                  {(anomalySummary.byPattern?.PAYMENT_MISMATCH || 0) +
                    (anomalySummary.byPattern?.UNMATCHED_DISPENSE || 0) +
                    (anomalySummary.byPattern?.ORPHAN_REFUND || 0)}
                </div>
                <div className="stat-label">Financial Concerns</div>
              </div>
            </div>
          </div>

          {anomalySummary.range?.cappedAt90Days && (
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '10px 16px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#92400e',
              }}
            >
              ℹ️ Anomaly detection is limited to the last <strong>90 days</strong> for performance.
              Your requested start date was adjusted automatically.
            </div>
          )}
        </>
      )}

      {/* ═══ FILTERS ═══ */}
      <div
        style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'flex-end',
        }}
      >
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

        {viewMode === 'transactions' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', background: 'white' }}
              >
                <option value="ALL">All Types</option>
                <option value="MEDICATION">💊 Medication</option>
                <option value="PRESCRIPTION">📝 Prescription</option>
                <option value="BILLING">💰 Billing</option>
                <option value="WALLET">👛 Wallet</option>
                <option value="TRANSFER">➡️ Transfer</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Staff
              </label>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', background: 'white', minWidth: '180px' }}
              >
                <option value="">All Staff</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.role})
                  </option>
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
                placeholder="Patient, staff, reference, description..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
          </>
        )}

        {viewMode === 'anomalies' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', background: 'white', minWidth: '180px' }}
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">🔴 High only</option>
              <option value="MEDIUM">🟡 Medium only</option>
              <option value="LOW">🔵 Low only</option>
            </select>
          </div>
        )}
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="table-container">
        {loading ? (
  <Skeleton.Table
    rows={10}
    cols={viewMode === 'transactions' ? 8 : 7}
  />
) : viewMode === 'transactions' ? (
          entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
              <span style={{ fontSize: '48px' }}>📭</span>
              <p style={{ marginTop: '12px', fontSize: '16px' }}>No transactions found in this period</p>
              <p style={{ fontSize: '14px' }}>Try widening the date range or clearing filters.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Patient</th>
                  <th>Staff</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance After</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const t = typeColor(e.type);
                  return (
                    <tr key={e.id}>
                      <td style={{ fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: t.bg, color: t.color }}>
                          {t.icon} {e.type}
                        </span>
                        {e.subtype && (
                          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{e.subtype}</div>
                        )}
                      </td>
                      <td style={{ fontSize: '13px', maxWidth: '260px' }}>{e.description}</td>
                                            <td style={{ fontSize: '13px' }}>
                        {e.patient ? (
                          <>
                            <div style={{ fontWeight: '500' }}>{e.patient.name}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{e.patient.hospitalId}</div>
                          </>
                        ) : e.subtype === 'Transfer' ? (
                          <span
                            style={{ fontSize: '11px', color: '#6b21a8', fontStyle: 'italic' }}
                            title="Stock moves between store locations, not to a patient"
                          >
                            🏬 Main Store → 💊 Counter
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {e.staff ? (
                          <>
                            <div style={{ fontWeight: '500' }}>{e.staff.name}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{e.staff.role}</div>
                          </>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: e.amount > 0 ? '#10b981' : '#9ca3af', whiteSpace: 'nowrap' }}>
                        {e.amount > 0 ? formatCurrency(e.amount) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {e.balanceAfter != null ? formatCurrency(e.balanceAfter) : '—'}
                      </td>
                      <td style={{ fontSize: '11px' }}>
                        {e.reference ? (
                          <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', color: '#374151' }}>{e.reference}</code>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : anomalies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            <span style={{ fontSize: '48px' }}>✅</span>
            <p style={{ marginTop: '12px', fontSize: '16px', color: '#065f46', fontWeight: 600 }}>
              No anomalies detected
            </p>
            <p style={{ fontSize: '14px' }}>
              Every transaction in this window passed all four checks.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Pattern</th>
                <th>Severity</th>
                <th>Description</th>
                <th>Staff</th>
                <th>Patient</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map(a => {
                const pat = patternInfo(a.pattern);
                const sev = severityInfo(a.severity);
                return (
                  <tr
                    key={a.id}
                    style={{
                      background:
                        a.severity === 'HIGH'
                          ? '#fef2f2'
                          : a.severity === 'MEDIUM'
                            ? '#fffbeb'
                            : 'white',
                    }}
                  >
                    <td style={{ fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: '#f3f4f6',
                          color: pat.color,
                        }}
                      >
                        {pat.icon} {pat.label}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: sev.bg,
                          color: sev.color,
                        }}
                      >
                        {sev.label}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', maxWidth: '340px' }}>
                      <div style={{ fontWeight: 500, color: '#1f2937' }}>{a.description}</div>
                      {a.reasons && a.reasons.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                          {a.reasons.join(' • ')}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {a.staff ? (
                        <>
                          <div style={{ fontWeight: '500' }}>{a.staff.name}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>{a.staff.role}</div>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {a.patient ? (
                        <>
                          <div style={{ fontWeight: '500' }}>{a.patient.name}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>{a.patient.hospitalId}</div>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: '#dc2626', whiteSpace: 'nowrap' }}>
                      {(a.amount || a.totalAmount) ? formatCurrency(a.amount || a.totalAmount) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280', textAlign: 'right' }}>
        Showing{' '}
        <strong>
          {viewMode === 'transactions' ? entries.length : anomalies.length}
        </strong>{' '}
        of{' '}
        <strong>
          {viewMode === 'transactions'
            ? summary?.totalEntries || 0
            : anomalySummary?.total || 0}
        </strong>{' '}
        {viewMode === 'transactions' ? 'entries' : 'anomalies'}
      </div>
    </div>
  );
};

export default Ledger;