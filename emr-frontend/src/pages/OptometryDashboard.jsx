// src/pages/OptometryDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const OptometryDashboard = () => {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [examRecords, setExamRecords] = useState([]);
  
  const [examForm, setExamForm] = useState({
    patientId: '',
    visualAcuityRight: '',
    visualAcuityLeft: '',
    intraocularPressureRight: '',
    intraocularPressureLeft: '',
    refractionRight: '',
    refractionLeft: '',
    diagnosis: '',
    treatment: '',
    prescription: '',
    notes: ''
  });

  const [prescriptionForm, setPrescriptionForm] = useState({
    patientId: '',
    prescriptionType: 'Glasses',
    rightSphere: '',
    rightCylinder: '',
    rightAxis: '',
    leftSphere: '',
    leftCylinder: '',
    leftAxis: '',
    addPower: '',
    pd: '',
    notes: '',
    expiryDate: ''
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/optometry/patients', {
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

  const fetchExamRecords = async (patientId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/optometry/exam/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExamRecords(res.data);
      setSelectedPatient(patients.find(p => p.id === patientId));
      setShowExamModal(true);
    } catch (error) {
      console.error('Fetch exam records error:', error);
      toast.error('Failed to load exam records');
    }
  };

  const handleExamSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/optometry/exam', examForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Eye exam recorded successfully!');
      setShowExamModal(false);
      setExamForm({
        patientId: '',
        visualAcuityRight: '',
        visualAcuityLeft: '',
        intraocularPressureRight: '',
        intraocularPressureLeft: '',
        refractionRight: '',
        refractionLeft: '',
        diagnosis: '',
        treatment: '',
        prescription: '',
        notes: ''
      });
      fetchPatients();
    } catch (error) {
      toast.error('Failed to record eye exam');
    }
  };

  const handlePrescriptionSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/optometry/prescription', prescriptionForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Prescription issued successfully!');
      setShowPrescriptionModal(false);
      setPrescriptionForm({
        patientId: '',
        prescriptionType: 'Glasses',
        rightSphere: '',
        rightCylinder: '',
        rightAxis: '',
        leftSphere: '',
        leftCylinder: '',
        leftAxis: '',
        addPower: '',
        pd: '',
        notes: '',
        expiryDate: ''
      });
      fetchPatients();
    } catch (error) {
      toast.error('Failed to issue prescription');
    }
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
        <h2>👁️ Optometry / Eye Clinic</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setExamForm({ ...examForm, patientId: '' });
              setShowExamModal(true);
            }}
          >
            👁️ New Eye Exam
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setPrescriptionForm({ ...prescriptionForm, patientId: '' });
              setShowPrescriptionModal(true);
            }}
            style={{ background: '#8b5cf6', color: 'white' }}
          >
            👓 Issue Prescription
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
          <div className="stat-icon">👁️</div>
          <div className="stat-info">
            <div className="stat-value">{patients.length}</div>
            <div className="stat-label">Total Patients</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">👓</div>
          <div className="stat-info">
            <div className="stat-value">{patients.filter(p => p.optometry_records?.[0]?.prescription).length}</div>
            <div className="stat-label">With Prescriptions</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{patients.filter(p => p.optometry_records?.[0]?.diagnosis).length}</div>
            <div className="stat-label">Diagnosed</div>
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
              <th>Last Exam</th>
              <th>Visual Acuity</th>
              <th>Diagnosis</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length > 0 ? (
              patients.map(p => {
                const lastRecord = p.optometry_records?.[0];
                return (
                  <tr key={p.id}>
                    <td><strong>{p.hospitalId}</strong></td>
                    <td>{p.firstName} {p.lastName}</td>
                    <td>{lastRecord ? new Date(lastRecord.examinationDate).toLocaleDateString() : '—'}</td>
                    <td>
                      {lastRecord?.visualAcuityRight && lastRecord?.visualAcuityLeft ? (
                        <span style={{ fontSize: '13px' }}>
                          R: {lastRecord.visualAcuityRight} / L: {lastRecord.visualAcuityLeft}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: lastRecord?.diagnosis ? '#fef3c7' : '#f3f4f6',
                        color: lastRecord?.diagnosis ? '#92400e' : '#374151'
                      }}>
                        {lastRecord?.diagnosis || 'No diagnosis'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => fetchExamRecords(p.id)}
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
                          📋 Exam
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setPrescriptionForm({
                              ...prescriptionForm,
                              patientId: p.id
                            });
                            setShowPrescriptionModal(true);
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
                          👓 Prescription
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setExamForm({
                              ...examForm,
                              patientId: p.id
                            });
                            setShowExamModal(true);
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
                          👁️ Eye Exam
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  No optometry patients found. Record an eye exam to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Eye Exam Modal */}
      {showExamModal && (
        <div className="modal-overlay" onClick={() => setShowExamModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>{selectedPatient ? `👁️ Eye Exam - ${selectedPatient.firstName} ${selectedPatient.lastName}` : '👁️ New Eye Exam'}</h3>
              <button className="modal-close" onClick={() => setShowExamModal(false)}>×</button>
            </div>
            <form onSubmit={handleExamSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Patient</label>
                  <select
                    value={examForm.patientId}
                    onChange={(e) => setExamForm({...examForm, patientId: e.target.value})}
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

                <h4 style={{ margin: '16px 0 8px 0' }}>👁️ Visual Acuity</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Right Eye (Snellen)</label>
                    <input
                      type="text"
                      value={examForm.visualAcuityRight}
                      onChange={(e) => setExamForm({...examForm, visualAcuityRight: e.target.value})}
                      placeholder="e.g., 20/20"
                    />
                  </div>
                  <div className="form-group">
                    <label>Left Eye (Snellen)</label>
                    <input
                      type="text"
                      value={examForm.visualAcuityLeft}
                      onChange={(e) => setExamForm({...examForm, visualAcuityLeft: e.target.value})}
                      placeholder="e.g., 20/40"
                    />
                  </div>
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>📊 Intraocular Pressure</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Right Eye (mmHg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={examForm.intraocularPressureRight}
                      onChange={(e) => setExamForm({...examForm, intraocularPressureRight: e.target.value})}
                      placeholder="e.g., 15"
                    />
                  </div>
                  <div className="form-group">
                    <label>Left Eye (mmHg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={examForm.intraocularPressureLeft}
                      onChange={(e) => setExamForm({...examForm, intraocularPressureLeft: e.target.value})}
                      placeholder="e.g., 16"
                    />
                  </div>
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>🔬 Refraction</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Right Eye</label>
                    <input
                      type="text"
                      value={examForm.refractionRight}
                      onChange={(e) => setExamForm({...examForm, refractionRight: e.target.value})}
                      placeholder="e.g., -2.00 -0.50 x 180"
                    />
                  </div>
                  <div className="form-group">
                    <label>Left Eye</label>
                    <input
                      type="text"
                      value={examForm.refractionLeft}
                      onChange={(e) => setExamForm({...examForm, refractionLeft: e.target.value})}
                      placeholder="e.g., -2.50 -0.75 x 170"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Diagnosis</label>
                  <input
                    type="text"
                    value={examForm.diagnosis}
                    onChange={(e) => setExamForm({...examForm, diagnosis: e.target.value})}
                    placeholder="e.g., Myopia, Hyperopia, Astigmatism"
                  />
                </div>

                <div className="form-group">
                  <label>Treatment</label>
                  <input
                    type="text"
                    value={examForm.treatment}
                    onChange={(e) => setExamForm({...examForm, treatment: e.target.value})}
                    placeholder="e.g., Glasses, Contact lenses, Surgery"
                  />
                </div>

                <div className="form-group">
                  <label>Prescription Notes</label>
                  <textarea
                    value={examForm.prescription}
                    onChange={(e) => setExamForm({...examForm, prescription: e.target.value})}
                    rows="2"
                    placeholder="Prescription details..."
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={examForm.notes}
                    onChange={(e) => setExamForm({...examForm, notes: e.target.value})}
                    rows="2"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExamModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Exam</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prescription Modal */}
      {showPrescriptionModal && (
        <div className="modal-overlay" onClick={() => setShowPrescriptionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>👓 Issue Prescription</h3>
              <button className="modal-close" onClick={() => setShowPrescriptionModal(false)}>×</button>
            </div>
            <form onSubmit={handlePrescriptionSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Patient</label>
                  <select
                    value={prescriptionForm.patientId}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, patientId: e.target.value})}
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
                  <label>Prescription Type</label>
                  <select
                    value={prescriptionForm.prescriptionType}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, prescriptionType: e.target.value})}
                  >
                    <option value="Glasses">👓 Glasses</option>
                    <option value="Contact Lenses">👁️ Contact Lenses</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>Right Eye (OD)</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Sphere</label>
                    <input
                      type="text"
                      value={prescriptionForm.rightSphere}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, rightSphere: e.target.value})}
                      placeholder="e.g., -2.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Cylinder</label>
                    <input
                      type="text"
                      value={prescriptionForm.rightCylinder}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, rightCylinder: e.target.value})}
                      placeholder="e.g., -0.50"
                    />
                  </div>
                  <div className="form-group">
                    <label>Axis</label>
                    <input
                      type="text"
                      value={prescriptionForm.rightAxis}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, rightAxis: e.target.value})}
                      placeholder="e.g., 180"
                    />
                  </div>
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>Left Eye (OS)</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Sphere</label>
                    <input
                      type="text"
                      value={prescriptionForm.leftSphere}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, leftSphere: e.target.value})}
                      placeholder="e.g., -2.50"
                    />
                  </div>
                  <div className="form-group">
                    <label>Cylinder</label>
                    <input
                      type="text"
                      value={prescriptionForm.leftCylinder}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, leftCylinder: e.target.value})}
                      placeholder="e.g., -0.75"
                    />
                  </div>
                  <div className="form-group">
                    <label>Axis</label>
                    <input
                      type="text"
                      value={prescriptionForm.leftAxis}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, leftAxis: e.target.value})}
                      placeholder="e.g., 170"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Add Power (if bifocal)</label>
                    <input
                      type="text"
                      value={prescriptionForm.addPower}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, addPower: e.target.value})}
                      placeholder="e.g., +2.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>PD (Pupillary Distance)</label>
                    <input
                      type="text"
                      value={prescriptionForm.pd}
                      onChange={(e) => setPrescriptionForm({...prescriptionForm, pd: e.target.value})}
                      placeholder="e.g., 62"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={prescriptionForm.expiryDate}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, expiryDate: e.target.value})}
                  />
                  <small style={{ color: '#6b7280' }}>Prescriptions typically valid for 1-2 years</small>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={prescriptionForm.notes}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, notes: e.target.value})}
                    rows="2"
                    placeholder="Additional notes about the prescription..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPrescriptionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Issue Prescription</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptometryDashboard;