// src/pages/ModulePatientList.jsx - For Pharmacist, Lab, Radiology

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const ModulePatientList = ({ moduleType }) => {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0 });

  const moduleLabels = {
    pharmacy: { icon: '💊', label: 'Pharmacy', color: '#8b5cf6' },
    lab: { icon: '🔬', label: 'Laboratory', color: '#3b82f6' },
    radiology: { icon: '📷', label: 'Radiology', color: '#10b981' }
  };

  const moduleInfo = moduleLabels[moduleType] || { icon: '📋', label: 'Module', color: '#6b7280' };

  useEffect(() => {
    fetchPatients();
  }, [moduleType]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/module/${moduleType}/patients`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPatients(res.data.patients || []);
      setStats({
        total: res.data.total || 0,
        pending: (res.data.patients || []).filter(p => 
          p.Prescription?.some(px => px.status === 'Prescribed') ||
          p.LabOrder?.some(l => l.status === 'Ordered' || l.status === 'In Progress') ||
          p.ImagingOrder?.some(i => i.status === 'Ordered' || i.status === 'Scheduled')
        ).length
      });
    } catch (error) {
      console.error('Fetch patients error:', error);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const getPatientStatus = (patient) => {
    if (moduleType === 'pharmacy') {
      const pending = patient.Prescription?.filter(p => p.status === 'Prescribed');
      return {
        status: pending?.length > 0 ? 'Pending Dispense' : 'Completed',
        count: pending?.length || 0,
        color: pending?.length > 0 ? '#f59e0b' : '#10b981'
      };
    } else if (moduleType === 'lab') {
      const pending = patient.LabOrder?.filter(l => l.status === 'Ordered' || l.status === 'In Progress');
      return {
        status: pending?.length > 0 ? 'Pending Processing' : 'Completed',
        count: pending?.length || 0,
        color: pending?.length > 0 ? '#3b82f6' : '#10b981'
      };
    } else if (moduleType === 'radiology') {
      const pending = patient.ImagingOrder?.filter(i => i.status === 'Ordered' || i.status === 'Scheduled');
      return {
        status: pending?.length > 0 ? 'Pending Review' : 'Completed',
        count: pending?.length || 0,
        color: pending?.length > 0 ? '#f59e0b' : '#10b981'
      };
    }
    return { status: 'Unknown', count: 0, color: '#6b7280' };
  };

  const filteredPatients = patients.filter(p => 
    `${p.firstName} ${p.lastName} ${p.hospitalId}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{moduleInfo.icon}</span>
            {moduleInfo.label} - Patient List
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            👤 {user?.firstName} {user?.lastName} - {user?.role}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchPatients}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: `4px solid ${moduleInfo.color}` }}>
          <div className="stat-icon">{moduleInfo.icon}</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Patients</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
            <div className="stat-label">Pending Orders</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.total - stats.pending}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder={`🔍 Search by name or Hospital ID...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Patient Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Patient Name</th>
              <th>Phone</th>
              <th>Orders</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length > 0 ? (
              filteredPatients.map(p => {
                const status = getPatientStatus(p);
                const hasPending = status.count > 0;
                
                return (
                  <tr key={p.id} style={hasPending ? { background: '#fefce8' } : {}}>
                    <td><strong>{p.hospitalId}</strong></td>
                    <td>{p.firstName} {p.lastName}</td>
                    <td>{p.phone || '—'}</td>
                    <td>
                      <span style={{
                        background: '#f3f4f6',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {status.count} {moduleType === 'pharmacy' ? 'prescriptions' : 'orders'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: status.color,
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {status.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/patient-profile/${p.id}`}
                        className="btn btn-sm"
                        style={{
                          background: '#0f3460',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 14px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        📂 Open File
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="6" className="text-center">
                No patients with pending {moduleType} orders
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModulePatientList;