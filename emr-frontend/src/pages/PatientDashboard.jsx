// src/pages/PatientDashboard.jsx
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

  const token = localStorage.getItem('patient_token');

  useEffect(() => {
    if (!token) {
      navigate('/patient-login');
      return;
    }
    fetchDashboard();
  }, [token]);

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

      {/* Welcome Banner */}
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

      {/* Stats Cards */}
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
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
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

            {/* Recent Prescriptions */}
            {dashboardData?.prescriptions?.length > 0 && (
              <div className="section-card">
                <div className="section-header">
                  <h3>💊 Recent Prescriptions</h3>
                  <span className="section-badge">{dashboardData.prescriptions.length}</span>
                </div>
                <div className="prescription-list">
                  {dashboardData.prescriptions.slice(0, 3).map(p => (
                    <div key={p.id} className="prescription-item">
                      <div className="prescription-medication">
                        <span className="medication-name">{p.medication}</span>
                        <span className="medication-dosage">{p.dosage}</span>
                      </div>
                      <div className="prescription-meta">
                        <span className="prescription-frequency">{p.frequency}</span>
                        <span className={`prescription-status status-${p.status?.toLowerCase()}`}>
                          {p.status || 'Prescribed'}
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
              </div>
            </div>
          </div>
        )}

        {/* Appointments Tab */}
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

        {/* Prescriptions Tab */}
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

        {/* Lab Results Tab */}
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

        {/* Billing Tab */}
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
      </div>
    </div>
  );
};

export default PatientDashboard;