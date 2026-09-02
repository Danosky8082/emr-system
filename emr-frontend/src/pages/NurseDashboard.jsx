// src/pages/NurseDashboard.jsx - COMPLETE FIXED VERSION

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import toast from 'react-hot-toast';

const NurseDashboard = () => {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
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

  // ✅ FETCH PATIENTS
  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/nurse/patients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatients(res.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patients');
    }
  };

  // ✅ FETCH TODAY'S APPOINTMENTS - IMPROVED
  const fetchTodayAppointments = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log('📅 Fetching appointments from:', today.toISOString(), 'to:', tomorrow.toISOString());

      // ✅ Get ALL appointments for today (not filtered by nurse yet)
      const res = await axios.get(
        `http://localhost:3000/api/appointments?dateFrom=${today.toISOString()}&dateTo=${tomorrow.toISOString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('📅 All appointments today:', res.data.length);

      // ✅ Get nurse's assigned patient IDs
      const nursePatientIds = patients.map(j => j.patient?.id).filter(Boolean);
      console.log('👩‍⚕️ Nurse patient IDs:', nursePatientIds);

      // ✅ Filter appointments for nurse's patients
      const filtered = res.data.filter(a => 
        nursePatientIds.includes(a.patientId) && 
        a.status !== 'Cancelled' &&
        a.status !== 'Completed'
      );

      console.log('📅 Filtered appointments for nurse:', filtered.length);

      // Sort by time
      filtered.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      setTodayAppointments(filtered);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  // ✅ LOAD ALL DATA
  const loadAllData = async () => {
    setLoading(true);
    try {
      await fetchPatients();
      // Wait for patients to load before fetching appointments
      // But we need to fetch appointments after patients are loaded
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch patients on mount
  useEffect(() => {
    if (token) {
      loadAllData();
    }
  }, [token]);

  // ✅ Fetch appointments when patients change
  useEffect(() => {
    if (patients.length > 0) {
      fetchTodayAppointments();
    }
  }, [patients]);

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
        bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', temperature: '',
        respiratoryRate: '', oxygenSaturation: '', weight: '', height: '', notes: '',
      });
      // Refresh patients
      await fetchPatients();
      // Refresh appointments
      await fetchTodayAppointments();
    } catch (error) {
      console.error('Error recording vitals:', error);
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

  // ✅ Refresh handler
  const handleRefresh = async () => {
    toast.info('Refreshing data...');
    await fetchPatients();
    await fetchTodayAppointments();
    toast.success('Data refreshed!');
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>👩‍⚕️ Nurse Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            📅 Today's Appointments: <strong>{todayAppointments.length}</strong>
          </span>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            👤 My Patients: <strong>{patients.length}</strong>
          </span>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ✅ APPOINTMENTS SECTION */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0 }}>📅 Today's Appointments</h4>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {todayAppointments.filter(a => a.status === 'Scheduled').length} waiting
          </span>
        </div>

        {todayAppointments.length > 0 ? (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {todayAppointments.map(a => {
              const patient = a.Patient || a.patient;
              const staff = a.Staff || a.staff;
              return (
                <div key={a.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderBottom: '1px solid #f3f4f6',
                  background: a.status === 'Scheduled' ? '#f8fafc' : '#d1fae5'
                }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>
                      {patient?.firstName} {patient?.lastName}
                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                        ({patient?.hospitalId})
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      🕐 {new Date(a.dateTime).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                      <span style={{ marginLeft: '12px' }}>👨‍⚕️ Dr. {staff?.firstName} {staff?.lastName}</span>
                      <span style={{ marginLeft: '12px' }}>
                        <span className={`status-badge ${a.status === 'Scheduled' ? 'status-pending' : 'status-active'}`}>
                          {a.status}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <Link
                      to={`/patient-profile/${a.patientId}`}
                      className="btn btn-sm btn-secondary"
                      style={{
                        background: '#0f3460',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600',
                        textDecoration: 'none'
                      }}
                    >
                      📂 Open File
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            <p>No appointments scheduled for today.</p>
            <p style={{ fontSize: '13px' }}>Check back later or refresh the page.</p>
          </div>
        )}
      </div>

      {/* PATIENTS TABLE */}
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
              if (!p) return null;
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

      {/* Vital Signs Modal */}
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