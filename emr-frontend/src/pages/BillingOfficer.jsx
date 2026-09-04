// src/pages/BillingOfficer.jsx - COMPLETE WITH TRANSACTIONS HISTORY & RETAINER SUPPORT

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const BillingOfficer = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingBills, setPendingBills] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [walletBalances, setWalletBalances] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // ✅ GET CATEGORY INFO WITH RETAINER SUPPORT
  const getCategoryInfo = (category) => {
    const map = {
      'FPP': { label: '💰 FPP', className: 'category-fpp' },
      'NHIS': { label: '🏥 NHIS', className: 'category-nhis' },
      'RETAINER': { label: '🏢 Retainer', className: 'category-retainer' },
    };
    return map[category] || map['FPP'];
  };

  // ✅ FETCH PENDING BILLS
  const fetchPendingBills = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/billing', {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          status: 'Pending',
          limit: 100
        }
      });
      
      const billsData = res.data?.data || [];
      setPendingBills(billsData);
      
      // Fetch wallet balances
      const balances = {};
      for (const bill of billsData) {
        const patient = bill.patient || bill.Patient;
        if (patient?.id) {
          try {
            const walletRes = await axios.get(
              `http://localhost:3000/api/patients/${patient.id}/wallet`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            balances[patient.id] = walletRes.data.balance || 0;
          } catch (e) {
            balances[patient.id] = 0;
          }
        }
      }
      setWalletBalances(balances);
    } catch (error) {
      console.error('Fetch pending bills error:', error);
      toast.error('Failed to load pending bills');
    }
  };

  // ✅ FETCH TRANSACTION HISTORY (All paid bills)
  const fetchTransactionHistory = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/billing', {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          status: 'Paid',
          limit: 200
        }
      });
      
      const billsData = res.data?.data || [];
      setTransactionHistory(billsData);
    } catch (error) {
      console.error('Fetch transaction history error:', error);
      toast.error('Failed to load transaction history');
    }
  };

  // ✅ LOAD ALL DATA
  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPendingBills(),
      fetchTransactionHistory()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();

    // Listen for wallet update events
    const handleWalletUpdate = () => {
      fetchPendingBills();
    };
    
    window.addEventListener('walletUpdated', handleWalletUpdate);
    
    return () => {
      window.removeEventListener('walletUpdated', handleWalletUpdate);
    };
  }, []);

  // ✅ HANDLE PROCESS PAYMENT
  const handleProcessPayment = (bill) => {
    setSelectedBill(bill);
    setPaymentAmount(bill.balance.toString());
    setShowPaymentModal(true);
  };

  // ✅ HANDLE PAYMENT SUBMIT
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBill) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > selectedBill.balance) {
      toast.error(`Amount exceeds balance. Balance: ₦${selectedBill.balance.toLocaleString()}`);
      return;
    }

    setProcessingId(selectedBill.id);

    try {
      const response = await axios.post(
        'http://localhost:3000/api/billing/process-payment',
        {
          billingRecordId: selectedBill.id,
          paymentMethod,
          amount,
          paymentReference: paymentMethod === 'Transfer' ? prompt('Enter payment reference:') : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`✅ Payment of ₦${amount.toLocaleString()} processed successfully!`);
      
      setReceiptData(response.data.receipt);
      setShowReceiptModal(true);
      setShowPaymentModal(false);
      
      // Refresh both tabs
      await loadAllData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Payment processing failed');
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ REGENERATE RECEIPT FOR A TRANSACTION
  const handleRegenerateReceipt = async (billId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/billing/${billId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const bill = res.data;
      
      // Format receipt data
      const receiptData = {
        number: `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        date: bill.paymentDate || bill.createdAt,
        issuedBy: bill.staff?.firstName && bill.staff?.lastName 
          ? `${bill.staff.firstName} ${bill.staff.lastName}` 
          : 'Unknown Staff',
        patient: {
          name: `${bill.patient?.firstName || ''} ${bill.patient?.lastName || ''}`.trim() || 'Unknown',
          hospitalId: bill.patient?.hospitalId || 'N/A'
        },
        items: bill.items || [],
        totalAmount: bill.totalAmount,
        paidAmount: bill.paidAmount,
        balance: bill.balance,
        paymentMethod: bill.paymentMethod || 'Cash',
        status: bill.status,
        invoiceNumber: bill.invoiceNumber,
        autoAdvanced: bill.status === 'Paid'
      };
      
      setReceiptData(receiptData);
      setShowReceiptModal(true);
    } catch (error) {
      console.error('Regenerate receipt error:', error);
      toast.error('Failed to regenerate receipt');
    }
  };

  // ✅ HANDLE PRINT RECEIPT
  const handlePrintReceipt = () => {
    const receiptContent = document.getElementById('receipt-print-area');
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Payment Receipt</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 20px; color: #333; }
              .receipt-header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; }
              .receipt-item { display: flex; justify-content: space-between; padding: 4px 0; }
              .receipt-total { border-top: 2px solid #333; padding-top: 10px; font-weight: bold; }
              .receipt-footer { text-align: center; margin-top: 20px; font-size: 12px; border-top: 1px dashed #ccc; padding-top: 10px; }
              .status-paid { color: #10b981; font-weight: bold; }
              .status-pending { color: #f59e0b; }
            </style>
          </head>
          <body>
            ${receiptContent ? receiptContent.innerHTML : ''}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      toast.error('Please allow popups to print the receipt.');
    }
  };

  // ✅ HANDLE CLOSE RECEIPT
  const handleCloseReceipt = () => {
    setShowReceiptModal(false);
    setReceiptData(null);
  };

  // ✅ FILTER TRANSACTION HISTORY
  const filteredHistory = transactionHistory.filter(bill => {
    const patient = bill.patient || bill.Patient;
    const searchString = `${patient?.firstName || ''} ${patient?.lastName || ''} ${patient?.hospitalId || ''} ${bill.invoiceNumber || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    
    if (dateFilter) {
      const billDate = new Date(bill.createdAt).toLocaleDateString();
      return matchesSearch && billDate === new Date(dateFilter).toLocaleDateString();
    }
    
    return matchesSearch;
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💳 Billing Desk</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pending')}
          >
            💰 Pending Payments ({pendingBills.length})
          </button>
          <button 
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            📋 Transaction History ({transactionHistory.length})
          </button>
          <button className="btn btn-secondary" onClick={loadAllData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ============================================================
          PENDING PAYMENTS TAB
          ============================================================ */}
      {activeTab === 'pending' && (
        <>
          {/* Info Banner */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <div>
              <span style={{ fontWeight: '600', color: '#1e3a5f' }}>Automated Billing System</span>
              <span style={{ fontSize: '14px', color: '#1e3a5f', marginLeft: '8px' }}>
                Payments are automatically applied to Registration → Card → Consultation in order.
              </span>
            </div>
          </div>

          {/* Pending Bills Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Category</th>
                  <th>Items</th>
                  <th>Total (₦)</th>
                  <th>Paid (₦)</th>
                  <th>Balance (₦)</th>
                  <th>💳 Wallet</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBills.length > 0 ? (
                  pendingBills.map(bill => {
                    const patient = bill.patient || bill.Patient;
                    const categoryInfo = getCategoryInfo(patient?.patientCategory);
                    const items = bill.items || [];
                    const pendingItems = items.filter(i => i.status === 'Pending');
                    const totalPending = pendingItems.reduce((sum, i) => sum + i.amount, 0);
                    const walletBalance = walletBalances[patient?.id] || 0;
                    
                    return (
                      <tr key={bill.id}>
                        <td><strong>{bill.invoiceNumber}</strong></td>
                        <td>
                          {patient?.firstName} {patient?.lastName}
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {patient?.hospitalId}
                          </div>
                        </td>
                        <td>
                          <span className={`category-badge ${categoryInfo.className}`}>
                            {categoryInfo.label}
                          </span>
                          {patient?.patientCategory === 'RETAINER' && patient?.retainerCompany && (
                            <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                              {patient.retainerCompany}
                            </div>
                          )}
                          {patient?.patientCategory === 'NHIS' && patient?.insuranceProvider && (
                            <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                              {patient.insuranceProvider}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>
                            {pendingItems.map((item, idx) => (
                              <div key={idx} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                padding: '2px 0',
                                borderBottom: idx < pendingItems.length - 1 ? '1px solid #f3f4f6' : 'none'
                              }}>
                                <span>{item.name}</span>
                                <span style={{ fontWeight: '600' }}>₦{item.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td><strong>₦{bill.totalAmount.toLocaleString()}</strong></td>
                        <td style={{ color: '#10b981' }}>₦{bill.paidAmount.toLocaleString()}</td>
                        <td style={{ color: bill.balance > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                          ₦{bill.balance.toLocaleString()}
                        </td>
                        <td>
                          <div style={{ 
                            padding: '4px 10px', 
                            borderRadius: '6px',
                            background: walletBalance >= totalPending ? '#d1fae5' : '#fef3c7',
                            fontSize: '13px',
                            fontWeight: '600',
                            textAlign: 'center'
                          }}>
                            ₦{walletBalance.toLocaleString()}
                            {walletBalance >= totalPending ? (
                              <span style={{ display: 'block', fontSize: '10px', color: '#065f46' }}>✅ Sufficient</span>
                            ) : (
                              <span style={{ display: 'block', fontSize: '10px', color: '#92400e' }}>
                                ⚠️ Shortfall: ₦{(totalPending - walletBalance).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${bill.status === 'Paid' ? 'status-active' : bill.status === 'Partial' ? 'status-pending' : 'status-inactive'}`}>
                            {bill.status}
                          </span>
                        </td>
                        <td>
                          {bill.status !== 'Paid' ? (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleProcessPayment(bill)}
                              disabled={processingId === bill.id}
                              style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '12px'
                              }}
                            >
                              {processingId === bill.id ? '⏳ Processing...' : '💳 Pay'}
                            </button>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: '600' }}>✅ Paid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="10" className="text-center">No pending bills at this time.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ============================================================
          TRANSACTION HISTORY TAB
          ============================================================ */}
      {activeTab === 'history' && (
        <>
          {/* Search and Filter */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="🔍 Search by patient name, ID, or invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: '1',
                minWidth: '250px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
            {searchTerm || dateFilter ? (
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setSearchTerm('');
                  setDateFilter('');
                }}
                style={{
                  background: '#e5e7eb',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ✕ Clear Filters
              </button>
            ) : null}
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              Showing {filteredHistory.length} of {transactionHistory.length} transactions
            </span>
          </div>

          {/* Transaction History Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Category</th>
                  <th>Items</th>
                  <th>Total (₦)</th>
                  <th>Paid (₦)</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length > 0 ? (
                  filteredHistory.map(bill => {
                    const patient = bill.patient || bill.Patient;
                    const categoryInfo = getCategoryInfo(patient?.patientCategory);
                    const items = bill.items || [];
                    const paidItems = items.filter(i => i.status === 'Paid');
                    
                    return (
                      <tr key={bill.id}>
                        <td>{new Date(bill.paymentDate || bill.createdAt).toLocaleDateString()}</td>
                        <td><strong>{bill.invoiceNumber}</strong></td>
                        <td>
                          {patient?.firstName} {patient?.lastName}
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {patient?.hospitalId}
                          </div>
                        </td>
                        <td>
                          <span className={`category-badge ${categoryInfo.className}`}>
                            {categoryInfo.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '11px' }}>
                            {paidItems.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                                <span>{item.name}</span>
                                <span style={{ color: '#10b981' }}>✅</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td><strong>₦{bill.totalAmount.toLocaleString()}</strong></td>
                        <td style={{ color: '#10b981' }}>₦{bill.paidAmount.toLocaleString()}</td>
                        <td>
                          <span className={`status-badge ${bill.paymentMethod === 'Wallet' ? 'status-active' : 'status-scheduled'}`}>
                            {bill.paymentMethod || 'Cash'}
                          </span>
                          {bill.isWalletPayment && (
                            <div style={{ fontSize: '10px', color: '#0f3460' }}>💳</div>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${bill.status === 'Paid' ? 'status-active' : 'status-inactive'}`}>
                            {bill.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleRegenerateReceipt(bill.id)}
                            style={{
                              background: '#0f3460',
                              color: 'white',
                              border: 'none',
                              padding: '4px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                          >
                            📄 Regenerate Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="10" className="text-center">
                    {searchTerm || dateFilter ? 'No transactions match your filters.' : 'No transaction history yet. Process some payments to see them here.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          {transactionHistory.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '16px 20px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong>📊 Summary</strong>
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span>Total Transactions: <strong>{transactionHistory.length}</strong></span>
                <span>Total Revenue: <strong>₦{transactionHistory.reduce((sum, b) => sum + (b.totalAmount || 0), 0).toLocaleString()}</strong></span>
                <span>Wallet Payments: <strong>{transactionHistory.filter(b => b.isWalletPayment).length}</strong></span>
                <span>Cash/Transfer: <strong>{transactionHistory.filter(b => !b.isWalletPayment).length}</strong></span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================
          PAYMENT MODAL
          ============================================================ */}
      {showPaymentModal && selectedBill && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>💳 Process Payment</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body">
                <div style={{
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Patient:</strong> {selectedBill.patient?.firstName} {selectedBill.patient?.lastName}</span>
                    <span><strong>ID:</strong> {selectedBill.patient?.hospitalId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span><strong>Invoice:</strong> {selectedBill.invoiceNumber}</span>
                    <span><strong>Balance:</strong> ₦{selectedBill.balance.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    <strong>Items:</strong>
                    {selectedBill.items?.filter(i => i.status === 'Pending').map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span>{item.name}</span>
                        <span>₦{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="Transfer">🏦 Bank Transfer</option>
                    <option value="Card">💳 Card</option>
                    <option value="Wallet">💰 Wallet</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount (₦) *</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    min="1"
                    max={selectedBill.balance}
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <small style={{ color: '#6b7280' }}>
                    Max: ₦{selectedBill.balance.toLocaleString()}
                  </small>
                </div>

                {paymentMethod === 'Wallet' && (
                  <div style={{
                    background: (walletBalances[selectedBill.patient?.id] || 0) >= parseFloat(paymentAmount) ? '#f0fdf4' : '#fef3c7',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginTop: '4px'
                  }}>
                    💳 Wallet Balance: ₦{(walletBalances[selectedBill.patient?.id] || 0).toLocaleString()}
                    {(walletBalances[selectedBill.patient?.id] || 0) < parseFloat(paymentAmount) && (
                      <span style={{ color: '#ef4444', display: 'block' }}>
                        ⚠️ Insufficient balance. Shortfall: ₦{(parseFloat(paymentAmount) - (walletBalances[selectedBill.patient?.id] || 0)).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={processingId === selectedBill.id}
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
                  {processingId === selectedBill.id ? '⏳ Processing...' : '✅ Process Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          RECEIPT MODAL
          ============================================================ */}
      {showReceiptModal && receiptData && (
        <div className="modal-overlay" onClick={handleCloseReceipt}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', padding: '20px' }}>
            <div id="receipt-print-area">
              <div className="receipt-header" style={{ textAlign: 'center', borderBottom: '2px dashed #333', paddingBottom: '10px' }}>
                <h2 style={{ margin: 0 }}>🏥 NEXGEN EMR CLINIC</h2>
                <p style={{ margin: 0, fontSize: '14px' }}>Medical Centre, Lagos</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                  Payment Receipt {receiptData.regenerated ? '(Regenerated)' : ''}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <div><strong>Receipt #:</strong> {receiptData.number}</div>
                  <div><strong>Invoice #:</strong> {receiptData.invoiceNumber}</div>
                  <div><strong>Date:</strong> {new Date(receiptData.date).toLocaleString()}</div>
                  <div><strong>Issued By:</strong> {receiptData.issuedBy || 'Unknown Staff'}</div>
                </div>
                <div>
                  <div><strong>Patient ID:</strong> {receiptData.patient?.hospitalId}</div>
                  <div><strong>Patient:</strong> {receiptData.patient?.name}</div>
                  <div><strong>Status:</strong> <span className="status-paid">{receiptData.status}</span></div>
                </div>
              </div>

              <div style={{ padding: '10px 0' }}>
                <strong>Items:</strong>
                {receiptData.items?.map((item, idx) => (
                  <div key={idx} className="receipt-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{item.name}</span>
                    <span>
                      ₦{item.amount.toLocaleString()}
                      <span className={item.status === 'Paid' ? 'status-paid' : 'status-pending'}>
                        {' '}{item.status === 'Paid' ? '✅' : '⏳'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="receipt-total" style={{ borderTop: '2px solid #333', paddingTop: '10px', fontWeight: 'bold' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Amount:</span>
                  <span>₦{receiptData.totalAmount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                  <span>Amount Paid:</span>
                  <span>₦{receiptData.paidAmount.toLocaleString()}</span>
                </div>
                {receiptData.balance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                    <span>Balance:</span>
                    <span>₦{receiptData.balance.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '14px' }}>
                  <span>Payment Method:</span>
                  <span>{receiptData.paymentMethod}</span>
                </div>
              </div>

              <div className="receipt-footer" style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', borderTop: '1px dashed #ccc', paddingTop: '10px', color: '#999' }}>
                {receiptData.autoAdvanced ? '✅ Patient automatically moved to Records for card printing.' : 'Thank you for your visit.'}
                <br /> This is a computer-generated receipt.
                <br /> Issued by: {receiptData.issuedBy || 'Unknown Staff'}
                {receiptData.regenerated && (
                  <div style={{ marginTop: '4px', color: '#6b7280' }}>
                    <span style={{ fontSize: '14px' }}>🔄 This receipt was regenerated on {new Date().toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleCloseReceipt}
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
              <button 
                className="btn btn-primary"
                onClick={handlePrintReceipt}
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
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingOfficer;