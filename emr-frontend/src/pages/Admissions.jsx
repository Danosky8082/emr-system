// src/pages/Admissions.jsx - ADD THIS

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';

const Admissions = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
  const [admissions, setAdmissions] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWardModal, setShowWardModal] = useState(false);
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [newWard, setNewWard] = useState({ name: '', description: '', capacity: '' });
  const [newAdmission, setNewAdmission] = useState({
    patientId: '',
    staffId: '',
    wardId: '',
    notes: ''
  });
  const [patients, setPatients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [editingWard, setEditingWard] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adRes, wardRes, patientRes, staffRes] = await Promise.all([
        axios.get('http://localhost:3000/api/admissions', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/wards', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/patients', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/staff', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAdmissions(adRes.data);
      setWards(wardRes.data);
      setPatients(patientRes.data || []);
      setStaff(staffRes.data || []);
    } catch (error) { 
      console.error('Fetch error:', error);
      toast.error('Failed to load data'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ✅ ADD THIS: Create Ward
  const handleCreateWard = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/wards', newWard, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast.success('Ward created successfully!');
      setShowWardModal(false);
      setNewWard({ name: '', description: '', capacity: '' });
      fetchData();
    } catch (error) { 
      toast.error(error.response?.data?.error || 'Failed to create ward'); 
    }
  };

  // ✅ ADD THIS: Edit Ward
  const handleEditWard = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:3000/api/wards/${editingWard.id}`, editingWard, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast.success('Ward updated successfully!');
      setShowWardModal(false);
      setEditingWard(null);
      setNewWard({ name: '', description: '', capacity: '' });
      fetchData();
    } catch (error) { 
      toast.error(error.response?.data?.error || 'Failed to update ward'); 
    }
  };

  // ✅ ADD THIS: Delete Ward
  const handleDeleteWard = async (id) => {
    if (!window.confirm('Delete this ward? This will also remove all associated data.')) return;
    try {
      await axios.delete(`http://localhost:3000/api/wards/${id}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast.success('Ward deleted successfully');
      fetchData();
    } catch (error) { 
      toast.error(error.response?.data?.error || 'Cannot delete ward with active admissions'); 
    }
  };

  // ✅ ADD THIS: Create Admission
  const handleCreateAdmission = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/admissions', newAdmission, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast.success('Patient admitted successfully!');
      setShowAdmissionModal(false);
      setNewAdmission({ patientId: '', staffId: '', wardId: '', notes: '' });
      fetchData();
    } catch (error) { 
      toast.error(error.response?.data?.error || 'Failed to admit patient'); 
    }
  };

  // ✅ ADD THIS: Discharge Patient
  const handleDischarge = async (id) => {
    if (!window.confirm('Discharge this patient?')) return;
    try {
      await axios.patch(`http://localhost:3000/api/admissions/${id}/discharge`, 
        { notes: 'Discharged by staff' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Patient discharged successfully');
      fetchData();
    } catch (error) { 
      toast.error('Failed to discharge patient'); 
    }
  };

  const isAdmin = ['Admin', 'ITAdmin'].includes(user?.role);
  const filteredAdmissions = admissions.filter(a => 
    `${a.Patient?.firstName} ${a.Patient?.lastName} ${a.admissionNumber}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🏥 ADT Tracking (Admissions, Discharges, Transfers)</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowAdmissionModal(true)}>
            ➕ Admit Patient
          </button>
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => {
              setEditingWard(null);
              setNewWard({ name: '', description: '', capacity: '' });
              setShowWardModal(true);
            }}>
              🏥 Manage Wards
            </button>
          )}
          <button className="btn btn-secondary" onClick={fetchData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">🏥</div>
          <div className="stat-info">
            <div className="stat-value">{wards.length}</div>
            <div className="stat-label">Total Wards</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">🛏️</div>
          <div className="stat-info">
            <div className="stat-value">{admissions.filter(a => a.status === 'Admitted').length}</div>
            <div className="stat-label">Currently Admitted</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{admissions.filter(a => a.status === 'Discharged').length}</div>
            <div className="stat-label">Discharged</div>
          </div>
        </div>
      </div>

      {/* Admissions Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Admission No.</th>
              <th>Patient</th>
              <th>Ward</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdmissions.map(a => (
              <tr key={a.id}>
                <td><strong>{a.admissionNumber}</strong></td>
                <td>{a.Patient?.firstName} {a.Patient?.lastName}</td>
                <td>{a.Ward?.name || 'N/A'}</td>
                <td>{a.Staff?.firstName} {a.Staff?.lastName}</td>
                <td>{new Date(a.admissionDate).toLocaleDateString()}</td>
                <td>
                  <span className={`status-badge ${a.status === 'Admitted' ? 'status-active' : 'status-inactive'}`}>
                    {a.status}
                  </span>
                </td>
                <td>
                  {a.status === 'Admitted' ? (
                    <button className="btn btn-sm btn-danger" onClick={() => handleDischarge(a.id)}>
                      Discharge
                    </button>
                  ) : (
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>Discharged</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredAdmissions.length === 0 && (
              <tr><td colSpan="7" className="text-center">No admissions found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============================================================
          WARD MANAGEMENT MODAL
          ============================================================ */}
      {showWardModal && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowWardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingWard ? '✏️ Edit Ward' : '🏥 Manage Wards'}</h3>
              <button className="modal-close" onClick={() => setShowWardModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Add/Edit Ward Form */}
              <form onSubmit={editingWard ? handleEditWard : handleCreateWard}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ward Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={editingWard ? editingWard.name : newWard.name} 
                      onChange={e => {
                        if (editingWard) {
                          setEditingWard({...editingWard, name: e.target.value});
                        } else {
                          setNewWard({...newWard, name: e.target.value});
                        }
                      }} 
                      placeholder="e.g., General Ward"
                    />
                  </div>
                  <div className="form-group">
                    <label>Capacity</label>
                    <input 
                      type="number" 
                      value={editingWard ? editingWard.capacity : newWard.capacity} 
                      onChange={e => {
                        if (editingWard) {
                          setEditingWard({...editingWard, capacity: parseInt(e.target.value) || ''});
                        } else {
                          setNewWard({...newWard, capacity: e.target.value});
                        }
                      }} 
                      placeholder="e.g., 20"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input 
                    type="text" 
                    value={editingWard ? editingWard.description : newWard.description} 
                    onChange={e => {
                      if (editingWard) {
                        setEditingWard({...editingWard, description: e.target.value});
                      } else {
                        setNewWard({...newWard, description: e.target.value});
                      }
                    }} 
                    placeholder="e.g., General medical ward"
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  {editingWard ? 'Update Ward' : 'Add Ward'}
                </button>
                {editingWard && (
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setEditingWard(null);
                    setNewWard({ name: '', description: '', capacity: '' });
                  }} style={{ marginLeft: '10px' }}>
                    Cancel Edit
                  </button>
                )}
              </form>

              <hr style={{ margin: '20px 0' }} />

              {/* Existing Wards List */}
              <h4>Existing Wards</h4>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {wards.length > 0 ? (
                  wards.map(w => (
                    <div key={w.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderBottom: '1px solid #f0f2f5'
                    }}>
                      <div>
                        <strong>{w.name}</strong>
                        {w.description && <span style={{ color: '#6b7280', fontSize: '13px', marginLeft: '8px' }}>- {w.description}</span>}
                        {w.capacity && <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '8px' }}>🛏️ {w.capacity}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          className="btn btn-sm btn-edit" 
                          onClick={() => {
                            setEditingWard(w);
                            setNewWard({ name: '', description: '', capacity: '' });
                          }}
                          style={{
                            background: '#0f3460',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={() => handleDeleteWard(w.id)}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#6b7280', textAlign: 'center' }}>No wards created yet. Add your first ward above!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          ADMIT PATIENT MODAL
          ============================================================ */}
      {showAdmissionModal && (
        <div className="modal-overlay" onClick={() => setShowAdmissionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>➕ Admit Patient</h3>
              <button className="modal-close" onClick={() => setShowAdmissionModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAdmission}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Patient *</label>
                  <select
                    value={newAdmission.patientId}
                    onChange={e => setNewAdmission({...newAdmission, patientId: e.target.value})}
                    required
                  >
                    <option value="">Select Patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.hospitalId} - {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Doctor/Staff *</label>
                  <select
                    value={newAdmission.staffId}
                    onChange={e => setNewAdmission({...newAdmission, staffId: e.target.value})}
                    required
                  >
                    <option value="">Select Doctor...</option>
                    {staff.filter(s => s.role === 'Doctor' || s.role === 'Obstetrician').map(s => (
                      <option key={s.id} value={s.id}>
                        Dr. {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ward *</label>
                  <select
                    value={newAdmission.wardId}
                    onChange={e => setNewAdmission({...newAdmission, wardId: e.target.value})}
                    required
                  >
                    <option value="">Select Ward...</option>
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.capacity ? `(${w.capacity} beds)` : ''}
                      </option>
                    ))}
                  </select>
                  {wards.length === 0 && (
                    <small style={{ color: '#ef4444' }}>
                      ⚠️ No wards available. Please create a ward first.
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={newAdmission.notes}
                    onChange={e => setNewAdmission({...newAdmission, notes: e.target.value})}
                    rows="2"
                    placeholder="Reason for admission, diagnosis, etc."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdmissionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={wards.length === 0}>
                  Admit Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admissions;