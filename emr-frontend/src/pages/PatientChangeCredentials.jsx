// src/pages/PatientChangeCredentials.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './PatientChangeCredentials.css';

const PatientChangeCredentials = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('pin');
  const [formData, setFormData] = useState({
    currentCredential: '',
    newCredential: '',
    confirmCredential: '',
  });

  const token = localStorage.getItem('patient_token');
  const patient = JSON.parse(localStorage.getItem('patient_data') || '{}');

  useEffect(() => {
    // Redirect if not logged in or not required to change
    const mustChange = localStorage.getItem('must_change_password') === 'true';
    console.log('🔍 Must change password:', mustChange);
    console.log('🔍 Token:', token);
    
    if (!token) {
      navigate('/patient-login');
    } else if (!mustChange) {
      navigate('/patient-dashboard');
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        'http://localhost:3000/api/patient/change-credentials',
        {
          currentCredential: formData.currentCredential,
          newCredential: formData.newCredential,
          confirmCredential: formData.confirmCredential,
          type: type,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('✅ Credentials changed:', response.data);

      // Store new token
      localStorage.setItem('patient_token', response.data.token);
      localStorage.setItem('must_change_password', 'false');
      
      toast.success(`✅ ${type === 'pin' ? 'PIN' : 'Password'} changed successfully!`);
      navigate('/patient-dashboard');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to change credentials';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="patient-change-credentials-page">
      <div className="change-credentials-container">
        <div className="change-header">
          <h2>🔐 Change Your {type === 'pin' ? 'PIN' : 'Password'}</h2>
          <p>For security, please change your temporary credentials</p>
        </div>

        <div className="change-credentials-card">
          <div className="security-banner">
            <span>🛡️</span>
            <div>
              <strong>Security First</strong>
              <p>Choose a {type === 'pin' ? '4-6 digit PIN' : 'strong password'} you can remember</p>
            </div>
          </div>

          <div className="type-toggle">
            <button 
              className={`toggle-btn ${type === 'pin' ? 'active' : ''}`}
              onClick={() => setType('pin')}
            >
              🔢 Change PIN
            </button>
            <button 
              className={`toggle-btn ${type === 'password' ? 'active' : ''}`}
              onClick={() => setType('password')}
            >
              🔐 Change Password
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Current {type === 'pin' ? 'PIN' : 'Password'}</label>
              <input
                type="password"
                placeholder={`Enter your current ${type === 'pin' ? 'PIN' : 'password'}`}
                value={formData.currentCredential}
                onChange={(e) => setFormData({...formData, currentCredential: e.target.value})}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>New {type === 'pin' ? 'PIN' : 'Password'}</label>
              <input
                type="password"
                placeholder={`Enter new ${type === 'pin' ? '4-6 digit PIN' : 'password (min 6 characters)'}`}
                value={formData.newCredential}
                onChange={(e) => setFormData({...formData, newCredential: e.target.value})}
                required
                className="form-input"
              />
              <span className="helper-text">
                {type === 'pin' 
                  ? 'PIN must be 4-6 digits (numbers only)' 
                  : 'Password must be at least 6 characters'}
              </span>
            </div>

            <div className="form-group">
              <label>Confirm New {type === 'pin' ? 'PIN' : 'Password'}</label>
              <input
                type="password"
                placeholder="Confirm your new credential"
                value={formData.confirmCredential}
                onChange={(e) => setFormData({...formData, confirmCredential: e.target.value})}
                required
                className="form-input"
              />
            </div>

            <button type="submit" className="change-submit-btn" disabled={loading}>
              {loading ? '⏳ Updating...' : `✅ Change ${type === 'pin' ? 'PIN' : 'Password'}`}
            </button>
          </form>

          <div className="change-footer">
            <button 
              className="logout-link"
              onClick={() => {
                localStorage.clear();
                navigate('/patient-login');
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientChangeCredentials;