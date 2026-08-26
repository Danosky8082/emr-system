// src/pages/PatientLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './PatientLogin.css';

const PatientLogin = () => {
  const navigate = useNavigate();
  const [hospitalId, setHospitalId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState('pin');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { hospitalId: hospitalId.trim() };
      
      if (loginMethod === 'pin') {
        payload.pinCode = pinCode.trim();
      } else {
        payload.password = password;
      }

      const res = await axios.post('http://localhost:3000/api/patient/login', payload);

      localStorage.setItem('patient_token', res.data.token);
      localStorage.setItem('patient_data', JSON.stringify(res.data.patient));

      toast.success(`Welcome, ${res.data.patient.firstName}!`);
      navigate('/patient-dashboard');
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="patient-login-page">
      <div className="patient-login-container">
        {/* Left Side - Branding */}
        <div className="patient-login-left">
          <div className="brand-content">
            <div className="brand-icon">🏥</div>
            <h1>NexGen EMR</h1>
            <p className="brand-tagline">Patient Portal</p>
            <div className="brand-features">
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <span>Secure Access</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📋</span>
                <span>Medical Records</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📅</span>
                <span>Appointments</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💊</span>
                <span>Prescriptions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="patient-login-right">
          <div className="login-form-wrapper">
            <div className="login-header">
              <h2>Welcome Back</h2>
              <p>Access your health records securely</p>
            </div>

            {/* Login Method Toggle */}
            <div className="login-method-toggle">
              <button
                type="button"
                className={`method-btn ${loginMethod === 'pin' ? 'active' : ''}`}
                onClick={() => setLoginMethod('pin')}
              >
                <span>🔢</span> PIN
              </button>
              <button
                type="button"
                className={`method-btn ${loginMethod === 'password' ? 'active' : ''}`}
                onClick={() => setLoginMethod('password')}
              >
                <span>🔐</span> Password
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Hospital ID</label>
                <div className="input-with-icon">
                  <span className="input-icon">🆔</span>
                  <input
                    type="text"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                    placeholder="Enter your Hospital ID"
                    required
                    className="form-input"
                  />
                </div>
              </div>

              {loginMethod === 'pin' ? (
                <div className="form-group">
                  <label>PIN Code</label>
                  <div className="input-with-icon">
                    <span className="input-icon">🔑</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="Enter 4-6 digit PIN"
                      required
                      maxLength="6"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <span className="helper-text">Your PIN was provided at registration</span>
                </div>
              ) : (
                <div className="form-group">
                  <label>Password</label>
                  <div className="input-with-icon">
                    <span className="input-icon">🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <span className="helper-text">Your password was set during portal setup</span>
                </div>
              )}

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-small"></span>
                    Authenticating...
                  </>
                ) : (
                  '🔐 Secure Login'
                )}
              </button>

              <div className="login-footer-links">
                <a href="#" className="forgot-link">Forgot Password?</a>
                <span className="divider">|</span>
                <span className="help-text">Need help? Contact reception</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientLogin;