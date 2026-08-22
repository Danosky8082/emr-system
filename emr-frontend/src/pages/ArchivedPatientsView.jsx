// src/pages/ArchivedPatientsView.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const ArchivedPatientsView = () => {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchArchivedPatients = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/patients/archived', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      setPatients(data);
      setTotal(data.length);
    } catch (error) {
      console.error('Fetch archived error:', error);
      toast.error('Failed to load archived patients');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchArchivedPatients();
    }
  }, [token]);

  // Filter patients based on search
  const filteredPatients = patients.filter(p => 
    `${p.firstName} ${p.lastName} ${p.hospitalId}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const isClinicalStaff = ['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(user?.role);

  if (loading) {
    return (
      <div className="dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div className="spinner" />
        <p style={{ marginTop: '20px', color: '#6b7280' }}>Loading archived patients...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>📦 Archived Patients (View Only)</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Total: <strong>{total}</strong> patients
          </span>
          {isClinicalStaff && (
            <span style={{ 
              fontSize: '12px', 
              color: '#10b981', 
              background: '#d1fae5', 
              padding: '4px 12px', 
              borderRadius: '12px' 
            }}>
              👁️ View Only
            </span>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={fetchArchivedPatients}
            style={{ 
              background: '#0f3460', 
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Info Banner for Clinical Staff */}
      {isClinicalStaff && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <div>
            <span style={{ fontWeight: '600', color: '#1e3a5f' }}>View Only Access</span>
            <span style={{ fontSize: '14px', color: '#1e3a5f', marginLeft: '8px' }}>
              You can view archived patient records but cannot unarchive or manage them.
              <br />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                For unarchive requests, please contact the Records department.
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="🔍 Search by name or Hospital ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: '1',
            minWidth: '250px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
        {searchTerm && (
          <button 
            className="btn btn-sm btn-secondary"
            onClick={() => setSearchTerm('')}
            style={{ 
              background: '#e5e7eb', 
              color: '#1f2937',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div className="table-container">
        {filteredPatients.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Hospital ID</th>
                <th>Patient Name</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Archived Date</th>
                <th>Archived By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.hospitalId}</strong></td>
                  <td>{p.firstName} {p.lastName}</td>
                  <td>{p.gender || '—'}</td>
                  <td>{calculateAge(p.dateOfBirth)}</td>
                  <td>{p.archivedAt ? new Date(p.archivedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    {p.autoArchived ? (
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>🤖 Auto (System)</span>
                    ) : (
                      <span style={{ color: '#0f3460', fontSize: '12px' }}>👤 Manual</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
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
                          gap: '5px'
                        }}
                      >
                        📂 Open File
                      </Link>
                      {!isClinicalStaff && (
                        <button 
                          className="btn btn-sm" 
                          style={{ 
                            background: '#10b981', 
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                          onClick={() => {/* handle unarchive - only for records */}}
                        >
                          📂 Unarchive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
            <p style={{ fontSize: '16px' }}>📦 No archived patients found.</p>
            <p style={{ fontSize: '14px' }}>
              {searchTerm ? 'Try adjusting your search terms.' : 'Archived patients will appear here when they are archived from the Patient Intake pipeline.'}
            </p>
          </div>
        )}
      </div>

      {/* Archive Statistics */}
      {patients.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '16px 20px', 
          background: '#f8fafc', 
          borderRadius: '8px',
          border: '1px solid #e8ecf1',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          justifyContent: 'space-between'
        }}>
          <div>
            <strong>📊 Archive Summary</strong>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span>📦 Total Archived: <strong>{patients.length}</strong></span>
            <span>👤 Manual: <strong>{patients.filter(p => !p.autoArchived).length}</strong></span>
            <span>🤖 Auto: <strong>{patients.filter(p => p.autoArchived).length}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedPatientsView;