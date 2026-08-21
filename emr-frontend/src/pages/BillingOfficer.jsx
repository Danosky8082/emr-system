// src/pages/BillingOfficer.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const BillingOfficer = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingJourneys, setPendingJourneys] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // --- Search and Filter State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // --- Receipt state ---
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(false);
  const receiptRef = useRef(null);

  // ✅ Get category info for display
  const getCategoryInfo = (category) => {
    const map = {
      'FPP': { label: '💰 FPP', className: 'category-fpp', multiplier: '100%', tooltip: 'Free Paying Patient - Full Payment' },
      'NHIS': { label: '🏥 NHIS', className: 'category-nhis', multiplier: '10%', tooltip: 'National Health Insurance - 10% Payment' },
      'CORPORATE': { label: '🏢 Corporate', className: 'category-corporate', multiplier: '200%', tooltip: 'Corporate/Company - Double Rate' },
    };
    return map[category] || map['FPP'];
  };

  const fetchPending = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/billing-officer/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingJourneys(res.data);
    } catch (error) {
      toast.error('Failed to load pending billing');
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const res = await axios.get(`http://localhost:3000/api/billing?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data && res.data.data) {
        setPaymentHistory(res.data.data);
      } else if (Array.isArray(res.data)) {
        setPaymentHistory(res.data);
      } else {
        setPaymentHistory([]);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Failed to load payment history');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPending();
      await fetchPaymentHistory();
      setLoading(false);
    };
    loadData();
  }, []);

  // Reload history when filters change
  useEffect(() => {
    if (activeTab === 'history') {
      fetchPaymentHistory();
    }
  }, [searchTerm, statusFilter, dateFrom, dateTo]);

  // ✅ Auto-calculate amount based on category
  const getCalculatedAmount = (journey) => {
    const bill = journey.billingRecord;
    if (!bill) return { baseAmount: 0, calculatedAmount: 0, category: 'FPP', multiplier: '100%' };
    
    const category = journey.patient?.patientCategory || 'FPP';
    const baseAmount = bill.amount || 5000;
    const categoryInfo = getCategoryInfo(category);
    let calculatedAmount = baseAmount;
    
    if (category === 'NHIS') {
      calculatedAmount = Math.round(baseAmount * 0.1);
    } else if (category === 'CORPORATE') {
      calculatedAmount = baseAmount * 2;
    }
    
    return { 
      baseAmount, 
      calculatedAmount, 
      category, 
      multiplier: categoryInfo.multiplier,
      categoryLabel: categoryInfo.label
    };
  };

  const handlePay = async (journey) => {
    const bill = journey.billingRecord;
    if (!bill) {
      toast.error('No bill found. Please contact support.');
      return;
    }

    // ✅ Get automatic calculation
    const { baseAmount, calculatedAmount, category, multiplier, categoryLabel } = getCalculatedAmount(journey);
    const categoryInfo = getCategoryInfo(category);
    
    // ✅ Show automated calculation summary
    const confirmMessage = 
      `💰 AUTOMATED PAYMENT SUMMARY\n\n` +
      `Patient: ${journey.patient?.firstName} ${journey.patient?.lastName}\n` +
      `Category: ${categoryLabel}\n` +
      `Base Amount: ₦${baseAmount.toLocaleString()}\n` +
      `Multiplier: ${multiplier}\n` +
      `─────────────────────────\n` +
      `💰 Amount to Pay: ₦${calculatedAmount.toLocaleString()}\n\n` +
      `✅ This amount has been automatically calculated based on the patient's category.\n` +
      `Click OK to process payment.`;

    if (!window.confirm(confirmMessage)) return;

    // ✅ Just ask for payment method (no manual calculation)
    const paymentMethod = prompt(
      `Enter payment method:\n` +
      `Patient: ${journey.patient?.firstName} ${journey.patient?.lastName}\n` +
      `Amount: ₦${calculatedAmount.toLocaleString()}\n\n` +
      `Options: Cash, Transfer, Card, Insurance`
    ) || 'Cash';

    setProcessingId(journey.id);
    try {
      const res = await axios.post('http://localhost:3000/api/billing-officer/process-payment', {
        journeyId: journey.id,
        paymentMethod
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const paidBill = res.data.bill;
      const categoryInfoRes = res.data.categoryInfo;
      
      setReceiptData({
        ...paidBill,
        _categoryInfo: categoryInfoRes
      });
      setShowReceipt(true);
      setViewingHistory(false);
      
      toast.success(`✅ Payment confirmed! ₦${paidBill.totalAmount.toLocaleString()} (${categoryInfoRes?.multiplier || '100%'} of base amount)`);
      fetchPending();
      fetchPaymentHistory();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  };

  // --- View past receipt ---
  const viewReceipt = async (billId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/billing/${billId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceiptData(res.data);
      setShowReceipt(true);
      setViewingHistory(true);
    } catch (error) {
      toast.error('Failed to load receipt');
    }
  };

  const handlePrintReceipt = () => {
    const printContent = receiptRef.current;
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; color: #333; }
          .receipt-header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #333; }
          h1 { margin: 0; font-size: 24px; }
          .receipt-details { width: 100%; border-collapse: collapse; }
          .receipt-details td { padding: 8px 0; }
          .label { font-weight: bold; width: 40%; }
          .total-row { border-top: 2px solid #333; font-size: 18px; font-weight: bold; margin-top: 10px; padding-top: 10px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; border-top: 1px dashed #ccc; padding-top: 10px; }
          .category-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; }
        </style>
        </head><body>
        ${printContent.innerHTML}
        </body></html>
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

  const getStatusColor = (status) => {
    const colors = {
      'Pending': '#ffcc00',
      'Paid': '#10b981',
      'InsuranceClaim': '#3b82f6',
      'Write-off': '#ef4444',
      'Overdue': '#f59e0b'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Pending': 'status-pending',
      'Paid': 'status-paid',
      'InsuranceClaim': 'status-insurance',
      'Write-off': 'status-writeoff',
      'Overdue': 'status-overdue'
    };
    return classes[status] || 'status-pending';
  };

  // ✅ Format amount display with category info
  const formatAmountDisplay = (journey) => {
    const bill = journey.billingRecord;
    if (!bill) return { display: 'N/A', tooltip: '' };
    
    const category = journey.patient?.patientCategory || 'FPP';
    const baseAmount = bill.amount || 5000;
    const { calculatedAmount, multiplier } = getCalculatedAmount(journey);
    const categoryInfo = getCategoryInfo(category);
    
    return {
      display: `₦${calculatedAmount.toLocaleString()}`,
      tooltip: `${categoryInfo.multiplier} of ₦${baseAmount.toLocaleString()}`,
      baseDisplay: `₦${baseAmount.toLocaleString()}`
    };
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💳 Billing Desk - Automated Payments</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pending')}
          >
            💰 Pending Payments ({pendingJourneys.length})
          </button>
          <button 
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            📋 Payment History ({paymentHistory.length})
          </button>
        </div>
      </div>

      {/* Info Banner - Automated Billing */}
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
            Amounts are automatically calculated based on patient category:
          </span>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#1e40af' }}>💰 FPP: 100%</span>
            <span style={{ fontSize: '13px', color: '#065f46' }}>🏥 NHIS: 10%</span>
            <span style={{ fontSize: '13px', color: '#92400e' }}>🏢 Corporate: 200%</span>
          </div>
        </div>
      </div>

      {/* Search and Filters - Same as before */}
      {activeTab === 'history' && (
        <div style={{ 
          background: 'white', 
          padding: '16px 20px', 
          borderRadius: '12px', 
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="🔍 Search by patient, hospital ID, or invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="InsuranceClaim">Insurance Claim</option>
              <option value="Write-off">Write-off</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('All');
              setDateFrom('');
              setDateTo('');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* PENDING PAYMENTS TABLE - Automated */}
      {activeTab === 'pending' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hospital ID</th>
                <th>Patient Name</th>
                <th>Category</th>
                <th>Base Amount</th>
                <th>Multiplier</th>
                <th>Amount Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingJourneys.map(j => {
                const bill = j.billingRecord;
                const category = j.patient?.patientCategory || 'FPP';
                const categoryInfo = getCategoryInfo(category);
                const { baseAmount, calculatedAmount, multiplier } = getCalculatedAmount(j);
                const isNHIS = category === 'NHIS';
                const isCorporate = category === 'CORPORATE';
                
                return (
                  <tr key={j.id} style={isNHIS ? { background: '#f0fdf4' } : isCorporate ? { background: '#fffbeb' } : {}}>
                    <td><strong>{j.patient?.hospitalId}</strong></td>
                    <td>{j.patient?.firstName} {j.patient?.lastName}</td>
                    <td>
                      <span 
                        className={`category-badge ${categoryInfo.className}`}
                        style={{
                          display: 'inline-block',
                          padding: '3px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        {categoryInfo.label}
                      </span>
                      {isNHIS && j.patient?.insuranceProvider && (
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                          {j.patient.insuranceProvider}
                        </div>
                      )}
                      {isCorporate && j.patient?.corporateCompany && (
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                          {j.patient.corporateCompany}
                        </div>
                      )}
                    </td>
                    <td>₦{baseAmount.toLocaleString()}</td>
                    <td>
                      <span style={{ 
                        fontWeight: '600',
                        color: isNHIS ? '#065f46' : isCorporate ? '#92400e' : '#1e40af'
                      }}>
                        {multiplier}
                      </span>
                    </td>
                    <td>
                      <strong style={{ 
                        color: isNHIS ? '#065f46' : isCorporate ? '#92400e' : '#0f3460',
                        fontSize: '18px'
                      }}>
                        ₦{calculatedAmount.toLocaleString()}
                      </strong>
                      {bill && bill.totalAmount !== calculatedAmount && (
                        <div style={{ fontSize: '10px', color: '#ef4444' }}>
                          ⚠️ Amount updated to match category
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="role-badge" style={{ background: '#ffcc00', color: '#000' }}>
                        Pending
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handlePay(j)}
                        disabled={processingId === j.id || !bill}
                      >
                        {processingId === j.id ? 'Processing...' : '✅ Pay Now'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pendingJourneys.length === 0 && (
                <tr><td colSpan="8" className="text-center">No pending payments at this time.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PAYMENT HISTORY TABLE - Same as before */}
      {activeTab === 'history' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Category</th>
                <th>Amount (₦)</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.length > 0 ? (
                paymentHistory.map(bill => {
                  const category = bill.patient?.patientCategory || 'FPP';
                  const categoryInfo = getCategoryInfo(category);
                  return (
                    <tr key={bill.id}>
                      <td>{new Date(bill.createdAt).toLocaleDateString()}</td>
                      <td><strong>{bill.invoiceNumber}</strong></td>
                      <td>{bill.patient?.firstName} {bill.patient?.lastName}</td>
                      <td>
                        <span 
                          className={`category-badge ${categoryInfo.className}`}
                          style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          {categoryInfo.label}
                        </span>
                      </td>
                      <td>₦{bill.totalAmount.toLocaleString()}</td>
                      <td>{bill.paymentMethod || '-'}</td>
                      <td>
                        <span 
                          className={`role-badge ${getStatusBadgeClass(bill.status)}`}
                          style={{ 
                            background: getStatusColor(bill.status), 
                            color: bill.status === 'Pending' ? '#000' : '#fff' 
                          }}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => viewReceipt(bill.id)}
                        >
                          📄 View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="8" className="text-center">No payment records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt Modal */}
{showReceipt && receiptData && (
  <div className="modal-overlay" onClick={() => setShowReceipt(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px', padding: '20px'}}>
      <div ref={receiptRef}>
        <div className="receipt-header" style={{textAlign: 'center', marginBottom: '20px'}}>
          <h1 style={{margin: 0}}>🏥 NEXGEN EMR CLINIC</h1>
          <p style={{margin: 0, fontSize: '14px'}}>Medical Centre, Lagos</p>
          <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
            {viewingHistory ? 'Payment Receipt (Historical)' : 'Official Payment Receipt'}
          </p>
          <hr style={{border: '1px dashed #ccc'}} />
        </div>
        
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px'}}>
          <div><strong>Invoice No:</strong> <br/>{receiptData.invoiceNumber}</div>
          <div style={{textAlign: 'right'}}>
            <strong>Date:</strong> <br/>
            {new Date(receiptData.createdAt).toLocaleDateString()}
          </div>
        </div>

        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '20px'}}>
          <tbody>
            <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Patient ID:</td>
              <td>{receiptData.patient?.hospitalId || 'N/A'}</td></tr>
            <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Patient Name:</td>
              <td>{receiptData.patient ? `${receiptData.patient.firstName} ${receiptData.patient.lastName}` : 'N/A'}</td></tr>
            <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Category:</td>
              <td>{receiptData.patient?.patientCategory || 'FPP'}</td></tr>
            <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Description:</td>
              <td>{receiptData.description}</td></tr>
            <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Payment Method:</td>
              <td>{receiptData.paymentMethod || 'N/A'}</td></tr>
            <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Status:</td>
              <td>{receiptData.status}</td></tr>
          </tbody>
        </table>

        <div style={{borderTop: '2px solid #000', paddingTop: '15px', textAlign: 'right', fontSize: '20px', fontWeight: 'bold'}}>
          Total Amount: ₦{receiptData.totalAmount.toLocaleString()}
        </div>

        <div style={{textAlign: 'center', marginTop: '30px', fontSize: '12px', color: '#999', borderTop: '1px dashed #ccc', paddingTop: '10px'}}>
          {viewingHistory ? 'Historical record for reference.' : 'Thank you for your visit.'}
          <br/> This is a computer-generated receipt.
        </div>
      </div>

      {/* ✅ FIXED: Buttons with visible backgrounds */}
      <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={() => setShowReceipt(false)}
          style={{
            background: '#e5e7eb',
            color: '#1f2937',
            border: '1px solid #d1d5db',
            padding: '10px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          Close
        </button>
        <button 
          type="button" 
          className="btn btn-primary" 
          onClick={handlePrintReceipt}
          style={{
            background: '#0f3460',
            color: 'white',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          🖨️ Print Receipt
        </button>
      </div>
    </div>
  </div>
)}

      <style>{`
        .status-paid { background: #10b981; color: white; }
        .status-pending { background: #ffcc00; color: black; }
        .status-insurance { background: #3b82f6; color: white; }
        .status-writeoff { background: #ef4444; color: white; }
        .status-overdue { background: #f59e0b; color: white; }
        
        .category-fpp { background: #dbeafe; color: #1e40af; }
        .category-nhis { background: #d1fae5; color: #065f46; }
        .category-corporate { background: #fef3c7; color: #92400e; }
      `}</style>
    </div>
  );
};

export default BillingOfficer;