// src/pages/BillingOfficer.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const BillingOfficer = () => {
  const { token } = useAuth();
  const [pendingJourneys, setPendingJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // --- Receipt state ---
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const receiptRef = useRef(null); // Used for printing

  const fetchPending = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/billing-officer/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingJourneys(res.data);
    } catch (error) {
      toast.error('Failed to load pending billing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  // --- NEW: Single Click Confirmation Payment ---
  const handlePay = async (journey) => {
    // Ask only for the payment method. Amount and Description are already pre-filled in the backend!
    const paymentMethod = prompt('Enter payment method (Cash/Transfer/Card):') || 'Cash';

    setProcessingId(journey.id);
    try {
      // We only send journeyId and paymentMethod now. 
      // The backend will fetch the pre-generated bill and mark it as Paid.
      const res = await axios.post('http://localhost:3000/api/billing-officer/process-payment', {
        journeyId: journey.id,
        paymentMethod
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Show the receipt for the newly paid bill
      const paidBill = res.data.bill;
      setReceiptData(paidBill);
      setShowReceipt(true);
      
      toast.success('Payment confirmed successfully! Receipt ready.');
      fetchPending();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  };

  // --- Print Receipt Function ---
  const handlePrintReceipt = () => {
    const printContent = receiptRef.current;
    const originalTitle = document.title;
    document.title = 'Hospital Receipt';
    
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

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Billing Desk – Pending Payments</h2>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Patient Name</th>
              <th>Destination</th>
              <th>Invoice #</th>
              <th>Amount (₦)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingJourneys.map(j => {
              const destination = j.clinic ? `Clinic: ${j.clinic.name}` : (j.ward ? `Ward: ${j.ward.name}` : 'N/A');
              // Grab the pre-generated bill attached to the journey
              const bill = j.billingRecord;

              return (
                <tr key={j.id}>
                  <td><strong>{j.patient?.hospitalId}</strong></td>
                  <td>{j.patient?.firstName} {j.patient?.lastName}</td>
                  <td>{destination}</td>
                  <td>{bill ? bill.invoiceNumber : 'Generating...'}</td>
                  <td>
                    {bill ? (
                      <strong style={{color: '#0f3460'}}>₦{bill.amount.toLocaleString()}</strong>
                    ) : '...'}
                  </td>
                  <td><span className="role-badge" style={{ background: '#ffcc00', color: '#000' }}>Pending Payment</span></td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handlePay(j)}
                      disabled={processingId === j.id || !bill}
                    >
                      {processingId === j.id ? 'Processing...' : 'Confirm Payment'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {pendingJourneys.length === 0 && (
              <tr><td colSpan="7" className="text-center">No pending payments at this time.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Receipt Modal (Same as before, but pulls data dynamically) --- */}
      {showReceipt && receiptData && (
        <div className="modal-overlay" onClick={() => setShowReceipt(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px', padding: '20px'}}>
            
            <div ref={receiptRef}>
              <div className="receipt-header" style={{textAlign: 'center', marginBottom: '20px'}}>
                <h1 style={{margin: 0}}>🏥 NEXGEN EMR CLINIC</h1>
                <p style={{margin: 0, fontSize: '14px'}}>Medical Centre, Lagos</p>
                <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>Official Payment Receipt</p>
                <hr style={{border: '1px dashed #ccc'}} />
              </div>
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px'}}>
                <div><strong>Invoice No:</strong> <br/>{receiptData.invoiceNumber}</div>
                <div style={{textAlign: 'right'}}><strong>Date:</strong> <br/>{new Date(receiptData.paymentDate).toLocaleDateString()}</div>
              </div>

              <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '20px'}}>
                <tbody>
                  <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Patient ID:</td><td>{receiptData.patient?.hospitalId || 'N/A'}</td></tr>
                  <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Patient Name:</td><td>{receiptData.patient ? `${receiptData.patient.firstName} ${receiptData.patient.lastName}` : 'N/A'}</td></tr>
                  <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Description:</td><td>{receiptData.description}</td></tr>
                  <tr><td style={{padding: '5px 0', fontWeight: 'bold'}}>Payment Method:</td><td>{receiptData.paymentMethod}</td></tr>
                </tbody>
              </table>

              <div style={{borderTop: '2px solid #000', paddingTop: '15px', textAlign: 'right', fontSize: '20px', fontWeight: 'bold'}}>
                Total Amount Paid: ₦{receiptData.totalAmount.toLocaleString()}
              </div>

              <div style={{textAlign: 'center', marginTop: '30px', fontSize: '12px', color: '#999', borderTop: '1px dashed #ccc', paddingTop: '10px'}}>
                Thank you for your visit. <br/> This is a computer-generated receipt.
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
              <button type="button" className="btn btn-secondary modal-close-btn" onClick={() => setShowReceipt(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handlePrintReceipt}>🖨️ Print Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingOfficer;