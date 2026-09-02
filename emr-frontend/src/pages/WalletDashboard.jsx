// src/pages/WalletDashboard.jsx - FIXED SEARCH INPUT

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { useSearch } from '../components/Layout';

const WalletDashboard = () => {
  const { token, user } = useAuth();
  const { searchTerm, setSearchTerm } = useSearch(); // ✅ Get setSearchTerm too
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [payCategory, setPayCategory] = useState('General');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [localSearchTerm, setLocalSearchTerm] = useState(''); // ✅ Local state for search input

  const isFinance = ['Admin', 'Accountant', 'BillingOfficer'].includes(user?.role);
  const isClinical = ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Radiologist'].includes(user?.role);

  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/patients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatients(res.data);
    } catch (error) {
      toast.error('Failed to load patients');
    }
  };

  const fetchWallet = async (patientId) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:3000/api/patients/${patientId}/wallet?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWalletData(res.data);
      setTransactions(res.data.transactions || []);
    } catch (error) {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFinance || isClinical) {
      fetchPatients();
    }
  }, []);

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    fetchWallet(patient.id);
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:3000/api/patients/${selectedPatient.id}/wallet/deposit`,
        {
          amount: parseFloat(depositAmount),
          paymentMethod,
          notes: `Deposit via ${paymentMethod}`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message || `✅ ₦${depositAmount} deposited successfully!`);
      setShowDepositModal(false);
      setDepositAmount('');
      await fetchWallet(selectedPatient.id);
      window.dispatchEvent(new Event('walletUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Deposit failed');
    }
  };

  const handlePayFromWallet = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!payDescription) {
      toast.error('Please enter a description');
      return;
    }

    if (parseFloat(payAmount) > walletData?.balance) {
      toast.error(`Insufficient balance. Available: ₦${walletData?.balance?.toLocaleString()}`);
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:3000/api/patients/${selectedPatient.id}/wallet/pay`,
        {
          amount: parseFloat(payAmount),
          description: payDescription,
          category: payCategory,
          serviceType: payCategory.toLowerCase()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message || 'Payment successful!');
      setShowPayModal(false);
      setPayAmount('');
      setPayDescription('');
      await fetchWallet(selectedPatient.id);
      window.dispatchEvent(new Event('walletUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Payment failed');
    }
  };

  // ✅ Use localSearchTerm for filtering, not the global searchTerm
  const filteredPatients = patients.filter(p =>
    `${p.firstName} ${p.lastName} ${p.hospitalId}`.toLowerCase().includes(localSearchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => `₦${(amount || 0).toLocaleString()}`;

  if (!isFinance && !isClinical) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '48px' }}>🔒</span>
          <h3 style={{ color: '#1f2937', marginTop: '16px' }}>Access Denied</h3>
          <p style={{ color: '#6b7280' }}>You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>💰 Patient Wallet Management</h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            View and manage patient wallet balances and transactions
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            fetchPatients();
            if (selectedPatient) fetchWallet(selectedPatient.id);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      {/* Patient Selector - Modern Card */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>👤</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Select Patient</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Search by name or Hospital ID to view wallet
            </p>
          </div>
        </div>
        
        {/* ✅ FIXED: Use localSearchTerm with proper onChange handler */}
        <input
          type="text"
          placeholder="🔍 Search by name or Hospital ID..."
          className="form-control"
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '2px solid #e5e7eb',
            fontSize: '14px',
            marginBottom: '16px',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#0f3460'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
        
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px',
          maxHeight: '120px',
          overflowY: 'auto',
          padding: '4px 2px'
        }}>
          {filteredPatients.slice(0, 20).map(p => (
            <button
              key={p.id}
              onClick={() => handlePatientSelect(p)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: selectedPatient?.id === p.id ? '2px solid #0f3460' : '1px solid #e5e7eb',
                background: selectedPatient?.id === p.id ? '#0f3460' : 'white',
                color: selectedPatient?.id === p.id ? 'white' : '#1f2937',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: selectedPatient?.id === p.id ? '600' : '400',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{p.hospitalId}</span>
              <span>-</span>
              <span>{p.firstName} {p.lastName}</span>
            </button>
          ))}
          {filteredPatients.length === 0 && localSearchTerm && (
            <div style={{ color: '#6b7280', fontSize: '14px', padding: '8px 0' }}>
              No patients found matching "{localSearchTerm}".
            </div>
          )}
          {filteredPatients.length === 0 && !localSearchTerm && (
            <div style={{ color: '#6b7280', fontSize: '14px', padding: '8px 0' }}>
              Start typing to search for patients...
            </div>
          )}
        </div>
      </div>

      {/* The rest of the component remains the same */}
      {selectedPatient && (
        <>
          {/* Wallet Summary - Modern Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* Balance Card */}
            <div style={{
              background: 'linear-gradient(135deg, #0f3460, #1a4a7a)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(15, 52, 96, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '13px', opacity: 0.8 }}>Available Balance</span>
                  <div style={{ fontSize: '32px', fontWeight: '700', marginTop: '4px' }}>
                    {formatCurrency(walletData?.balance)}
                  </div>
                </div>
                <span style={{ fontSize: '32px' }}>💰</span>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontSize: '12px', 
                  padding: '4px 12px', 
                  borderRadius: '12px',
                  background: walletData?.status === 'Active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                  color: walletData?.status === 'Active' ? '#6ee7b7' : '#fca5a5'
                }}>
                  {walletData?.status || 'Active'}
                </span>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>
                  Last: {walletData?.lastTransactionAt ? new Date(walletData.lastTransactionAt).toLocaleDateString() : 'None'}
                </span>
              </div>
            </div>

            {/* Stats Cards */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Total Transactions</span>
                <span style={{ fontSize: '24px' }}>📊</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginTop: '4px' }}>
                {transactions.length}
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Total Deposits</span>
                <span style={{ fontSize: '24px' }}>📈</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginTop: '4px' }}>
                {formatCurrency(transactions.filter(t => t.transactionType === 'Deposit').reduce((sum, t) => sum + t.amount, 0))}
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Total Payments</span>
                <span style={{ fontSize: '24px' }}>💸</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', marginTop: '4px' }}>
                {formatCurrency(transactions.filter(t => t.transactionType === 'Payment').reduce((sum, t) => sum + t.amount, 0))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={() => setShowDepositModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span>💳</span> Deposit
            </button>
            <button 
              onClick={() => setShowPayModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: '#0f3460',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(15, 52, 96, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span>💸</span> Pay from Wallet
            </button>
            <button 
              onClick={() => fetchWallet(selectedPatient.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: '#f3f4f6',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              <span>🔄</span> Refresh Balance
            </button>
          </div>

          {/* Patient Info Card */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>👤</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px' }}>
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  ID: {selectedPatient.hospitalId}
                </div>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Status</span>
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: walletData?.status === 'Active' ? '#d1fae5' : '#fecaca',
                    color: walletData?.status === 'Active' ? '#065f46' : '#991b1b'
                  }}>
                    {walletData?.status || 'Active'}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Last Transaction</span>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                  {walletData?.lastTransactionAt ? new Date(walletData.lastTransactionAt).toLocaleString() : 'None'}
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📋</span>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Transaction History</h4>
              </div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                {transactions.length} transactions
              </span>
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" />
                <p style={{ color: '#6b7280', marginTop: '12px' }}>Loading transactions...</p>
              </div>
            ) : transactions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Balance</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Reference</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#6b7280' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, index) => (
                      <tr key={t.id} style={{ borderBottom: index < transactions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '12px 16px', color: '#1f2937' }}>
                          {new Date(t.createdAt).toLocaleDateString()}
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {new Date(t.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: t.transactionType === 'Deposit' ? '#d1fae5' : '#fef3c7',
                            color: t.transactionType === 'Deposit' ? '#065f46' : '#92400e'
                          }}>
                            {t.transactionType === 'Deposit' ? '📥 Deposit' : '📤 Payment'}
                          </span>
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: t.transactionType === 'Deposit' ? '#10b981' : '#ef4444'
                        }}>
                          {t.transactionType === 'Deposit' ? '+' : '-'} {formatCurrency(t.amount)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1f2937' }}>
                          {formatCurrency(t.balanceAfter)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1f2937', maxWidth: '200px' }}>
                          <div style={{ fontSize: '13px' }}>{t.description}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>{t.category || 'General'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <code style={{
                            fontSize: '11px',
                            background: '#f3f4f6',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            color: '#374151'
                          }}>
                            {t.reference}
                          </code>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: t.status === 'Completed' ? '#d1fae5' : '#fef3c7',
                            color: t.status === 'Completed' ? '#065f46' : '#92400e'
                          }}>
                            {t.status === 'Completed' ? '✅' : '⏳'} {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <span style={{ fontSize: '48px' }}>📭</span>
                <p style={{ color: '#6b7280', marginTop: '12px', fontSize: '16px' }}>No transactions yet</p>
                <p style={{ color: '#9ca3af', fontSize: '14px' }}>Transactions will appear here when the patient makes deposits or payments</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Rest of the modals remain the same */}
      {/* Deposit Modal */}
      {showDepositModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', borderRadius: '16px', padding: '0' }}>
            <div style={{ 
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>💳</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Deposit to Wallet</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                </div>
              </div>
              <button 
                className="modal-close" 
                onClick={() => setShowDepositModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleDeposit} style={{ padding: '24px' }}>
              <div style={{
                background: '#f8fafc',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap'
              }}>
                <div>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>Current Balance</span>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f3460' }}>
                    {formatCurrency(walletData?.balance)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>Patient ID</span>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>{selectedPatient.hospitalId}</div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter amount to deposit"
                  required
                  min="1"
                  step="0.01"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid #e5e7eb',
                    fontSize: '16px',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="Transfer">🏦 Bank Transfer</option>
                  <option value="Card">💳 Card</option>
                  <option value="Bank">🏛️ Bank Deposit</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#10b981',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>💳</span> Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay from Wallet Modal */}
      {showPayModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', borderRadius: '16px', padding: '0' }}>
            <div style={{ 
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>💸</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Pay from Wallet</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                </div>
              </div>
              <button 
                className="modal-close" 
                onClick={() => setShowPayModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handlePayFromWallet} style={{ padding: '24px' }}>
              <div style={{
                background: walletData?.balance > 0 ? '#f0fdf4' : '#fef3c7',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
                border: `1px solid ${walletData?.balance > 0 ? '#10b981' : '#f59e0b'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Available Balance</span>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: walletData?.balance > 0 ? '#065f46' : '#92400e' }}>
                    {formatCurrency(walletData?.balance)}
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount to pay"
                  required
                  min="1"
                  step="0.01"
                  max={walletData?.balance}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: `2px solid ${parseFloat(payAmount) > (walletData?.balance || 0) ? '#ef4444' : '#e5e7eb'}`,
                    fontSize: '16px',
                    transition: 'border-color 0.2s'
                  }}
                />
                {parseFloat(payAmount) > (walletData?.balance || 0) && (
                  <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px' }}>
                    ⚠️ Insufficient balance. Available: {formatCurrency(walletData?.balance)}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>
                  Description *
                </label>
                <input
                  type="text"
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  placeholder="e.g., Lab Test Payment"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>
                  Category
                </label>
                <select
                  value={payCategory}
                  onChange={(e) => setPayCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="General">📋 General</option>
                  <option value="Consultation">🩺 Consultation</option>
                  <option value="Lab">🔬 Lab Test</option>
                  <option value="Pharmacy">💊 Pharmacy</option>
                  <option value="Imaging">📷 Imaging/X-Ray</option>
                  <option value="Treatment">💉 Treatment</option>
                  <option value="Others">📌 Others</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parseFloat(payAmount) > (walletData?.balance || 0)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: parseFloat(payAmount) > (walletData?.balance || 0) ? '#9ca3af' : '#0f3460',
                    color: 'white',
                    cursor: parseFloat(payAmount) > (walletData?.balance || 0) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>💸</span> Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletDashboard;