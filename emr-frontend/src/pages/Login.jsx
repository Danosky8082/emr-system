// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();
    const isEmail = trimmedIdentifier.includes('@');

    try {
      const payload = isEmail 
        ? { email: trimmedIdentifier, password: trimmedPassword }
        : { username: trimmedIdentifier.toLowerCase(), password: trimmedPassword };

      const response = await axios.post('http://localhost:3000/api/auth/login', payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      const { token, staff } = response.data;
      login(token, staff);
      navigate('/');
      toast.success(`Welcome, ${staff.firstName}!`);
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed. Try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen app-container">
      <div className="login-container">
        <div className="login-header">
          <h1>🏥 NexGen EMR</h1>
          <p>Medical Centre, Lagos</p>
          <p className="subtitle">Electronic Medical Records System</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username or Email</label>
            <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="samuel-chris or email@domain.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;