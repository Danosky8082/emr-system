// src/components/KioskMode.jsx - COMPLETE FIXED VERSION

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './KioskMode.css';

const KioskMode = () => {
  const [step, setStep] = useState('welcome'); // welcome, input, confirm, success
  const [inputValue, setInputValue] = useState('');
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(10);
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

  const handleSearch = async () => {
    if (!inputValue.trim()) {
      toast.error('Please enter your Hospital ID or phone number');
      return;
    }

    setLoading(true);
    try {
      // ✅ USE PUBLIC ENDPOINT - No authentication required
      const res = await axios.get(
        `http://localhost:3000/api/public/patient/search?query=${encodeURIComponent(inputValue)}`
      );

      console.log('🔍 Search results:', res.data);

      if (res.data.length === 0) {
        toast.error('Patient not found. Please try again.');
        setInputValue('');
        inputRef.current?.focus();
        return;
      }

      if (res.data.length > 1) {
        toast.info(`Found ${res.data.length} patients. Please be more specific.`);
        return;
      }

      const foundPatient = res.data[0];
      setPatient(foundPatient);
      setStep('confirm');
    } catch (error) {
      console.error('Search error:', error);
      
      // ✅ Better error handling
      if (error.response?.status === 404) {
        toast.error('Search service not available. Please contact staff.');
      } else if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.');
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error('Connection timeout. Please try again.');
      } else {
        toast.error('Search failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      // ✅ Try to get staff token for check-in
      const token = localStorage.getItem('emr_token');
      
      if (!token) {
        // ✅ If no staff token, show message
        toast.error('Please contact staff to complete your check-in.');
        setLoading(false);
        return;
      }

      const res = await axios.post(
        'http://localhost:3000/api/patient/checkin',
        {
          patientId: patient.id,
          checkInMethod: 'self_kiosk'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStep('success');
      toast.success(`✅ Welcome ${patient.firstName}! You are checked in.`);
    } catch (error) {
      console.error('Check-in error:', error);
      if (error.response?.status === 401) {
        toast.error('Authentication failed. Please contact staff.');
      } else if (error.response?.status === 404) {
        toast.error('Check-in service not available.');
      } else {
        toast.error(error.response?.data?.error || 'Check-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetKiosk = () => {
    setStep('welcome');
    setInputValue('');
    setPatient(null);
    setCountdown(10);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (step === 'input') {
        handleSearch();
      } else if (step === 'confirm') {
        handleCheckIn();
      }
    }
  };

  // Render different screens
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
          onClick={handleCheckIn}
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

  return (
    <div className="kiosk-container">
      {step === 'welcome' && renderWelcome()}
      {step === 'input' && renderInput()}
      {step === 'confirm' && renderConfirm()}
      {step === 'success' && renderSuccess()}
    </div>
  );
};

export default KioskMode;