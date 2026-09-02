// src/pages/DentalDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const DentalDashboard = () => {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [dentalChart, setDentalChart] = useState([]);
  const [procedures, setProcedures] = useState([]);
  
  const [procedureForm, setProcedureForm] = useState({
    patientId: '',
    teethNumber: '',
    condition: '',
    procedure: '',
    treatmentPlan: '',
    notes: ''
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/dental/patients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatients(res.data);
    } catch (error) {
      console.error('Fetch patients error:', error);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchProcedures = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/dental/procedures', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProcedures(res.data);
    } catch (error) {
      console.error('Fetch procedures error:', error);
    }
  };

  const fetchDentalChart = async (patientId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/dental/chart/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDentalChart(res.data.chart);
      setSelectedPatient(patients.find(p => p.id === patientId));
      setShowChartModal(true);
    } catch (error) {
      console.error('Fetch chart error:', error);
      toast.error('Failed to load dental chart');
    }
  };

  const handleProcedureSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/dental', {
        patientId: procedureForm.patientId,
        teethNumber: procedureForm.teethNumber,
        condition: procedureForm.condition,
        procedure: procedureForm.procedure,
        treatmentPlan: procedureForm.treatmentPlan,
        notes: procedureForm.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Dental procedure recorded successfully!');
      setShowProcedureModal(false);
      setProcedureForm({
        patientId: '',
        teethNumber: '',
        condition: '',
        procedure: '',
        treatmentPlan: '',
        notes: ''
      });
      fetchPatients();
    } catch (error) {
      toast.error('Failed to record procedure');
    }
  };

  useEffect(() => {
    if (token) {
      fetchPatients();
      fetchProcedures();
    }
  }, [token]);

  const getToothColor = (tooth) => {
    const colors = {
      healthy: '#10b981',
      cavity: '#ef4444',
      filled: '#f59e0b',
      missing: '#6b7280',
      crown: '#8b5cf6',
      treated: '#3b82f6'
    };
    return colors[tooth.status] || '#e5e7eb';
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🦷 Dental Clinic</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setProcedureForm({ ...procedureForm, patientId: '' });
              setShowProcedureModal(true);
            }}
          >
            ➕ New Procedure
          </button>
          <button className="btn btn-secondary" onClick={fetchPatients}>
            🔄 Refresh
          </button>
        </div>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          👤 {user?.firstName} {user?.lastName} - {user?.role}
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">🦷</div>
          <div className="stat-info">
            <div className="stat-value">{patients.length}</div>
            <div className="stat-label">Total Patients</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{patients.filter(p => p.dental_records?.[0]?.condition === 'treated').length}</div>
            <div className="stat-label">Treated</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{patients.filter(p => p.dental_records?.[0]?.condition === 'cavity').length}</div>
            <div className="stat-label">Needs Treatment</div>
          </div>
        </div>
      </div>

      {/* Patients Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Patient Name</th>
              <th>Last Visit</th>
              <th>Last Procedure</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length > 0 ? (
              patients.map(p => {
                const lastRecord = p.dental_records?.[0];
                return (
                  <tr key={p.id}>
                    <td><strong>{p.hospitalId}</strong></td>
                    <td>{p.firstName} {p.lastName}</td>
                    <td>{lastRecord ? new Date(lastRecord.examinationDate).toLocaleDateString() : '—'}</td>
                    <td>{lastRecord?.procedure || '—'}</td>
                    <td>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: lastRecord?.condition === 'cavity' ? '#fecaca' :
                                   lastRecord?.condition === 'treated' ? '#d1fae5' : '#f3f4f6',
                        color: lastRecord?.condition === 'cavity' ? '#991b1b' :
                               lastRecord?.condition === 'treated' ? '#065f46' : '#374151'
                      }}>
                        {lastRecord?.condition || 'New'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => fetchDentalChart(p.id)}
                          style={{
                            background: '#0f3460',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          📊 Chart
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setProcedureForm({
                              ...procedureForm,
                              patientId: p.id
                            });
                            setShowProcedureModal(true);
                          }}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          🦷 Procedure
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  No dental patients found. Record a dental procedure to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Procedure Modal */}
      {showProcedureModal && (
        <div className="modal-overlay" onClick={() => setShowProcedureModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>🦷 Record Dental Procedure</h3>
              <button className="modal-close" onClick={() => setShowProcedureModal(false)}>×</button>
            </div>
            <form onSubmit={handleProcedureSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Patient</label>
                  <select
                    value={procedureForm.patientId}
                    onChange={(e) => setProcedureForm({...procedureForm, patientId: e.target.value})}
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
                  <label>Teeth Number</label>
                  <input
                    type="text"
                    value={procedureForm.teethNumber}
                    onChange={(e) => setProcedureForm({...procedureForm, teethNumber: e.target.value})}
                    placeholder="e.g., 11, 12, 21 (FDI numbering)"
                  />
                  <small>Use FDI numbering: 1-32 (1=upper right, 16=upper left, 17=lower left, 32=lower right)</small>
                </div>

                <div className="form-group">
                  <label>Condition</label>
                  <select
                    value={procedureForm.condition}
                    onChange={(e) => setProcedureForm({...procedureForm, condition: e.target.value})}
                    required
                  >
                    <option value="">Select Condition...</option>
                    <option value="Cavity">🦷 Cavity</option>
                    <option value="Filling">🔄 Filling</option>
                    <option value="Crown">👑 Crown</option>
                    <option value="Extraction">🔧 Extraction</option>
                    <option value="Root Canal">🩺 Root Canal</option>
                    <option value="Cleaning">🧹 Cleaning</option>
                    <option value="Whitening">✨ Whitening</option>
                    <option value="Other">📌 Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Procedure</label>
                  <select
                    value={procedureForm.procedure}
                    onChange={(e) => setProcedureForm({...procedureForm, procedure: e.target.value})}
                  >
                    <option value="">Select Procedure...</option>
                    {procedures.map(p => (
                      <option key={p.code} value={p.name}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Treatment Plan</label>
                  <input
                    type="text"
                    value={procedureForm.treatmentPlan}
                    onChange={(e) => setProcedureForm({...procedureForm, treatmentPlan: e.target.value})}
                    placeholder="e.g., Fill cavity, Crown placement"
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={procedureForm.notes}
                    onChange={(e) => setProcedureForm({...procedureForm, notes: e.target.value})}
                    rows="2"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProcedureModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Procedure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dental Chart Modal */}
      {showChartModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowChartModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>🦷 Dental Chart - {selectedPatient.firstName} {selectedPatient.lastName}</h3>
              <button className="modal-close" onClick={() => setShowChartModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', marginBottom: '20px' }}>
                {/* Upper Teeth (1-16) */}
                {dentalChart.slice(0, 16).map((tooth, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    background: getToothColor(tooth),
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    minHeight: '50px',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  onClick={() => {
                    alert(`Tooth ${tooth.toothNumber}\nStatus: ${tooth.status}\nProcedures: ${tooth.procedures.join(', ') || 'None'}`);
                  }}
                  >
                    <span>{tooth.toothNumber}</span>
                    <span style={{ fontSize: '8px', opacity: 0.8 }}>{tooth.status}</span>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>⌄ LOWER TEETH ⌄</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                {/* Lower Teeth (17-32) */}
                {dentalChart.slice(16, 32).map((tooth, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    background: getToothColor(tooth),
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    minHeight: '50px',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  onClick={() => {
                    alert(`Tooth ${tooth.toothNumber}\nStatus: ${tooth.status}\nProcedures: ${tooth.procedures.join(', ') || 'None'}`);
                  }}
                  >
                    <span>{tooth.toothNumber}</span>
                    <span style={{ fontSize: '8px', opacity: 0.8 }}>{tooth.status}</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span><span style={{ display: 'inline-block', width: '16px', height: '16px', background: '#10b981', borderRadius: '4px' }}></span> Healthy</span>
                <span><span style={{ display: 'inline-block', width: '16px', height: '16px', background: '#ef4444', borderRadius: '4px' }}></span> Cavity</span>
                <span><span style={{ display: 'inline-block', width: '16px', height: '16px', background: '#f59e0b', borderRadius: '4px' }}></span> Filled</span>
                <span><span style={{ display: 'inline-block', width: '16px', height: '16px', background: '#6b7280', borderRadius: '4px' }}></span> Missing</span>
                <span><span style={{ display: 'inline-block', width: '16px', height: '16px', background: '#8b5cf6', borderRadius: '4px' }}></span> Crown</span>
                <span><span style={{ display: 'inline-block', width: '16px', height: '16px', background: '#3b82f6', borderRadius: '4px' }}></span> Treated</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowChartModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print Chart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DentalDashboard;