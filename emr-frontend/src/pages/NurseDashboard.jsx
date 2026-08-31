// src/pages/NurseDashboard.jsx - COMPLETE WITH APPOINTMENTS

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

  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/nurse/patients', { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatients(res.data);
      
      // ✅ After patients load, fetch appointments
      await fetchTodayAppointments(res.data);
    } catch (error) {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH TODAY'S APPOINTMENTS
  const fetchTodayAppointments = async (patientsData) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const res = await axios.get(
        `http://localhost:3000/api/appointments?dateFrom=${today.toISOString()}&dateTo=${tomorrow.toISOString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // ✅ Filter appointments for patients in nurse's care
      const nursePatientIds = patientsData ? 
        patientsData.map(j => j.patient?.id).filter(Boolean) : 
        [];
      
      const filtered = res.data.filter(a => 
        nursePatientIds.includes(a.patientId) && 
        a.status !== 'Cancelled'
      );
      
      setTodayAppointments(filtered);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

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

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h2>👩‍⚕️ Nurse Dashboard – Patients in Your Care</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0 0' }}>
            {patients.length} patients assigned • {todayAppointments.length} appointments today
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchPatients} style={{
          background: '#0f3460',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer'
        }}>
          🔄 Refresh
        </button>
      </div>

      {/* ✅ TODAY'S APPOINTMENTS SECTION */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            📅 Today's Appointments ({todayAppointments.length})
          </h4>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {new Date().toLocaleDateString('en-NG', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
        
        {todayAppointments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayAppointments.map(a => {
              const patient = a.Patient || a.patient;
              const staff = a.Staff || a.staff;
              return (
                <div key={a.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${a.status === 'Scheduled' ? '#3b82f6' : '#10b981'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '18px' }}>👤</span>
                    <div>
                      <strong>{patient?.firstName} {patient?.lastName}</strong>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        ID: {patient?.hospitalId}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>
                      🕐 {formatTime(a.dateTime)}
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>
                      👨‍⚕️ Dr. {staff?.firstName} {staff?.lastName}
                    </div>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: a.status === 'Scheduled' ? '#dbeafe' : '#d1fae5',
                      color: a.status === 'Scheduled' ? '#1e40af' : '#065f46'
                    }}>
                      {a.status || 'Scheduled'}
                    </span>
                  </div>
                  <Link 
                    to={`/patient-profile/${patient?.id}`} 
                    className="btn btn-sm btn-secondary"
                    style={{
                      background: '#0f3460',
                      color: 'white',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      textDecoration: 'none'
                    }}
                  >
                    📂 Open File
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
            No appointments scheduled for today.
          </div>
        )}
      </div>

      {/* ✅ PATIENTS TABLE */}
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
              // ✅ Check if patient has an appointment today
              const hasAppointment = todayAppointments.some(a => a.patientId === p.id);
              
              return (
                <tr key={journey.id} style={hasAppointment ? { background: '#eff6ff' } : {}}>
                  <td><strong>{p.hospitalId}</strong></td>
                  <td>
                    {p.firstName} {p.lastName}
                    {hasAppointment && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        background: '#3b82f6',
                        color: 'white',
                        fontSize: '10px',
                        borderRadius: '10px',
                        fontWeight: '600'
                      }}>
                        📅 Appt
                      </span>
                    )}
                  </td>
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