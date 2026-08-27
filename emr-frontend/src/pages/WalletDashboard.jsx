// src/pages/WalletDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { useSearch } from '../components/Layout';

const WalletDashboard = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
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
      const res = await axios.get(`http://localhost:3000/api/patients/${patientId}/wallet`, {
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

      toast.success(response.data.message);
      setShowDepositModal(false);
      setDepositAmount('');
      fetchWallet(selectedPatient.id);
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

      toast.success(response.data.message);
      setShowPayModal(false);
      setPayAmount('');
      setPayDescription('');
      fetchWallet(selectedPatient.id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Payment failed');
    }
  };

  const filteredPatients = patients.filter(p =>
    `${p.firstName} ${p.lastName} ${p.hospitalId}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isFinance && !isClinical) {
    return (
      <div className="dashboard">
        <h3>Access Denied</h3>
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💰 Patient Wallet Management</h2>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            fetchPatients();
            if (selectedPatient) fetchWallet(selectedPatient.id);
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Patient Selector */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <h4 style={{ margin: '0 0 12px 0' }}>👤 Select Patient</h4>
        <input
          type="text"
          placeholder="🔍 Search by name or Hospital ID..."
          className="form-control"
          style={{ marginBottom: '12px' }}
          value={searchTerm}
          onChange={(e) => {}}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {filteredPatients.slice(0, 20).map(p => (
            <button
              key={p.id}
              className={`btn btn-sm ${selectedPatient?.id === p.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handlePatientSelect(p)}
              style={{
                background: selectedPatient?.id === p.id ? '#0f3460' : '#e5e7eb',
                color: selectedPatient?.id === p.id ? 'white' : '#1f2937'
              }}
            >
              {p.hospitalId} - {p.firstName} {p.lastName}
            </button>
          ))}
        </div>
      </div>

      {selectedPatient && (
        <>
          {/* Wallet Summary */}
          <div className="stats-grid">
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#10b981' }}>
                  ₦{walletData?.balance?.toLocaleString() || '0'}
                </div>
                <div className="stat-label">Wallet Balance</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-value">{transactions.length}</div>
                <div className="stat-label">Total Transactions</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#f59e0b' }}>
                  ₦{transactions
                    .filter(t => t.transactionType === 'Deposit')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </div>
                <div className="stat-label">Total Deposits</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="stat-icon">💸</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#ef4444' }}>
                  ₦{transactions
                    .filter(t => t.transactionType === 'Payment')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </div>
                <div className="stat-label">Total Payments</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button 
              className="btn btn-success" 
              onClick={() => setShowDepositModal(true)}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              💳 Deposit
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowPayModal(true)}
              style={{
                background: '#0f3460',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              💸 Pay from Wallet
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => fetchWallet(selectedPatient.id)}
              style={{
                background: '#e5e7eb',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              🔄 Refresh Balance
            </button>
          </div>

          {/* Wallet Info */}
          <div style={{
            background: '#f8fafc',
            padding: '16px 20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span><strong>Patient:</strong> {selectedPatient.firstName} {selectedPatient.lastName}</span>
              <span><strong>Hospital ID:</strong> {selectedPatient.hospitalId}</span>
              <span><strong>Wallet Status:</strong> 
                <span style={{ 
                  color: walletData?.status === 'Active' ? '#10b981' : '#ef4444',
                  fontWeight: '600'
                }}>
                  {' '}{walletData?.status || 'Active'}
                </span>
              </span>
              <span><strong>Last Transaction:</strong> 
                {walletData?.lastTransactionAt ? new Date(walletData.lastTransactionAt).toLocaleString() : 'None'}
              </span>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="table-container">
            <h4 style={{ padding: '16px 16px 0', margin: 0 }}>📋 Transaction History</h4>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance Before</th>
                  <th>Balance After</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="text-center">Loading...</td></tr>
                ) : transactions.length > 0 ? (
                  transactions.map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.createdAt).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${
                          t.transactionType === 'Deposit' ? 'status-active' :
                          t.transactionType === 'Payment' ? 'status-pending' :
                          'status-scheduled'
                        }`}>
                          {t.transactionType}
                        </span>
                      </td>
                      <td style={{ 
                        color: t.transactionType === 'Deposit' ? '#10b981' : '#ef4444',
                        fontWeight: '600'
                      }}>
                        {t.transactionType === 'Deposit' ? '+' : '-'} ₦{t.amount.toLocaleString()}
                      </td>
                      <td>₦{t.balanceBefore?.toLocaleString() || '0'}</td>
                      <td>₦{t.balanceAfter?.toLocaleString() || '0'}</td>
                      <td>{t.description}</td>
                      <td><code style={{ fontSize: '11px' }}>{t.reference}</code></td>
                      <td>
                        <span className={`status-badge ${
                          t.status === 'Completed' ? 'status-active' :
                          t.status === 'Pending' ? 'status-pending' :
                          'status-inactive'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="8" className="text-center">No transactions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Deposit Modal */}
      {showDepositModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>💳 Deposit to Wallet</h3>
              <button className="modal-close" onClick={() => setShowDepositModal(false)}>×</button>
            </div>
            <form onSubmit={handleDeposit}>
              <div className="modal-body">
                <p><strong>Patient:</strong> {selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p><strong>Current Balance:</strong> ₦{walletData?.balance?.toLocaleString() || '0'}</p>
                
                <div className="form-group">
                  <label>Amount (₦) *</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Enter amount"
                    required
                    min="1"
                    step="0.01"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Bank">Bank Deposit</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDepositModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">💳 Confirm Deposit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay from Wallet Modal */}
      {showPayModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>💸 Pay from Wallet</h3>
              <button className="modal-close" onClick={() => setShowPayModal(false)}>×</button>
            </div>
            <form onSubmit={handlePayFromWallet}>
              <div className="modal-body">
                <p><strong>Patient:</strong> {selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p><strong>Available Balance:</strong> 
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                    ₦{walletData?.balance?.toLocaleString() || '0'}
                  </span>
                </p>
                
                <div className="form-group">
                  <label>Amount (₦) *</label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Enter amount"
                    required
                    min="1"
                    step="0.01"
                    max={walletData?.balance}
                    autoFocus
                  />
                  {parseFloat(payAmount) > (walletData?.balance || 0) && (
                    <small style={{ color: '#ef4444' }}>Insufficient balance!</small>
                  )}
                </div>
                <div className="form-group">
                  <label>Description *</label>
                  <input
                    type="text"
                    value={payDescription}
                    onChange={(e) => setPayDescription(e.target.value)}
                    placeholder="e.g., Lab Test Payment"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={payCategory}
                    onChange={(e) => setPayCategory(e.target.value)}
                  >
                    <option value="General">General</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Lab">Lab Test</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Imaging">Imaging/X-Ray</option>
                    <option value="Treatment">Treatment</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={parseFloat(payAmount) > (walletData?.balance || 0)}
                >
                  💸 Confirm Payment
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