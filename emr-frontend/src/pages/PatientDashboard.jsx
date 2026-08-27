// src/pages/PatientDashboard.jsx - COMPLETE WITH WALLET
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './PatientDashboard.css';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);

  const token = localStorage.getItem('patient_token');

  useEffect(() => {
    const mustChange = localStorage.getItem('must_change_password') === 'true';
    console.log('🔍 Dashboard - mustChange:', mustChange);
    
    if (mustChange) {
      toast.error('⚠️ Please change your credentials first');
      navigate('/patient-change-credentials');
      return;
    }
    
    if (!token) {
      navigate('/patient-login');
      return;
    }
    
    fetchDashboard();
    fetchWalletData();
  }, [token, navigate]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const patientData = JSON.parse(localStorage.getItem('patient_data'));
      setPatient(patientData);

      const res = await axios.get('http://localhost:3000/api/patient/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(res.data);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('patient_token');
        localStorage.removeItem('patient_data');
        navigate('/patient-login');
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch wallet data
  const fetchWalletData = async () => {
    setWalletLoading(true);
    try {
      const [balanceRes, txRes] = await Promise.all([
        axios.get('http://localhost:3000/api/patient/wallet', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/patient/wallet/transactions?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setWalletBalance(balanceRes.data.balance || 0);
      setWalletTransactions(txRes.data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('patient_token');
    localStorage.removeItem('patient_data');
    navigate('/patient-login');
    toast.success('Logged out successfully');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return `₦${amount?.toLocaleString() || '0'}`;
  };

  if (loading) {
    return (
      <div className="patient-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your health records...</p>
      </div>
    );
  }

  return (
    <div className="patient-dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-brand">
            <span className="brand-icon">🏥</span>
            <span className="brand-name">NexGen EMR</span>
          </div>
          <span className="header-divider">|</span>
          <span className="header-title">Patient Portal</span>
        </div>
        <div className="header-right">
          <div className="patient-info">
            <span className="patient-name">{patient?.firstName} {patient?.lastName}</span>
            <span className="patient-id">ID: {patient?.hospitalId}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <span>🚪</span> Logout
          </button>
        </div>
      </header>

      {/* Welcome Banner with Wallet Balance */}
      <div className="welcome-banner">
        <div className="welcome-text">
          <h1>Welcome, {patient?.firstName}! 👋</h1>
          <p>Your health information is secure and accessible 24/7</p>
        </div>
        <div className="welcome-date">
          <span>📅</span>
          <span>{new Date().toLocaleDateString('en-NG', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
      </div>

      {/* Stats Cards - Added Wallet Balance */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#dbeafe' }}>
            <span>📅</span>
          </div>
          <div className="stat-card-info">
            <span className="stat-value">{dashboardData?.stats?.totalAppointments || 0}</span>
            <span className="stat-label">Appointments</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#d1fae5' }}>
            <span>💊</span>
          </div>
          <div className="stat-card-info">
            <span className="stat-value">{dashboardData?.stats?.totalPrescriptions || 0}</span>
            <span className="stat-label">Prescriptions</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#fef3c7' }}>
            <span>🔬</span>
          </div>
          <div className="stat-card-info">
            <span className="stat-value">{dashboardData?.stats?.totalLabOrders || 0}</span>
            <span className="stat-label">Lab Results</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#fce4ec' }}>
            <span>💰</span>
          </div>
          <div className="stat-card-info">
            <span className="stat-value">{dashboardData?.stats?.totalBills || 0}</span>
            <span className="stat-label">Bills</span>
          </div>
        </div>
        {/* ✅ Wallet Balance Card */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-card-icon" style={{ background: '#d1fae5' }}>
            <span>💳</span>
          </div>
          <div className="stat-card-info">
            <span className="stat-value" style={{ color: '#10b981' }}>
              {walletLoading ? '...' : formatCurrency(walletBalance)}
            </span>
            <span className="stat-label">Wallet Balance</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          📅 Appointments
        </button>
        <button 
          className={`tab-btn ${activeTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          💊 Prescriptions
        </button>
        <button 
          className={`tab-btn ${activeTab === 'lab-results' ? 'active' : ''}`}
          onClick={() => setActiveTab('lab-results')}
        >
          🔬 Lab Results
        </button>
        <button 
          className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          💰 Billing
        </button>
        <button 
          className={`tab-btn ${activeTab === 'wallet' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallet')}
          style={{ color: activeTab === 'wallet' ? '#0f3460' : '#6b7280' }}
        >
          💳 Wallet
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab - Same as before with Wallet quick action */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Upcoming Appointments */}
            {dashboardData?.appointments?.length > 0 && (
              <div className="section-card">
                <div className="section-header">
                  <h3>📅 Upcoming Appointments</h3>
                  <span className="section-badge">{dashboardData.appointments.length}</span>
                </div>
                <div className="appointment-list">
                  {dashboardData.appointments.slice(0, 3).map(a => (
                    <div key={a.id} className="appointment-item">
                      <div className="appointment-date">
                        <span className="day">{new Date(a.dateTime).getDate()}</span>
                        <span className="month">{new Date(a.dateTime).toLocaleString('default', { month: 'short' })}</span>
                      </div>
                      <div className="appointment-details">
                        <span className="appointment-doctor">Dr. {a.staff?.firstName} {a.staff?.lastName}</span>
                        <span className="appointment-time">{formatTime(a.dateTime)}</span>
                        <span className={`appointment-status status-${a.status?.toLowerCase()}`}>
                          {a.status || 'Scheduled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="quick-actions">
              <h3>⚡ Quick Actions</h3>
              <div className="quick-actions-grid">
                <button className="quick-action-btn" onClick={() => setActiveTab('appointments')}>
                  <span>📅</span> View Appointments
                </button>
                <button className="quick-action-btn" onClick={() => setActiveTab('prescriptions')}>
                  <span>💊</span> View Prescriptions
                </button>
                <button className="quick-action-btn" onClick={() => setActiveTab('lab-results')}>
                  <span>🔬</span> Lab Results
                </button>
                <button className="quick-action-btn" onClick={() => setActiveTab('billing')}>
                  <span>💰</span> Billing
                </button>
                <button 
                  className="quick-action-btn" 
                  onClick={() => window.location.href = '/patient-wallet'}
                  style={{ 
                    borderColor: '#10b981',
                    background: '#f0fdf4'
                  }}
                >
                  <span>💳</span> My Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Appointments Tab - Same as before */}
        {activeTab === 'appointments' && (
          <div className="section-card">
            <div className="section-header">
              <h3>📅 All Appointments</h3>
            </div>
            {dashboardData?.appointments?.length > 0 ? (
              <div className="appointment-list full">
                {dashboardData.appointments.map(a => (
                  <div key={a.id} className="appointment-item">
                    <div className="appointment-date">
                      <span className="day">{new Date(a.dateTime).getDate()}</span>
                      <span className="month">{new Date(a.dateTime).toLocaleString('default', { month: 'short' })}</span>
                    </div>
                    <div className="appointment-details">
                      <span className="appointment-doctor">Dr. {a.staff?.firstName} {a.staff?.lastName}</span>
                      <span className="appointment-time">{formatTime(a.dateTime)}</span>
                      <span className="appointment-type">{a.type || 'Consultation'}</span>
                      <span className={`appointment-status status-${a.status?.toLowerCase()}`}>
                        {a.status || 'Scheduled'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📅</span>
                <p>No appointments found</p>
                <span className="empty-sub">Contact the hospital to schedule an appointment</span>
              </div>
            )}
          </div>
        )}

        {/* Prescriptions Tab - Same as before */}
        {activeTab === 'prescriptions' && (
          <div className="section-card">
            <div className="section-header">
              <h3>💊 All Prescriptions</h3>
            </div>
            {dashboardData?.prescriptions?.length > 0 ? (
              <div className="prescription-list full">
                {dashboardData.prescriptions.map(p => (
                  <div key={p.id} className="prescription-item expanded">
                    <div className="prescription-header">
                      <span className="medication-name">{p.medication}</span>
                      <span className={`prescription-status status-${p.status?.toLowerCase()}`}>
                        {p.status || 'Prescribed'}
                      </span>
                    </div>
                    <div className="prescription-details">
                      <span><strong>Dosage:</strong> {p.dosage}</span>
                      <span><strong>Frequency:</strong> {p.frequency}</span>
                      {p.duration && <span><strong>Duration:</strong> {p.duration}</span>}
                    </div>
                    {p.instructions && (
                      <div className="prescription-instructions">
                        📝 {p.instructions}
                      </div>
                    )}
                    <div className="prescription-meta">
                      <span>Prescribed by: Dr. {p.prescribedBy?.firstName} {p.prescribedBy?.lastName}</span>
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">💊</span>
                <p>No prescriptions found</p>
                <span className="empty-sub">Your prescriptions will appear here when prescribed</span>
              </div>
            )}
          </div>
        )}

        {/* Lab Results Tab - Same as before */}
        {activeTab === 'lab-results' && (
          <div className="section-card">
            <div className="section-header">
              <h3>🔬 Lab Results</h3>
            </div>
            {dashboardData?.labOrders?.length > 0 ? (
              <div className="lab-list">
                {dashboardData.labOrders.map(l => (
                  <div key={l.id} className="lab-item">
                    <div className="lab-header">
                      <span className="lab-name">{l.testName}</span>
                      <span className={`lab-status status-${l.status?.toLowerCase()}`}>
                        {l.status || 'Ordered'}
                      </span>
                    </div>
                    <div className="lab-details">
                      <span><strong>Type:</strong> {l.testType}</span>
                      <span><strong>Priority:</strong> {l.priority || 'Routine'}</span>
                    </div>
                    {l.result && (
                      <div className="lab-result">
                        <strong>Result:</strong> {l.result}
                      </div>
                    )}
                    <div className="lab-meta">
                      <span>Ordered by: Dr. {l.orderedBy?.firstName} {l.orderedBy?.lastName}</span>
                      <span>{formatDate(l.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🔬</span>
                <p>No lab results available</p>
                <span className="empty-sub">Lab results will appear here when completed</span>
              </div>
            )}
          </div>
        )}

        {/* Billing Tab - Same as before */}
        {activeTab === 'billing' && (
          <div className="section-card">
            <div className="section-header">
              <h3>💰 Billing Records</h3>
            </div>
            {dashboardData?.billingRecords?.length > 0 ? (
              <div className="billing-list">
                {dashboardData.billingRecords.map(b => (
                  <div key={b.id} className="billing-item">
                    <div className="billing-header">
                      <span className="billing-invoice">{b.invoiceNumber}</span>
                      <span className={`billing-status status-${b.status?.toLowerCase()}`}>
                        {b.status || 'Pending'}
                      </span>
                    </div>
                    <div className="billing-details">
                      <span><strong>Amount:</strong> ₦{b.totalAmount?.toLocaleString() || '0'}</span>
                      <span><strong>Description:</strong> {b.description}</span>
                      {b.isWalletPayment && (
                        <span style={{ color: '#0f3460', fontWeight: '600' }}>✅ Wallet Payment</span>
                      )}
                    </div>
                    <div className="billing-meta">
                      <span>Date: {formatDate(b.createdAt)}</span>
                      {b.paymentMethod && <span>Method: {b.paymentMethod}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">💰</span>
                <p>No billing records found</p>
                <span className="empty-sub">Your bills will appear here when generated</span>
              </div>
            )}
          </div>
        )}

        {/* ✅ WALLET TAB - New Tab for Wallet Details */}
        {activeTab === 'wallet' && (
          <div className="section-card">
            <div className="section-header">
              <h3>💳 My Wallet</h3>
              <button className="refresh-btn" onClick={fetchWalletData}>🔄</button>
            </div>
            
            {/* Balance Overview */}
            <div style={{
              background: 'linear-gradient(135deg, #0f3460, #1a4a7a)',
              borderRadius: '12px',
              padding: '24px',
              color: 'white',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div>
                <span style={{ opacity: 0.8, fontSize: '14px' }}>Available Balance</span>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>
                  {walletLoading ? '...' : formatCurrency(walletBalance)}
                </div>
              </div>
              <button 
                onClick={() => window.location.href = '/patient-wallet'}
                style={{
                  background: 'white',
                  color: '#0f3460',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                💳 Go to Wallet
              </button>
            </div>

            {/* Quick Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981', display: 'block' }}>
                  {walletTransactions.filter(t => t.transactionType === 'Deposit').reduce((sum, t) => sum + t.amount, 0)}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Total Deposits</span>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444', display: 'block' }}>
                  {walletTransactions.filter(t => t.transactionType === 'Payment').reduce((sum, t) => sum + t.amount, 0)}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Total Payments</span>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6', display: 'block' }}>
                  {walletTransactions.length}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Transactions</span>
              </div>
            </div>

            {/* Recent Transactions */}
            <h4 style={{ marginBottom: '12px' }}>📋 Recent Transactions</h4>
            {walletTransactions.length > 0 ? (
              <div className="transaction-list">
                {walletTransactions.slice(0, 10).map(t => (
                  <div key={t.id} className={`transaction-item ${t.transactionType.toLowerCase()}`} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    marginBottom: '8px',
                    borderLeft: `4px solid ${t.transactionType === 'Deposit' ? '#10b981' : '#ef4444'}`
                  }}>
                    <div className="tx-icon" style={{ fontSize: '24px' }}>
                      {t.transactionType === 'Deposit' ? '📥' : '📤'}
                    </div>
                    <div className="tx-info" style={{ flex: 1 }}>
                      <span className="tx-description" style={{ display: 'block', fontWeight: '600' }}>{t.description}</span>
                      <span className="tx-date" style={{ display: 'block', fontSize: '12px', color: '#6b7280' }}>
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className={`tx-amount ${t.transactionType === 'Deposit' ? 'positive' : 'negative'}`} style={{
                      fontWeight: '700',
                      fontSize: '16px',
                      color: t.transactionType === 'Deposit' ? '#10b981' : '#ef4444'
                    }}>
                      {t.transactionType === 'Deposit' ? '+' : '-'} ₦{t.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <p>No transactions yet</p>
                <span className="empty-sub">Your transactions will appear here</span>
              </div>
            )}
            
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button 
                onClick={() => window.location.href = '/patient-wallet'}
                className="btn btn-primary"
                style={{
                  background: '#0f3460',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                💳 View All Transactions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;