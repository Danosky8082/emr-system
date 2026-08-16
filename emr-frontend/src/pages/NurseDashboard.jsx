// src/pages/NurseDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import toast from 'react-hot-toast';

const NurseDashboard = () => {
  const { token } = useAuth();  // ✅ token is correctly destructured
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    notes: '',
  });
  const [showVitalModal, setShowVitalModal] = useState(false);

  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/nurse/patients', { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatients(res.data);
    } catch (error) {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Only fetch if token exists, and depend on token
  useEffect(() => {
    if (token) {
      fetchPatients();
    }
  }, [token]);

  const handleVitalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    try {
      await axios.post('http://localhost:3000/api/vitals', {
        patientId: selectedPatient.patient.id,
        ...vitalsForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Vitals recorded successfully!');
      setShowVitalModal(false);
      setVitalsForm({
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        heartRate: '',
        temperature: '',
        respiratoryRate: '',
        oxygenSaturation: '',
        weight: '',
        height: '',
        notes: '',
      });
    } catch (error) {
      toast.error('Failed to record vitals');
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Nurse Dashboard – Patients in Your Care</h2>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Age</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.map(journey => {
              const p = journey.patient;
              const destination = journey.clinic ? `Clinic: ${journey.clinic.name}` : (journey.ward ? `Ward: ${journey.ward.name}` : 'N/A');
              return (
                <tr key={journey.id}>
                  <td><strong>{p.hospitalId}</strong></td>
                  <td>{p.firstName} {p.lastName}</td>
                  <td>{p.gender}</td>
                  <td>{calculateAge(p.dateOfBirth)}</td>
                  <td>{destination}</td>
                  <td>{journey.status}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setSelectedPatient(journey);
                        setShowVitalModal(true);
                      }}
                      style={{ marginRight: '5px' }}
                    >
                      📋 Record Vitals
                    </button>
                    <Link to={`/patient-profile/${p.id}`} className="btn btn-sm btn-secondary">
                      📂 Open File
                    </Link>
                  </td>
                </tr>
              );
            })}
            {patients.length === 0 && (
              <tr><td colSpan="7" className="text-center">No patients currently assigned to you.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vital Signs Modal (same as before) */}
      {showVitalModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowVitalModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Vitals – {selectedPatient.patient.firstName} {selectedPatient.patient.lastName}</h3>
              <button className="modal-close" onClick={() => setShowVitalModal(false)}>×</button>
            </div>
            <form onSubmit={handleVitalSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>BP Systolic (mmHg)</label>
                    <input type="number" value={vitalsForm.bloodPressureSystolic} onChange={e => setVitalsForm({...vitalsForm, bloodPressureSystolic: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>BP Diastolic (mmHg)</label>
                    <input type="number" value={vitalsForm.bloodPressureDiastolic} onChange={e => setVitalsForm({...vitalsForm, bloodPressureDiastolic: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Heart Rate (bpm)</label>
                    <input type="number" value={vitalsForm.heartRate} onChange={e => setVitalsForm({...vitalsForm, heartRate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Temperature (°C)</label>
                    <input type="number" step="0.1" value={vitalsForm.temperature} onChange={e => setVitalsForm({...vitalsForm, temperature: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Respiratory Rate (breaths/min)</label>
                    <input type="number" value={vitalsForm.respiratoryRate} onChange={e => setVitalsForm({...vitalsForm, respiratoryRate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Oxygen Saturation (%)</label>
                    <input type="number" value={vitalsForm.oxygenSaturation} onChange={e => setVitalsForm({...vitalsForm, oxygenSaturation: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input type="number" step="0.1" value={vitalsForm.weight} onChange={e => setVitalsForm({...vitalsForm, weight: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Height (cm)</label>
                    <input type="number" value={vitalsForm.height} onChange={e => setVitalsForm({...vitalsForm, height: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={vitalsForm.notes} onChange={e => setVitalsForm({...vitalsForm, notes: e.target.value})} rows="2" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVitalModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Vitals</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseDashboard;