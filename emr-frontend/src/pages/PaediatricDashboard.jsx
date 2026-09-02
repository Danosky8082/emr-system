// src/pages/PaediatricDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const PaediatricDashboard = () => {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [showImmunizationModal, setShowImmunizationModal] = useState(false);
  const [growthData, setGrowthData] = useState([]);
  const [immunizationSchedule, setImmunizationSchedule] = useState([]);
  
  const [immunizationForm, setImmunizationForm] = useState({
    patientId: '',
    vaccineName: '',
    doseNumber: 1,
    administrationDate: new Date().toISOString().slice(0, 16),
    route: 'IM',
    site: 'Deltoid',
    batchNumber: '',
    expiryDate: '',
    nextDueDate: '',
    notes: ''
  });

  const [milestoneForm, setMilestoneForm] = useState({
    patientId: '',
    milestone: '',
    ageInMonths: '',
    achieved: true,
    notes: ''
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/paediatric/patients', {
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

  const fetchGrowthData = async (patientId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/paediatric/growth/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGrowthData(res.data);
      setSelectedPatient(patients.find(p => p.id === patientId));
      setShowGrowthModal(true);
    } catch (error) {
      console.error('Fetch growth data error:', error);
      toast.error('Failed to load growth data');
    }
  };

  const fetchImmunizationSchedule = async (patientId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/paediatric/immunizations/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImmunizationSchedule(res.data);
      setSelectedPatient(patients.find(p => p.id === patientId));
      setShowImmunizationModal(true);
    } catch (error) {
      console.error('Fetch immunization schedule error:', error);
      toast.error('Failed to load immunization schedule');
    }
  };

  const handleImmunizationSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/immunizations', immunizationForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Immunization recorded successfully!');
      setShowImmunizationModal(false);
      setImmunizationForm({
        patientId: '',
        vaccineName: '',
        doseNumber: 1,
        administrationDate: new Date().toISOString().slice(0, 16),
        route: 'IM',
        site: 'Deltoid',
        batchNumber: '',
        expiryDate: '',
        nextDueDate: '',
        notes: ''
      });
      fetchPatients();
    } catch (error) {
      toast.error('Failed to record immunization');
    }
  };

  const handleMilestoneSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/paediatric/milestone', milestoneForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Milestone recorded successfully!');
      setMilestoneForm({
        patientId: '',
        milestone: '',
        ageInMonths: '',
        achieved: true,
        notes: ''
      });
      fetchPatients();
    } catch (error) {
      toast.error('Failed to record milestone');
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  useEffect(() => {
    if (token) {
      fetchPatients();
    }
  }, [token]);

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>👶 Paediatrics Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setImmunizationForm({ ...immunizationForm, patientId: '' });
              setShowImmunizationModal(true);
            }}
          >
            💉 Record Immunization
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setMilestoneForm({ ...milestoneForm, patientId: '' });
              // Open milestone modal
              toast.info('Select a patient from the list to record a milestone');
            }}
            style={{ background: '#8b5cf6', color: 'white' }}
          >
            📋 Record Milestone
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
          <div className="stat-icon">👶</div>
          <div className="stat-info">
            <div className="stat-value">{patients.length}</div>
            <div className="stat-label">Child Patients</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">💉</div>
          <div className="stat-info">
            <div className="stat-value">{patients.filter(p => p.immunizations?.length > 0).length}</div>
            <div className="stat-label">Vaccinated</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <div className="stat-value">{patients.filter(p => p.vitalSigns?.length > 0).length}</div>
            <div className="stat-label">Growth Tracked</div>
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
              <th>Age</th>
              <th>Gender</th>
              <th>Last Immunization</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length > 0 ? (
              patients.map(p => {
                const lastImmunization = p.immunizations?.[0];
                return (
                  <tr key={p.id}>
                    <td><strong>{p.hospitalId}</strong></td>
                    <td>{p.firstName} {p.lastName}</td>
                    <td>{calculateAge(p.dateOfBirth)} years</td>
                    <td>{p.gender}</td>
                    <td>
                      {lastImmunization ? (
                        <span style={{ fontSize: '13px' }}>
                          {lastImmunization.vaccineName} ({new Date(lastImmunization.administrationDate).toLocaleDateString()})
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => fetchGrowthData(p.id)}
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
                          📈 Growth
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => fetchImmunizationSchedule(p.id)}
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
                          💉 Immunizations
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setMilestoneForm({
                              ...milestoneForm,
                              patientId: p.id
                            });
                            // Show milestone modal
                            toast.success(`Recording milestone for ${p.firstName} ${p.lastName}`);
                            // Prompt for milestone details
                            const milestone = prompt('Enter developmental milestone (e.g., Walking, Talking):');
                            if (milestone) {
                              const age = prompt('Age in months:');
                              const achieved = confirm('Has this milestone been achieved?');
                              setMilestoneForm({
                                patientId: p.id,
                                milestone: milestone,
                                ageInMonths: age || '',
                                achieved: achieved,
                                notes: ''
                              });
                              // Submit directly
                              handleMilestoneSubmit(new Event('submit'));
                            }
                          }}
                          style={{
                            background: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          📋 Milestone
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  No paediatric patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Growth Chart Modal */}
      {showGrowthModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowGrowthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>📈 Growth Chart - {selectedPatient.firstName} {selectedPatient.lastName}</h3>
              <button className="modal-close" onClick={() => setShowGrowthModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {growthData.growthData && growthData.growthData.length > 0 ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <strong>Patient:</strong> {selectedPatient.firstName} {selectedPatient.lastName} ({selectedPatient.hospitalId})
                    <br />
                    <strong>Date of Birth:</strong> {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                  </div>
                  
                  <h4>Weight Tracking</h4>
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    {growthData.growthData.map((point, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: index < growthData.growthData.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <span>{new Date(point.date).toLocaleDateString()}</span>
                        <span>{point.ageInMonths} months</span>
                        <span style={{ fontWeight: 'bold' }}>{point.weight || '—'} kg</span>
                        <span>{point.height || '—'} cm</span>
                      </div>
                    ))}
                  </div>

                  <h4>Height Tracking</h4>
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                    {growthData.growthData.map((point, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: index < growthData.growthData.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <span>{new Date(point.date).toLocaleDateString()}</span>
                        <span>{point.ageInMonths} months</span>
                        <span style={{ fontWeight: 'bold' }}>{point.height || '—'} cm</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                  No growth data available for this patient.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGrowthModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Immunization Schedule Modal */}
      {showImmunizationModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowImmunizationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>💉 Immunization Schedule - {selectedPatient.firstName} {selectedPatient.lastName}</h3>
              <button className="modal-close" onClick={() => setShowImmunizationModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {immunizationSchedule.schedule && immunizationSchedule.schedule.length > 0 ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <strong>Patient:</strong> {selectedPatient.firstName} {selectedPatient.lastName} ({selectedPatient.hospitalId})
                    <br />
                    <strong>Completed Immunizations:</strong> {immunizationSchedule.schedule.filter(s => s.given).length} / {immunizationSchedule.schedule.length}
                  </div>
                  
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Vaccine</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Due</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {immunizationSchedule.schedule.map((item, index) => (
                          <tr key={index} style={{ borderBottom: index < immunizationSchedule.schedule.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                            <td style={{ padding: '8px 12px' }}>{item.vaccine}</td>
                            <td style={{ padding: '8px 12px' }}>{item.dueAge}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: item.given ? '#d1fae5' : '#fef3c7',
                                color: item.given ? '#065f46' : '#92400e'
                              }}>
                                {item.given ? '✅ Completed' : '⏳ Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                  No immunization data available for this patient.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowImmunizationModal(false)}>Close</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setShowImmunizationModal(false);
                  setImmunizationForm({ ...immunizationForm, patientId: selectedPatient.id });
                  setShowImmunizationModal(true);
                }}
                style={{ background: '#10b981' }}
              >
                💉 Record New Immunization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Immunization Form Modal */}
      {showImmunizationModal && immunizationForm.patientId && (
        <div className="modal-overlay" onClick={() => setShowImmunizationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>💉 Record Immunization</h3>
              <button className="modal-close" onClick={() => setShowImmunizationModal(false)}>×</button>
            </div>
            <form onSubmit={handleImmunizationSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Patient</label>
                  <select
                    value={immunizationForm.patientId}
                    onChange={(e) => setImmunizationForm({...immunizationForm, patientId: e.target.value})}
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
                  <label>Vaccine Name *</label>
                  <input
                    type="text"
                    value={immunizationForm.vaccineName}
                    onChange={(e) => setImmunizationForm({...immunizationForm, vaccineName: e.target.value})}
                    required
                    placeholder="e.g., BCG, Hepatitis B, Polio"
                    list="vaccines"
                  />
                  <datalist id="vaccines">
                    <option value="BCG" />
                    <option value="Hepatitis B" />
                    <option value="Polio (OPV)" />
                    <option value="Pentavalent (DPT-HepB-Hib)" />
                    <option value="Pneumococcal (PCV)" />
                    <option value="Rotavirus" />
                    <option value="Measles (MR)" />
                    <option value="Yellow Fever" />
                    <option value="DPT Booster" />
                    <option value="HPV" />
                    <option value="Tdap" />
                    <option value="Meningococcal" />
                  </datalist>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Dose Number</label>
                    <input
                      type="number"
                      value={immunizationForm.doseNumber}
                      onChange={(e) => setImmunizationForm({...immunizationForm, doseNumber: parseInt(e.target.value) || 1})}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label>Route</label>
                    <select
                      value={immunizationForm.route}
                      onChange={(e) => setImmunizationForm({...immunizationForm, route: e.target.value})}
                    >
                      <option value="IM">Intramuscular (IM)</option>
                      <option value="SC">Subcutaneous (SC)</option>
                      <option value="ID">Intradermal (ID)</option>
                      <option value="Oral">Oral</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Administration Date *</label>
                  <input
                    type="datetime-local"
                    value={immunizationForm.administrationDate}
                    onChange={(e) => setImmunizationForm({...immunizationForm, administrationDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Site</label>
                    <input
                      type="text"
                      value={immunizationForm.site}
                      onChange={(e) => setImmunizationForm({...immunizationForm, site: e.target.value})}
                      placeholder="e.g., Deltoid, Thigh"
                    />
                  </div>
                  <div className="form-group">
                    <label>Batch Number</label>
                    <input
                      type="text"
                      value={immunizationForm.batchNumber}
                      onChange={(e) => setImmunizationForm({...immunizationForm, batchNumber: e.target.value})}
                      placeholder="e.g., BATCH-001"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input
                      type="date"
                      value={immunizationForm.expiryDate}
                      onChange={(e) => setImmunizationForm({...immunizationForm, expiryDate: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Next Due Date</label>
                    <input
                      type="date"
                      value={immunizationForm.nextDueDate}
                      onChange={(e) => setImmunizationForm({...immunizationForm, nextDueDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={immunizationForm.notes}
                    onChange={(e) => setImmunizationForm({...immunizationForm, notes: e.target.value})}
                    rows="2"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowImmunizationModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Immunization</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaediatricDashboard;