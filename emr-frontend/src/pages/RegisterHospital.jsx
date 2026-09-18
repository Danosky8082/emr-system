// src/pages/RegisterHospital.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Login.css';

const RegisterHospital = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    hospitalName: '',
    slug: '',
    code: '',
    usernamePrefix: '',          // ← NEW
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    adminPassword: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'slug') {
      processedValue = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    } else if (name === 'code') {
      processedValue = value.toUpperCase();
    } else if (name === 'usernamePrefix') {
      // Only letters and numbers, lowercase
      processedValue = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    setFormData((prev) => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await axios.post(
      'http://localhost:3000/api/public/register-hospital',
      formData
    );

    const { hospital, admin } = res.data;

    toast.success(`Welcome, ${hospital.name}!`);

    // Send the user to login, and carry the generated username so
    // the login page can pre-fill / display it.
    navigate(`/h/${hospital.slug}/login`, {
      state: {
        justRegistered: true,
        adminUsername: admin.username,   // ← stmary-7231
        hospitalName: hospital.name,
      },
    });
  } catch (error) {
    toast.error(error.response?.data?.error || 'Registration failed');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="login-screen app-container">
      <div className="login-container" style={{ maxWidth: '520px' }}>
        <div className="login-header">
          <h1>🏥 Register Your Hospital</h1>
          <p>Start your 14-day free trial</p>
        </div>

        <form onSubmit={handleSubmit}>
          <h3 style={{ fontSize: '14px', color: '#6b7280', marginTop: '16px' }}>
            Hospital Details
          </h3>

          <div className="form-group">
            <label>Hospital Name *</label>
            <input
              type="text"
              name="hospitalName"
              value={formData.hospitalName}
              onChange={handleChange}
              placeholder="Lagos General Hospital"
              required
            />
          </div>

          <div className="form-group">
            <label>URL Slug *</label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              placeholder="lagos-general"
              required
            />
            <small style={{ color: '#6b7280' }}>
              Your login URL: /h/{formData.slug || 'your-hospital'}/login
            </small>
          </div>

          <div className="form-group">
            <label>Hospital Code *</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="LGH001"
              required
            />
          </div>

          <div className="form-group">
            <label>Username Prefix *</label>
            <input
              type="text"
              name="usernamePrefix"
              value={formData.usernamePrefix}
              onChange={handleChange}
              placeholder="e.g., stmarys"
              pattern="[a-z0-9]{2,20}"
              minLength={2}
              maxLength={20}
              required
            />
            <small style={{ color: '#6b7280' }}>
              Short lowercase identifier for staff logins.{' '}
              {formData.usernamePrefix && (
                <>
                  Staff will log in as <code>{formData.usernamePrefix}-username</code>.
                </>
              )}
            </small>
          </div>

          <h3 style={{ fontSize: '14px', color: '#6b7280', marginTop: '24px' }}>
            Admin Account
          </h3>

          <div className="form-group">
            <label>Your First Name *</label>
            <input
              type="text"
              name="adminFirstName"
              value={formData.adminFirstName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Your Last Name *</label>
            <input
              type="text"
              name="adminLastName"
              value={formData.adminLastName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="adminEmail"
              value={formData.adminEmail}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              name="adminPassword"
              value={formData.adminPassword}
              onChange={handleChange}
              minLength={8}
              required
            />
            <small style={{ color: '#6b7280' }}>Minimum 8 characters</small>
          </div>

          {formData.slug && (
  <div
    style={{
      background: '#eff6ff',
      border: '1px solid #3b82f6',
      borderRadius: '8px',
      padding: '12px 16px',
      marginTop: '8px',
      marginBottom: '16px',
      fontSize: '13px',
      color: '#1e3a5f',
    }}
  >
    📋 <strong>Your admin username will be generated automatically</strong>
    <br />
    It will look like <code style={{ background: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
      {formData.slug}-1234
    </code>
    <br />
    <span style={{ color: '#6b7280' }}>
      We'll show it to you on the next screen — save it for login.
    </span>
  </div>
)}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating...' : '🚀 Create Hospital'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '13px',
            color: '#6b7280',
          }}
        >
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterHospital;