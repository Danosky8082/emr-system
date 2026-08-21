// src/pages/PharmacyDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const PharmacyDashboard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [pendingAuths, setPendingAuths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/pharmacy/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data.statistics);
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
        <button className="btn btn-primary" onClick={fetchDashboardData}>
          🔄 Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💊</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.totalMedications || 0}</div>
            <div className="stat-label">Total Medications</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats?.lowStock || 0}</div>
            <div className="stat-label">Low Stock Items</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.totalTransactions || 0}</div>
            <div className="stat-label">Total Transactions</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats?.pendingAuthorizations || 0}</div>
            <div className="stat-label">Pending NHIS Authorizations</div>
          </div>
        </div>
      </div>

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
              {recentTransactions.length > 0 ? (
                recentTransactions.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${t.transactionType === 'Purchase' ? 'status-active' : 'status-scheduled'}`}>
                        {t.transactionType}
                      </span>
                    </td>
                    <td>{t.medication?.name || 'N/A'}</td>
                    <td>{t.quantity}</td>
                    <td>₦{t.totalPrice.toLocaleString()}</td>
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
              {pendingAuths.length > 0 ? (
                pendingAuths.map(a => (
                  <tr key={a.id}>
                    <td><code>{a.authorizationNumber}</code></td>
                    <td>{a.patient?.firstName} {a.patient?.lastName}</td>
                    <td>₦{a.totalAmount.toLocaleString()}</td>
                    <td style={{ color: '#10b981' }}>₦{a.nhisAmount.toLocaleString()}</td>
                    <td style={{ color: '#f59e0b' }}>₦{a.patientAmount.toLocaleString()}</td>
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