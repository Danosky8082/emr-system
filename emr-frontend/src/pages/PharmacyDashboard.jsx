// src/pages/PharmacyDashboard.jsx - WITH STOCK ALERTS

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const PharmacyDashboard = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    totalMedications: 0,
    lowStock: 0,
    outOfStock: 0,
    totalTransactions: 0,
    pendingAuthorizations: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [pendingAuths, setPendingAuths] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const isPharmacist = user?.role === 'Pharmacist' || user?.role === 'Admin' || user?.role === 'ITAdmin';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch medications for stock analysis
      const medRes = await axios.get('http://localhost:3000/api/medications', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const medications = medRes.data || [];
      const lowStock = medications.filter(m => m.stockQuantity > 0 && m.stockQuantity <= m.reorderLevel);
      const outOfStock = medications.filter(m => m.stockQuantity <= 0);

      setLowStockItems(lowStock);

      // Fetch dashboard stats
      const res = await axios.get('http://localhost:3000/api/pharmacy/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStats({
        totalMedications: medications.length || 0,
        lowStock: lowStock.length || 0,
        outOfStock: outOfStock.length || 0,
        totalTransactions: res.data.statistics?.totalTransactions || 0,
        pendingAuthorizations: res.data.statistics?.pendingAuthorizations || 0
      });
      setRecentTransactions(res.data.recentTransactions || []);
      setPendingAuths(res.data.pendingAuths || []);
    } catch (error) {
      console.error('Dashboard error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💊 Pharmacy Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={fetchDashboardData}>
            🔄 Refresh
          </button>
          {isPharmacist && (
            <Link to="/pharmacy" className="btn btn-secondary">
              📦 Manage Inventory
            </Link>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalMedications || 0}</div>
            <div className="stat-label">Total Medications</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats.lowStock || 0}</div>
            <div className="stat-label">Low Stock Items</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#dc2626' }}>{stats.outOfStock || 0}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalTransactions || 0}</div>
            <div className="stat-label">Total Transactions</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pendingAuthorizations || 0}</div>
            <div className="stat-label">Pending NHIS Authorizations</div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div style={{
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#92400e' }}>Low Stock Alert</strong>
              <p style={{ margin: '4px 0 0 0', color: '#78350f', fontSize: '14px' }}>
                The following medications are running low and need to be reordered:
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {lowStockItems.slice(0, 5).map(m => (
                <span key={m.id} style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  background: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#92400e',
                  border: '1px solid #f59e0b'
                }}>
                  {m.name} ({m.stockQuantity} left)
                </span>
              ))}
              {lowStockItems.length > 5 && (
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  background: '#f3f4f6',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  +{lowStockItems.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="section">
        <h3>Recent Transactions</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Medication</th>
                <th>Quantity</th>
                <th>Amount</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions && recentTransactions.length > 0 ? (
                recentTransactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'}</td>
                    <td>
                      <span className={`status-badge ${t.transactionType === 'Purchase' ? 'status-active' : 'status-scheduled'}`}>
                        {t.transactionType || '-'}
                      </span>
                    </td>
                    <td>{t.medication?.name || 'N/A'}</td>
                    <td>{t.quantity || 0}</td>
                    <td>₦{t.totalPrice?.toLocaleString() || '0'}</td>
                    <td>{t.reference || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="text-center">No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending NHIS Authorizations */}
      <div className="section">
        <h3>Pending NHIS Authorizations</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Authorization #</th>
                <th>Patient</th>
                <th>Total Amount</th>
                <th>NHIS Amount</th>
                <th>Patient Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pendingAuths && pendingAuths.length > 0 ? (
                pendingAuths.map(a => (
                  <tr key={a.id}>
                    <td><code>{a.authorizationNumber || '-'}</code></td>
                    <td>{a.patient?.firstName} {a.patient?.lastName}</td>
                    <td>₦{a.totalAmount?.toLocaleString() || '0'}</td>
                    <td style={{ color: '#10b981' }}>₦{a.nhisAmount?.toLocaleString() || '0'}</td>
                    <td style={{ color: '#f59e0b' }}>₦{a.patientAmount?.toLocaleString() || '0'}</td>
                    <td>
                      <span className="status-badge status-pending">Pending</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="text-center">No pending authorizations</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PharmacyDashboard;