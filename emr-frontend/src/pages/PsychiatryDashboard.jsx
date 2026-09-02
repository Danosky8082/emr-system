// src/pages/PsychiatryDashboard.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const PsychiatryDashboard = () => {
  const { user } = useAuth();
  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🧠 Psychiatry Dashboard</h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>👤 {user?.firstName} {user?.lastName} - {user?.role}</p>
      </div>
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <span style={{ fontSize: '48px' }}>🧠</span>
        <h3>Psychiatry Module</h3>
        <p>Coming soon: Mental health assessments, therapy notes, and medication management.</p>
      </div>
    </div>
  );
};
export default PsychiatryDashboard;