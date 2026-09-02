// src/pages/ArchivedPatients.jsx - WITH REACTIVATE BUTTON & VIEW-ONLY SUPPORT

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const ArchivedPatients = () => {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Check if user can reactivate (Records, Admin)
  const canReactivate = ['Admin', 'Records'].includes(user?.role);
  const canViewOnly = ['Doctor', 'Obstetrician'].includes(user?.role);
  const canUnarchive = ['Admin', 'Records'].includes(user?.role);

  // ✅ FETCH ARCHIVED PATIENTS - Use different endpoint for view-only
  const fetchArchivedPatients = async () => {
    setLoading(true);
    try {
      let endpoint = 'http://localhost:3000/api/patients/archived';
      
      // If user is Doctor or Obstetrician, use view-only endpoint
      if (canViewOnly) {
        endpoint = 'http://localhost:3000/api/patients/archived-view';
        setIsViewOnly(true);
      } else {
        setIsViewOnly(false);
      }
      
      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      setPatients(data);
      setTotal(data.length);
    } catch (error) {
      console.error('Fetch archived error:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to view archived patients.');
      } else {
        toast.error('Failed to load archived patients');
      }
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedPatients();
  }, []);

  // ✅ HANDLE UNARCHIVE
  const handleUnarchive = async (patient) => {
    if (!window.confirm(`Unarchive ${patient.firstName} ${patient.lastName}? This will restore them to active patients.`)) return;
    
    try {
      await axios.post(`http://localhost:3000/api/patients/${patient.id}/unarchive`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${patient.firstName} ${patient.lastName} unarchived successfully!`);
      fetchArchivedPatients();
    } catch (error) {
      console.error('Unarchive error:', error);
      toast.error(error.response?.data?.error || 'Failed to unarchive patient');
    }
  };

  // ✅ HANDLE REACTIVATE (For Admin & Records)
  const handleReactivate = async (patient) => {
    if (!window.confirm(`Reactivate ${patient.firstName} ${patient.lastName}? This will make the file active and accessible to all staff.`)) return;

    const reason = prompt('Reason for reactivation (optional):');

    try {
      await axios.post(`http://localhost:3000/api/patients/${patient.id}/activate`, {
        reason: reason || 'Manual reactivation'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`✅ ${patient.firstName} ${patient.lastName} activated successfully!`);
      fetchArchivedPatients();
    } catch (error) {
      console.error('Reactivate error:', error);
      toast.error(error.response?.data?.error || 'Failed to reactivate patient');
    }
  };

  // ✅ HANDLE REQUEST REACTIVATION (For Doctors - they can request)
  const handleRequestReactivation = async (patient) => {
    const reason = prompt(`Reason for requesting reactivation of ${patient.firstName} ${patient.lastName}:`);
    if (!reason) return;

    try {
      // Send notification to Records department
      await axios.post(`http://localhost:3000/api/patients/${patient.id}/request-reactivation`, {
        reason: reason,
        requestedBy: user?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`✅ Reactivation request sent for ${patient.firstName} ${patient.lastName}. Records department will review.`);
    } catch (error) {
      console.error('Request reactivation error:', error);
      toast.error(error.response?.data?.error || 'Failed to request reactivation');
    }
  };

  const handleViewPatient = (patientId) => {
    window.location.href = `/patient-profile/${patientId}`;
  };

  // Filter patients based on search
  const filteredPatients = patients.filter(p => 
    `${p.firstName} ${p.lastName} ${p.hospitalId}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

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
        <h2>📦 Archived Patients</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isViewOnly && (
            <span style={{ 
              fontSize: '12px', 
              background: '#f59e0b', 
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontWeight: '600'
            }}>
              👁️ View Only
            </span>
          )}
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Total: <strong>{total}</strong> patients
          </span>
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

      {/* View-Only Info Banner for Doctors */}
      {isViewOnly && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <div>
            <span style={{ fontWeight: '600', color: '#1e3a5f' }}>View Only Access</span>
            <span style={{ fontSize: '14px', color: '#1e3a5f', marginLeft: '8px' }}>
              You can view archived patient records but cannot modify them.
            </span>
            <span style={{ fontSize: '14px', color: '#1e3a5f', display: 'block', marginTop: '4px' }}>
              📋 You can <strong>request reactivation</strong> by clicking the button below.
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
                <th>Archived Date</th>
                <th>Archived By</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.hospitalId}</strong></td>
                  <td>{p.firstName} {p.lastName}</td>
                  <td>{p.gender || '—'}</td>
                  <td>{p.archivedAt ? new Date(p.archivedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    {p.autoArchived ? (
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>🤖 Auto (System)</span>
                    ) : (
                      <span style={{ color: '#0f3460', fontSize: '12px' }}>👤 Manual</span>
                    )}
                  </td>
                  <td style={{ fontSize: '13px', color: '#6b7280', maxWidth: '200px' }}>
                    {p.archivedReason || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {/* ✅ VIEW BUTTON - Available to all */}
                      <button 
                        className="btn btn-sm" 
                        style={{ 
                          background: '#6b7280', 
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                        onClick={() => handleViewPatient(p.id)}
                      >
                        👤 View
                      </button>

                      {/* ✅ REACTIVATE BUTTON - Only for Admin & Records */}
                      {canReactivate && !isViewOnly && (
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => handleReactivate(p)}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          🔄 Reactivate
                        </button>
                      )}
                      
                      {/* ✅ REQUEST REACTIVATION - For Doctors (view-only) */}
                      {isViewOnly && canViewOnly && (
                        <button 
                          className="btn btn-sm"
                          onClick={() => handleRequestReactivation(p)}
                          style={{
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          📋 Request Reactivation
                        </button>
                      )}
                      
                      {/* ✅ UNARCHIVE BUTTON - Only for Admin & Records */}
                      {canUnarchive && !isViewOnly && (
                        <button 
                          className="btn btn-sm" 
                          style={{ 
                            background: '#0f3460', 
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                          onClick={() => handleUnarchive(p)}
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
            {!searchTerm && !isViewOnly && (
              <Link to="/patient-intake" className="btn btn-primary" style={{ marginTop: '16px' }}>
                📋 Go to Patient Intake
              </Link>
            )}
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
            {!isViewOnly && (
              <span>🔄 Reactivated: <strong>{patients.filter(p => p.activationRequestedAt).length}</strong></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedPatients;