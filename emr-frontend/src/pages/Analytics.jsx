// src/pages/Analytics.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts';
import './Dashboard.css';

const COLORS = [
  '#0f3460', '#10b981', '#f59e0b', '#dc2626', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

const Analytics = () => {
  const { token, user } = useAuth();

  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const canView = ['Admin', 'ITAdmin', 'Pharmacist', 'Accountant'].includes(user?.role);

  const loadAnalytics = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        params.append('from', from);
        params.append('to', to);
      }
      const res = await api.get(`/analytics/drugs?${params.toString()}`);
      setData(res.data);
    } catch (error) {
      console.error('Analytics load error:', error);
      toast.error(error.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [period, from, to, canView]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // ── CSV export ──
  const exportCSV = () => {
    if (!data) {
      toast.error('Nothing to export');
      return;
    }

    const lines = [];

    // Section 1: Top prescribed
    lines.push('# Top Prescribed Drugs');
    lines.push('Medication,Prescription Count,Top Prescriber,Prescriber Count');
    for (const p of data.topPrescribed) {
      lines.push(
        `"${p.medication.replace(/"/g, '""')}",${p.count},` +
        `"${(p.topPrescriber?.name || '').replace(/"/g, '""')}",${p.topPrescriber?.count || ''}`
      );
    }

    // Section 2: Top dispensed
    lines.push('');
    lines.push('# Top Dispensed Drugs');
    lines.push('Medication,Category,Quantity,Revenue (NGN),Transactions');
    for (const d of data.topDispensed) {
      lines.push(
        `"${(d.medication?.name || '').replace(/"/g, '""')}",` +
        `"${(d.medication?.category || '').replace(/"/g, '""')}",` +
        `${d.quantity},${d.revenue},${d.txCount}`
      );
    }

    // Section 3: Top lab tests
    lines.push('');
    lines.push('# Top Lab Tests');
    lines.push('Test Name,Test Type,Count');
    for (const l of data.topLabTests) {
      lines.push(
        `"${(l.testName || '').replace(/"/g, '""')}",` +
        `"${(l.testType || '').replace(/"/g, '""')}",${l.count}`
      );
    }

    // Section 4: Imaging
    lines.push('');
    lines.push('# Top Imaging Studies');
    lines.push('Imaging Type,Count');
    for (const i of data.topImaging) {
      lines.push(`"${(i.imagingType || '').replace(/"/g, '""')}",${i.count}`);
    }

    // Section 5: Price trends
    lines.push('');
    lines.push('# Price Trends (avg dispensed unit price per month)');
    lines.push('Month,Medication,Average Price (NGN),Sample Size');
    for (const r of data.priceTrends.raw) {
      lines.push(
        `${r.month},"${(r.medicationName || '').replace(/"/g, '""')}",${r.avgPrice},${r.sampleSize}`
      );
    }

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = period === 'custom' ? `${from}-to-${to}` : period;
    a.download = `drug-analytics-${label}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Analytics exported');
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
            Analytics is restricted to Admin, ITAdmin, Pharmacist, and Accountant.
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
            📊 Drug Usage Analytics
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Prescription patterns, dispensing volume, and pricing trends
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
            onClick={loadAnalytics}
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
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '4px',
            }}
          >
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
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                }}
              />
            </div>
          </>
        )}

        {data?.period && (
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#6b7280' }}>
            📅{' '}
            {new Date(data.period.from).toLocaleDateString()} —{' '}
            {new Date(data.period.to).toLocaleDateString()}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" />
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Crunching the numbers…</p>
        </div>
      ) : !data ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
          No analytics data available.
        </p>
      ) : (
        <>
          {/* ═══ SUMMARY CARDS ═══ */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #0f3460' }}>
              <div className="stat-icon">📝</div>
              <div className="stat-info">
                <div className="stat-value">{data.summary.totalPrescriptions}</div>
                <div className="stat-label">Prescriptions Written</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="stat-icon">💊</div>
              <div className="stat-info">
                <div className="stat-value">{data.summary.totalDispensed}</div>
                <div className="stat-label">Dispenses</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#10b981' }}>
                  {formatCurrency(data.summary.totalDispensedRevenue)}
                </div>
                <div className="stat-label">Pharmacy Revenue</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #06b6d4' }}>
              <div className="stat-icon">🔬</div>
              <div className="stat-info">
                <div className="stat-value">{data.summary.totalLabOrders}</div>
                <div className="stat-label">Lab Orders</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-icon">📷</div>
              <div className="stat-info">
                <div className="stat-value">{data.summary.totalImagingOrders}</div>
                <div className="stat-label">Imaging Studies</div>
              </div>
            </div>
          </div>

          {/* ═══ CHART 1 — Top 20 Prescribed (Bar) ═══ */}
          {data.topPrescribed.length > 0 && (
            <div
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                📝 Top 20 Prescribed Drugs
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                Prescription count for each medication in this period
              </p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={data.topPrescribed}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    dataKey="medication"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f3460" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {data.canSeeDoctors && data.topPrescribed.some(p => p.topPrescriber) && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>
                    Top prescriber per drug
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {data.topPrescribed
                      .filter(p => p.topPrescriber)
                      .slice(0, 10)
                      .map((p, i) => (
                        <span
                          key={i}
                          style={{
                            padding: '4px 12px',
                            background: '#f8fafc',
                            borderRadius: '16px',
                            fontSize: '12px',
                            color: '#374151',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          <strong>{p.medication}</strong> → {p.topPrescriber.name}{' '}
                          <span style={{ color: '#9ca3af' }}>
                            ({p.topPrescriber.count})
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ TABLE — Top Dispensed ═══ */}
          {data.topDispensed.length > 0 && (
            <div
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                💊 Top 20 Dispensed Drugs
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                Volume and revenue from the dispensing counter
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Medication</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Category</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Quantity</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Revenue</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topDispensed.map((d, i) => (
                      <tr
                        key={d.medicationId}
                        style={{ borderBottom: '1px solid #f3f4f6' }}
                      >
                        <td style={{ padding: '10px 12px', color: '#9ca3af', fontWeight: 600 }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                          {d.medication?.name || 'Unknown'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '13px' }}>
                          {d.medication?.category || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {d.quantity}
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: '#10b981',
                          }}
                        >
                          {formatCurrency(d.revenue)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>
                          {d.txCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ CHART 2 — Price Trends ═══ */}
          {data.priceTrends.chartData.length > 1 &&
            data.priceTrends.medications.length > 0 && (
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                  📈 Price Trends
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                  Average dispensed unit price per month for the top 5 drugs
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={data.priceTrends.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₦${v}`}
                    />
                    <Tooltip
                      formatter={(v) => (v != null ? `₦${Number(v).toLocaleString()}` : '—')}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {data.priceTrends.medications.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

          {/* ═══ TWO-COLUMN — Lab + Imaging ═══ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {data.topLabTests.length > 0 && (
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                  🔬 Top Lab Tests
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                  Requested test volume
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.topLabTests}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      dataKey="testName"
                      type="category"
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {data.topImaging.length > 0 && (
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                  📷 Imaging Studies
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                  Ordered imaging volume
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.topImaging}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      dataKey="imagingType"
                      type="category"
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;