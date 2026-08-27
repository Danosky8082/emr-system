// src/pages/PatientWallet.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './PatientWallet.css';

const PatientWallet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const token = localStorage.getItem('patient_token');

  useEffect(() => {
    if (!token) {
      navigate('/patient-login');
      return;
    }
    fetchWallet();
  }, [token]);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const [walletRes, txRes] = await Promise.all([
        axios.get('http://localhost:3000/api/patient/wallet', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/patient/wallet/transactions?limit=50', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setWallet(walletRes.data);
      setTransactions(txRes.data.transactions || []);
    } catch (error) {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      Deposit: '📥',
      Payment: '📤',
      Refund: '↩️',
      Adjustment: '⚙️'
    };
    return icons[type] || '📋';
  };

  if (loading) {
    return (
      <div className="patient-wallet-loading">
        <div className="loading-spinner"></div>
        <p>Loading your wallet...</p>
      </div>
    );
  }

  return (
    <div className="patient-wallet-page">
      {/* Header */}
      <header className="wallet-header">
        <div className="header-left">
          <span className="brand-icon">🏥</span>
          <span className="brand-name">NexGen EMR</span>
          <span className="header-divider">|</span>
          <span className="header-title">My Wallet</span>
        </div>
        <button 
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('patient_token');
            localStorage.removeItem('patient_data');
            navigate('/patient-login');
            toast.success('Logged out');
          }}
        >
          🚪 Logout
        </button>
      </header>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="balance-icon">💰</div>
        <div className="balance-info">
          <span className="balance-label">Available Balance</span>
          <span className="balance-amount">₦{wallet?.balance?.toLocaleString() || '0'}</span>
          <span className="balance-status">
            Status: <span className={wallet?.status === 'Active' ? 'status-active' : 'status-inactive'}>
              {wallet?.status || 'Active'}
            </span>
          </span>
        </div>
        <button 
          className="deposit-btn"
          onClick={() => setShowDepositModal(true)}
        >
          💳 Deposit
        </button>
      </div>

      {/* Quick Stats */}
      <div className="wallet-stats">
        <div className="stat-item">
          <span className="stat-value">
            {transactions.filter(t => t.transactionType === 'Deposit').reduce((sum, t) => sum + t.amount, 0)}
          </span>
          <span className="stat-label">Total Deposits</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {transactions.filter(t => t.transactionType === 'Payment').reduce((sum, t) => sum + t.amount, 0)}
          </span>
          <span className="stat-label">Total Payments</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{transactions.length}</span>
          <span className="stat-label">Transactions</span>
        </div>
      </div>

      {/* Transactions */}
      <div className="transactions-section">
        <div className="section-header">
          <h3>📋 Transaction History</h3>
          <button className="refresh-btn" onClick={fetchWallet}>🔄</button>
        </div>
        {transactions.length > 0 ? (
          <div className="transaction-list">
            {transactions.map(t => (
              <div key={t.id} className={`transaction-item ${t.transactionType.toLowerCase()}`}>
                <div className="tx-icon">{getTypeIcon(t.transactionType)}</div>
                <div className="tx-info">
                  <span className="tx-description">{t.description}</span>
                  <span className="tx-reference">{t.reference}</span>
                  <span className="tx-date">{new Date(t.createdAt).toLocaleString()}</span>
                </div>
                <div className={`tx-amount ${t.transactionType === 'Deposit' ? 'positive' : 'negative'}`}>
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
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>💳 Deposit to Wallet</h3>
              <button className="modal-close" onClick={() => setShowDepositModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                Visit the hospital reception to deposit cash, or use the payment methods below.
              </p>
              <div className="deposit-options">
                <div className="deposit-option">
                  <span className="option-icon">🏦</span>
                  <span>Bank Transfer</span>
                </div>
                <div className="deposit-option">
                  <span className="option-icon">💳</span>
                  <span>Card Payment</span>
                </div>
                <div className="deposit-option">
                  <span className="option-icon">📱</span>
                  <span>Mobile Money</span>
                </div>
              </div>
              <div style={{
                background: '#fef3c7',
                padding: '12px',
                borderRadius: '8px',
                marginTop: '16px'
              }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
                  💡 Please contact the billing desk to complete your deposit.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowDepositModal(false)}
                style={{
                  background: '#e5e7eb',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientWallet;