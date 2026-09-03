// src/pages/ArchivedPatientsView.jsx - Enhanced with View-Only Support & Proper Endpoints

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
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [wards, setWards] = useState([]);
  const [reactivationData, setReactivationData] = useState({
    reason: '',
    destinationType: 'CLINIC',
    clinicId: '',
    wardId: ''
  });
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Role-based permissions
  const canView = ['Admin', 'ITAdmin', 'Records', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(user?.role);
  const canReactivate = ['Admin', 'Records'].includes(user?.role);
  const canRequestReactivation = ['Doctor', 'Obstetrician'].includes(user?.role);
  const isClinicalStaff = ['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(user?.role);

  // ✅ FETCH ARCHIVED PATIENTS - Using the correct endpoint
  const fetchArchivedPatients = async () => {
    setLoading(true);
    try {
      let endpoint = 'http://localhost:3000/api/patients/archived';
      
      // Admin and Records get full access
      if (['Admin', 'Records'].includes(user?.role)) {
        endpoint = 'http://localhost:3000/api/patients/archived';
        setIsViewOnly(false);
      } else {
        // For Doctors, Nurses, etc. use view-only endpoint
        endpoint = 'http://localhost:3000/api/patients/archived-view';
        setIsViewOnly(true);
      }
      
      console.log(`📡 Fetching archived patients from: ${endpoint}`);
      
      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle different response formats
      let data = [];
      if (Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res.data.patients && Array.isArray(res.data.patients)) {
        data = res.data.patients;
      } else {
        data = [];
      }
      
      console.log(`✅ Found ${data.length} archived patients`);
      setPatients(data);
      setTotal(data.length);
    } catch (error) {
      console.error('❌ Fetch archived error:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to view archived patients.');
      } else if (error.response?.status === 404) {
        toast.error('Archived patients endpoint not found. Please contact administrator.');
      } else {
        toast.error('Failed to load archived patients');
      }
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH CLINICS AND WARDS for reactivation modal
  const fetchClinicsAndWards = async () => {
    try {
      const [clinicRes, wardRes] = await Promise.all([
        axios.get('http://localhost:3000/api/clinics', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/wards', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setClinics(clinicRes.data || []);
      setWards(wardRes.data || []);
    } catch (error) {
      console.error('Error fetching clinics/wards:', error);
    }
  };

  useEffect(() => {
    if (token && canView) {
      fetchArchivedPatients();
      if (canReactivate) {
        fetchClinicsAndWards();
      }
    }
  }, [token]);

  // ✅ HANDLE REACTIVATE (for Admin & Records)
  const handleReactivate = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    
    try {
      const payload = {
        reason: reactivationData.reason || 'Manual reactivation',
        destinationType: reactivationData.destinationType,
        clinicId: reactivationData.destinationType === 'CLINIC' ? reactivationData.clinicId : null,
        wardId: reactivationData.destinationType === 'WARD' ? reactivationData.wardId : null
      };
      
      console.log('📤 Reactivating patient:', selectedPatient.id, payload);
      
      const res = await axios.post(
        `http://localhost:3000/api/patients/${selectedPatient.id}/activate`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(res.data.message || '✅ File reactivated successfully!');
      setShowReactivateModal(false);
      setSelectedPatient(null);
      setReactivationData({
        reason: '',
        destinationType: 'CLINIC',
        clinicId: '',
        wardId: ''
      });
      fetchArchivedPatients();
    } catch (error) {
      console.error('❌ Reactivate error:', error);
      toast.error(error.response?.data?.error || 'Failed to reactivate file');
    }
  };

  // ✅ HANDLE REQUEST REACTIVATION (for Doctors)
  const handleRequestReactivation = async (patient) => {
    const reason = prompt(`Reason for requesting reactivation of ${patient.firstName} ${patient.lastName}:`);
    if (!reason) return;

    try {
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

  // ✅ HANDLE UNARCHIVE (for Admin & Records)
  const handleUnarchive = async (patient) => {
    if (!window.confirm(`Unarchive ${patient.firstName} ${patient.lastName}? This will restore them to active patients.`)) return;
    
    try {
      await axios.post(
        `http://localhost:3000/api/patients/${patient.id}/unarchive`,
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

  // ✅ FILTER PATIENTS
  const filteredPatients = patients.filter(p => {
    const searchString = `${p.firstName || ''} ${p.lastName || ''} ${p.hospitalId || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  // Check if user has permission to view
  if (!canView) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '48px' }}>🔒</span>
          <h3 style={{ color: '#1f2937', marginTop: '16px' }}>Access Denied</h3>
          <p style={{ color: '#6b7280' }}>You don't have permission to view archived patients.</p>
        </div>
      </div>
    );
  }

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
        <h2>📦 Archived Files</h2>
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
            Total: <strong>{total}</strong> archived files
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

      {/* Info Banner */}
      {isClinicalStaff && (
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
            {canReactivate && (
              <span style={{ fontSize: '14px', color: '#1e3a5f', display: 'block', marginTop: '4px' }}>
                🔄 You can reactivate files to bring them back to the active system.
              </span>
            )}
            {canRequestReactivation && (
              <span style={{ fontSize: '14px', color: '#1e3a5f', display: 'block', marginTop: '4px' }}>
                📋 You can <strong>request reactivation</strong> by clicking the button below.
              </span>
            )}
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
                  <td>{calculateAge(p.dateOfBirth)}</td>
                  <td>{p.archivedAt ? new Date(p.archivedAt).toLocaleDateString() : '—'}</td>
                  <td style={{ fontSize: '13px', color: '#6b7280', maxWidth: '200px' }}>
                    {p.archivedReason || '—'}
                    {p.autoArchived && (
                      <span style={{ 
                        marginLeft: '6px',
                        padding: '2px 8px',
                        background: '#dbeafe',
                        borderRadius: '10px',
                        fontSize: '10px',
                        color: '#1e40af'
                      }}>
                        Auto
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {/* View File Button */}
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
                      
                      {/* Reactivate Button - Admin & Records only */}
                      {canReactivate && !isViewOnly && (
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
                          onClick={() => {
                            setSelectedPatient(p);
                            setReactivationData({
                              reason: '',
                              destinationType: 'CLINIC',
                              clinicId: '',
                              wardId: ''
                            });
                            setShowReactivateModal(true);
                          }}
                        >
                          🔄 Reactivate
                        </button>
                      )}
                      
                      {/* Unarchive Button - Admin & Records only */}
                      {canReactivate && !isViewOnly && (
                        <button 
                          className="btn btn-sm" 
                          style={{ 
                            background: '#f59e0b', 
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                          onClick={() => handleUnarchive(p)}
                        >
                          📂 Unarchive
                        </button>
                      )}
                      
                      {/* Request Reactivation Button - Doctors only */}
                      {canRequestReactivation && isViewOnly && (
                        <button 
                          className="btn btn-sm" 
                          style={{ 
                            background: '#f59e0b', 
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                          onClick={() => handleRequestReactivation(p)}
                        >
                          📋 Request Reactivation
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
            <p style={{ fontSize: '16px' }}>📦 No archived files found.</p>
            <p style={{ fontSize: '14px' }}>
              {searchTerm ? 'Try adjusting your search terms.' : 'Archived files will appear here after 48 hours of inactivity.'}
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
            <span>⏰ Auto-archive after: <strong>48 hours</strong></span>
          </div>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowReactivateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>🔄 Reactivate File</h3>
              <button className="modal-close" onClick={() => setShowReactivateModal(false)}>×</button>
            </div>
            <form onSubmit={handleReactivate}>
              <div className="modal-body">
                <div style={{
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>Patient:</strong> {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    ID: {selectedPatient.hospitalId}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    Archived: {selectedPatient.archivedAt ? new Date(selectedPatient.archivedAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>

                <div className="form-group">
                  <label>Reason for Reactivation *</label>
                  <textarea
                    value={reactivationData.reason}
                    onChange={(e) => setReactivationData({...reactivationData, reason: e.target.value})}
                    required
                    rows="2"
                    placeholder="e.g., Patient returning for follow-up"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label>Destination Type *</label>
                  <select
                    value={reactivationData.destinationType}
                    onChange={(e) => setReactivationData({
                      ...reactivationData, 
                      destinationType: e.target.value,
                      clinicId: '',
                      wardId: ''
                    })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="CLINIC">🏥 Clinic (Outpatient)</option>
                    <option value="WARD">🛏️ Ward (Inpatient)</option>
                  </select>
                </div>
                
                {reactivationData.destinationType === 'CLINIC' && (
                  <div className="form-group">
                    <label>Select Clinic *</label>
                    <select
                      value={reactivationData.clinicId}
                      onChange={(e) => setReactivationData({...reactivationData, clinicId: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select Clinic...</option>
                      {clinics.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {reactivationData.destinationType === 'WARD' && (
                  <div className="form-group">
                    <label>Select Ward *</label>
                    <select
                      value={reactivationData.wardId}
                      onChange={(e) => setReactivationData({...reactivationData, wardId: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select Ward...</option>
                      {wards.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReactivateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  🔄 Reactivate & Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedPatientsView;