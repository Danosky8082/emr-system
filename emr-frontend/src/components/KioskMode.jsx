// src/components/KioskMode.jsx - COMPLETE FIXED VERSION

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './KioskMode.css';

const KioskMode = () => {
  const [step, setStep] = useState('welcome');
  const [inputValue, setInputValue] = useState('');
  const [patient, setPatient] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [consultationFee, setConsultationFee] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [processingDeduction, setProcessingDeduction] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus on input when step changes
  useEffect(() => {
    if (step === 'input' && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [step]);

  // Countdown for reset
  useEffect(() => {
    if (step === 'success') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            resetKiosk();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  // Fetch consultation fee
  const fetchConsultationFee = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/services/config/CONSULTATION');
      setConsultationFee(res.data?.baseAmount || 5000);
    } catch (error) {
      console.log('Using default consultation fee: 5000');
    }
  };

  useEffect(() => {
    fetchConsultationFee();
  }, []);

  // Handle search
  const handleSearch = async () => {
    if (!inputValue.trim()) {
      toast.error('Please enter your Hospital ID or phone number');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/public/patient/search?query=${encodeURIComponent(inputValue)}`
      );

      if (res.data.length === 0) {
        toast.error('Patient not found. Please try again.');
        setInputValue('');
        inputRef.current?.focus();
        return;
      }

      if (res.data.length > 1) {
        toast.error(`Found ${res.data.length} patients. Please be more specific.`);
        return;
      }

      const foundPatient = res.data[0];
      setPatient(foundPatient);
      
      // Check for today's appointment
      await checkAppointment(foundPatient.id);
      
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check appointment
  const checkAppointment = async (patientId) => {
    try {
      const token = localStorage.getItem('emr_token');
      if (!token) {
        setAppointment(null);
        setStep('confirm');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const res = await axios.get(
        `http://localhost:3000/api/appointments?patientId=${patientId}&dateFrom=${today.toISOString()}&dateTo=${tomorrow.toISOString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const todayAppointments = res.data.filter(a => 
        a.status !== 'Cancelled' && 
        new Date(a.dateTime) >= today && 
        new Date(a.dateTime) < tomorrow
      );

      if (todayAppointments.length > 0) {
        const upcomingAppt = todayAppointments[0];
        setAppointment(upcomingAppt);
        await checkWalletAndFee(patientId, upcomingAppt);
      } else {
        setAppointment(null);
        setStep('confirm');
        toast.error('📋 No appointment found for today. Please visit Records.');
      }
    } catch (error) {
      console.error('Appointment check error:', error);
      setAppointment(null);
      setStep('confirm');
    }
  };

  // Check wallet and auto-deduct
  const checkWalletAndFee = async (patientId, appt) => {
    try {
      const token = localStorage.getItem('emr_token');
      if (!token) {
        setStep('confirm');
        return;
      }

      const walletRes = await axios.get(
        `http://localhost:3000/api/patients/${patientId}/wallet`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const balance = walletRes.data?.balance || 0;
      setWalletBalance(balance);
      
      const fee = consultationFee || 5000;
      
      if (balance >= fee) {
        setStep('wallet-check');
      } else {
        setStep('wallet-insufficient');
        toast.error(`⚠️ Insufficient balance. Please deposit ₦${(fee - balance).toLocaleString()}`);
      }
    } catch (error) {
      console.error('Wallet check error:', error);
      toast.error('Failed to check wallet balance. Please see staff.');
      setStep('confirm');
    }
  };

  // Confirm auto-deduction
  const handleConfirmDeduction = async () => {
    setProcessingDeduction(true);
    try {
      const token = localStorage.getItem('emr_token');
      if (!token) {
        toast.error('Please contact staff to complete check-in');
        setStep('confirm');
        return;
      }

      const fee = consultationFee || 5000;

      // ✅ FIX: Get the doctor name from appointment
      const doctorName = appointment?.Staff 
        ? `Dr. ${appointment.Staff.firstName || ''} ${appointment.Staff.lastName || ''}`.trim() 
        : 'Doctor';

      // Process wallet payment
      await axios.post(
        `http://localhost:3000/api/patients/${patient.id}/wallet/pay`,
        {
          amount: fee,
          description: `Consultation Fee - ${doctorName} at ${new Date(appointment.dateTime).toLocaleString()}`,
          category: 'Consultation',
          serviceType: 'consultation',
          serviceId: appointment.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Check-in patient
      await axios.post(
        'http://localhost:3000/api/patient/checkin',
        {
          patientId: patient.id,
          appointmentId: appointment.id,
          checkInMethod: 'self_kiosk'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`✅ ₦${fee.toLocaleString()} deducted from wallet. Check-in complete!`);
      setStep('success');
      
    } catch (error) {
      console.error('Deduction/check-in error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to complete check-in. Please see staff.';
      toast.error(errorMessage);
      setStep('confirm');
    } finally {
      setProcessingDeduction(false);
    }
  };

  // Decline auto-deduction
  const handleDeclineDeduction = () => {
    toast.error('Please visit the billing desk to pay.');
    setStep('billing-redirect');
  };

  const resetKiosk = () => {
    setStep('welcome');
    setInputValue('');
    setPatient(null);
    setAppointment(null);
    setCountdown(10);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (step === 'input') {
        handleSearch();
      } else if (step === 'confirm') {
        handleConfirmDeduction();
      }
    }
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  const renderWelcome = () => (
    <div className="kiosk-welcome">
      <div className="kiosk-logo">
        <span>🏥</span>
        <h1>Welcome to NexGen EMR</h1>
        <p>Please check in using your Hospital ID or Phone Number</p>
      </div>
      <button 
        className="kiosk-button kiosk-button-primary"
        onClick={() => setStep('input')}
      >
        👤 Check In
      </button>
      <div className="kiosk-footer">
        <span>🕐 {new Date().toLocaleTimeString()}</span>
        <span>📅 {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );

  const renderInput = () => (
    <div className="kiosk-input">
      <div className="kiosk-header">
        <button className="kiosk-back" onClick={resetKiosk}>← Back</button>
        <h2>Enter Your Details</h2>
      </div>
      <div className="kiosk-form">
        <div className="kiosk-input-group">
          <label>Hospital ID or Phone Number</label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="e.g., 000001 or 08012345678"
            className="kiosk-input-field"
            disabled={loading}
          />
          <div className="kiosk-hint">
            💡 You can also scan your patient card at the scanner
          </div>
        </div>
        <button 
          className="kiosk-button kiosk-button-primary"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? '⏳ Searching...' : '🔍 Find Me'}
        </button>
      </div>
    </div>
  );

  const renderConfirm = () => (
    <div className="kiosk-confirm">
      <div className="kiosk-header">
        <button className="kiosk-back" onClick={resetKiosk}>← Back</button>
        <h2>Confirm Your Identity</h2>
      </div>
      <div className="kiosk-patient-card">
        <div className="kiosk-avatar">
          <span>👤</span>
        </div>
        <div className="kiosk-patient-info">
          <h3>{patient?.firstName} {patient?.lastName}</h3>
          <p>🏷️ ID: {patient?.hospitalId}</p>
          <p>📞 {patient?.phone || 'No phone'}</p>
          <p>🏷️ Category: {patient?.patientCategory || 'FPP'}</p>
          {appointment && (
            <p style={{ color: '#0f3460', fontWeight: '600' }}>
              📅 Appointment: {new Date(appointment.dateTime).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <div className="kiosk-actions">
        <button 
          className="kiosk-button kiosk-button-secondary"
          onClick={() => setStep('input')}
        >
          🔄 Wrong Patient
        </button>
        <button 
          className="kiosk-button kiosk-button-success"
          onClick={handleConfirmDeduction}
          disabled={loading}
        >
          {loading ? '⏳ Checking In...' : '✅ Confirm Check-in'}
        </button>
      </div>
      <div className="kiosk-info">
        <span>ℹ️ A staff member will assist you with check-in</span>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="kiosk-success">
      <div className="kiosk-success-icon">✅</div>
      <h2>Welcome, {patient?.firstName}!</h2>
      <p>You have been checked in successfully.</p>
      <div className="kiosk-success-details">
        <div>
          <strong>Your Position:</strong> 
          <span>You will be called shortly</span>
        </div>
        <div>
          <strong>Queue Status:</strong>
          <span>🟢 Waiting</span>
        </div>
        {appointment && (
          <div>
            <strong>Doctor:</strong>
            <span>Dr. {appointment?.Staff?.firstName} {appointment?.Staff?.lastName}</span>
          </div>
        )}
      </div>
      <div className="kiosk-countdown">
        Resetting in {countdown} seconds...
      </div>
      <button 
        className="kiosk-button kiosk-button-primary"
        onClick={resetKiosk}
      >
        🔄 New Check-in
      </button>
    </div>
  );

  const renderWalletCheck = () => {
    const fee = consultationFee || 5000;
    const isSufficient = walletBalance >= fee;
    const shortfall = fee - walletBalance;

    return (
      <div className="kiosk-wallet-check">
        <div className="kiosk-header">
          <h2>💳 Wallet Check</h2>
        </div>
        <div className="kiosk-patient-info">
          <p><strong>Patient:</strong> {patient?.firstName} {patient?.lastName}</p>
          <p><strong>Appointment:</strong> {appointment ? new Date(appointment.dateTime).toLocaleString() : 'N/A'}</p>
          <p><strong>Doctor:</strong> Dr. {appointment?.Staff?.firstName} {appointment?.Staff?.lastName}</p>
        </div>
        <div style={{
          background: isSufficient ? '#f0fdf4' : '#fef3c7',
          padding: '20px',
          borderRadius: '12px',
          margin: '16px 0',
          border: `2px solid ${isSufficient ? '#10b981' : '#f59e0b'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
            <span>💰 Wallet Balance</span>
            <span style={{ fontWeight: 'bold', color: isSufficient ? '#065f46' : '#92400e' }}>
              ₦{walletBalance.toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', marginTop: '8px' }}>
            <span>💳 Consultation Fee</span>
            <span style={{ fontWeight: 'bold', color: '#0f3460' }}>
              ₦{fee.toLocaleString()}
            </span>
          </div>
          <hr style={{ margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 'bold' }}>
            <span>{isSufficient ? '✅ Sufficient Balance' : '⚠️ Insufficient Balance'}</span>
            <span style={{ color: isSufficient ? '#10b981' : '#ef4444' }}>
              {isSufficient ? '₦' + (walletBalance - fee).toLocaleString() + ' remaining' : 'Shortfall: ₦' + shortfall.toLocaleString()}
            </span>
          </div>
        </div>

        {isSufficient ? (
          <div className="kiosk-actions">
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
              💡 The consultation fee of <strong>₦{fee.toLocaleString()}</strong> will be deducted from your wallet.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="kiosk-button kiosk-button-secondary"
                onClick={handleDeclineDeduction}
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
                ❌ Decline
              </button>
              <button 
                className="kiosk-button kiosk-button-success"
                onClick={handleConfirmDeduction}
                disabled={processingDeduction}
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
                {processingDeduction ? '⏳ Processing...' : '✅ Confirm & Check-in'}
              </button>
            </div>
          </div>
        ) : (
          <div className="kiosk-actions">
            <p style={{ color: '#92400e', fontSize: '14px', marginBottom: '12px' }}>
              ⚠️ Your wallet balance is insufficient. Please visit the billing desk to deposit funds.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="kiosk-button kiosk-button-primary"
                onClick={() => setStep('billing-redirect')}
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
                📋 Go to Billing Desk
              </button>
              <button 
                className="kiosk-button kiosk-button-secondary"
                onClick={resetKiosk}
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
                🔄 Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBillingRedirect = () => (
    <div className="kiosk-billing-redirect">
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <span style={{ fontSize: '48px' }}>💰</span>
        <h2 style={{ marginTop: '16px' }}>Please Visit the Billing Desk</h2>
        <p style={{ color: '#6b7280' }}>
          Your wallet balance is insufficient for the consultation fee.
          <br />
          Please deposit the required amount at the billing desk.
        </p>
        <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
          <p><strong>Patient:</strong> {patient?.firstName} {patient?.lastName}</p>
          <p><strong>Consultation Fee:</strong> ₦{(consultationFee || 5000).toLocaleString()}</p>
          <p><strong>Current Balance:</strong> ₦{walletBalance.toLocaleString()}</p>
          <p><strong>Shortfall:</strong> ₦{((consultationFee || 5000) - walletBalance).toLocaleString()}</p>
        </div>
        <button 
          className="kiosk-button kiosk-button-primary"
          onClick={resetKiosk}
          style={{
            marginTop: '20px',
            background: '#0f3460',
            color: 'white',
            border: 'none',
            padding: '12px 30px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🔄 Start Over
        </button>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="kiosk-container">
      {step === 'welcome' && renderWelcome()}
      {step === 'input' && renderInput()}
      {step === 'wallet-check' && renderWalletCheck()}
      {step === 'wallet-insufficient' && renderWalletCheck()}
      {step === 'billing-redirect' && renderBillingRedirect()}
      {step === 'confirm' && renderConfirm()}
      {step === 'success' && renderSuccess()}
    </div>
  );
};

export default KioskMode;