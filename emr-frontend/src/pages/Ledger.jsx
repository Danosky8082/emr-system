// src/pages/Ledger.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import './Dashboard.css';

const Ledger = () => {
  const { token, user } = useAuth();

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [staffList, setStaffList] = useState([]);

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

  // Load staff once for the filter dropdown
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const res = await api.get('/staff');
        setStaffList(res.data || []);
      } catch (error) {
        // Non-fatal — the ledger still works without the staff filter
        console.warn('Failed to load staff list for filter');
      }
    };
    loadStaff();
  }, []);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const handleExportCSV = () => {
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
  };

  const typeColor = (type) => {
    switch (type) {
      case 'MEDICATION': return { bg: '#dbeafe', color: '#1e40af', icon: '💊' };
      case 'PRESCRIPTION': return { bg: '#fef3c7', color: '#92400e', icon: '📝' };
      case 'BILLING': return { bg: '#d1fae5', color: '#065f46', icon: '💰' };
      case 'WALLET': return { bg: '#e0e7ff', color: '#4338ca', icon: '👛' };
      default: return { bg: '#f3f4f6', color: '#374151', icon: '📋' };
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>📒 Transaction Ledger</h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Unified audit log of every transaction across the hospital
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            📥 Export CSV
          </button>
          <button className="btn btn-secondary" onClick={loadLedger} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: '20px' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(summary.totalAmount)}</div>
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
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────── */}
      <div style={{ background: 'white', padding: '16px 20px', borderRadius: '12px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', background: 'white' }}>
            <option value="ALL">All Types</option>
            <option value="MEDICATION">💊 Medication</option>
            <option value="PRESCRIPTION">📝 Prescription</option>
            <option value="BILLING">💰 Billing</option>
            <option value="WALLET">👛 Wallet</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Staff</label>
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', background: 'white', minWidth: '180px' }}>
            <option value="">All Staff</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role})</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient, staff, reference, description..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
          />
        </div>
      </div>

      {/* ── Entries Table ─────────────────────────────────── */}
      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div className="spinner" />
            <p style={{ color: '#6b7280', marginTop: '12px' }}>Loading ledger…</p>
          </div>
        ) : entries.length === 0 ? (
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
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280', textAlign: 'right' }}>
        Showing <strong>{entries.length}</strong> of <strong>{summary?.totalEntries || 0}</strong> entries
      </div>
    </div>
  );
};

export default Ledger;