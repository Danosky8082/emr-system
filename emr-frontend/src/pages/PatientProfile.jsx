// src/pages/PatientProfile.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // <--- Added useNavigate
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './PatientProfile.css';
import './Dashboard.css';
import toast from 'react-hot-toast';

const PatientProfile = () => {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate(); // <--- Initialize navigate
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('profile');
  
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState([]);

  // Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({
    type: 'SOAP',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    fullContent: ''
  });

  // Vital Modal State
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', temperature: '',
    respiratoryRate: '', oxygenSaturation: '', weight: '', height: '', notes: ''
  });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [patientRes, vitalsRes] = await Promise.all([
        axios.get(`http://localhost:3000/api/patients/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:3000/api/patients/${id}/vitals`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setPatient(patientRes.data);
      setVitals(vitalsRes.data);
    } catch (error) {
      toast.error('Failed to load patient profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchAllData(); }, [id, token]);

  // --- 🚀 UNIVERSAL BACK BUTTON LOGIC ---
  const handleBack = () => {
    // 1. Try to go back to the previous page (whether they came from Nurse dashboard, Doctor dashboard, or Patients list)
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      // 2. Fallback if they opened the profile in a new tab (no history)
      const role = user?.role;
      if (role === 'Nurse') {
        navigate('/nurse-dashboard');
      } else if (role === 'Doctor') {
        navigate('/doctor-dashboard');
      } else {
        // Default fallback for Admin, Records, LabTech, Pharmacist, etc.
        navigate('/patients');
      }
    }
  };
  // ---------------------------------------

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingNote) {
        await axios.put(`http://localhost:3000/api/clinical-notes/${editingNote.id}`, noteForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Note updated successfully!');
      } else {
        await axios.post('http://localhost:3000/api/clinical-notes', { patientId: id, ...noteForm }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Note added successfully!');
      }
      setShowNoteModal(false);
      setEditingNote(null);
      setNoteForm({ type: 'SOAP', subjective: '', objective: '', assessment: '', plan: '', fullContent: '' });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save note');
    }
  };

  const handleStartEditNote = (note) => {
    setEditingNote(note);
    setNoteForm({
      type: note.type,
      subjective: note.subjective || '',
      objective: note.objective || '',
      assessment: note.assessment || '',
      plan: note.plan || '',
      fullContent: note.fullContent || ''
    });
    setShowNoteModal(true);
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to permanently delete this note?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/clinical-notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Note deleted successfully');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleVitalSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/vitals', { patientId: id, ...vitalsForm }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Vitals recorded successfully!');
      setShowVitalModal(false);
      setVitalsForm({
        bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', temperature: '',
        respiratoryRate: '', oxygenSaturation: '', weight: '', height: '', notes: ''
      });
      const vitalsRes = await axios.get(`http://localhost:3000/api/patients/${id}/vitals`, { headers: { Authorization: `Bearer ${token}` } });
      setVitals(vitalsRes.data);
    } catch (error) { toast.error('Failed to record vitals'); }
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

  const canModifyNote = (note) => {
    return user?.role === 'Admin' || note.authorId === user?.id;
  };

  if (loading) return <div className="spinner" />;
  if (!patient) return <div>Patient not found</div>;

  return (
    <div className="patient-profile-container">
      
      {/* SIDEBAR */}
      <div className="profile-sidebar">
        <h4>Patient Record</h4>
        <button className={`profile-tab-btn ${currentTab === 'profile' ? 'active' : ''}`} onClick={() => setCurrentTab('profile')}><span className="icon">👤</span> Profile</button>
        <button className={`profile-tab-btn ${currentTab === 'vitals' ? 'active' : ''}`} onClick={() => setCurrentTab('vitals')}><span className="icon">❤️</span> Vitals</button>
        <button className={`profile-tab-btn ${currentTab === 'notes' ? 'active' : ''}`} onClick={() => setCurrentTab('notes')}><span className="icon">📝</span> Clinical Notes</button>
        <button className={`profile-tab-btn ${currentTab === 'prescriptions' ? 'active' : ''}`} onClick={() => setCurrentTab('prescriptions')}><span className="icon">💊</span> Prescriptions</button>
        <button className={`profile-tab-btn ${currentTab === 'lab-orders' ? 'active' : ''}`} onClick={() => setCurrentTab('lab-orders')}><span className="icon">🔬</span> Lab Orders</button>
        
        {/* 🚀 UPDATED UNIVERSAL BACK BUTTON */}
        <div style={{ marginTop: '20px', padding: '0 20px' }}>
          <button 
            onClick={handleBack} 
            className="btn btn-secondary" 
            style={{ width: '100%', display: 'block', textAlign: 'center', cursor: 'pointer' }}
          >
            ← Back to List
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="profile-content">
        <h3>{patient.firstName} {patient.lastName}</h3>

        {/* PROFILE TAB */}
        {currentTab === 'profile' && (
          <div className="profile-grid">
            <div className="profile-grid-item"><span className="label">Hospital ID</span><span className="value">{patient.hospitalId}</span></div>
            <div className="profile-grid-item"><span className="label">Age</span><span className="value">{calculateAge(patient.dateOfBirth)} years</span></div>
            <div className="profile-grid-item"><span className="label">Gender</span><span className="value">{patient.gender}</span></div>
            <div className="profile-grid-item"><span className="label">Date of Birth</span><span className="value">{new Date(patient.dateOfBirth).toLocaleDateString()}</span></div>
            <div className="profile-grid-item"><span className="label">Phone</span><span className="value">{patient.phone || '-'}</span></div>
            <div className="profile-grid-item"><span className="label">Email</span><span className="value">{patient.email || '-'}</span></div>
            <div className="profile-grid-item"><span className="label">Address</span><span className="value">{patient.address || '-'}</span></div>
            <div className="profile-grid-item"><span className="label">Emergency Contact</span><span className="value">{patient.emergencyContact || '-'}</span></div>
            <div className="profile-grid-item"><span className="label">Allergies</span><span className="value" style={{ color: patient.allergies ? '#ef4444' : 'inherit' }}>{patient.allergies || 'None'}</span></div>
            <div className="profile-grid-item" style={{ gridColumn: '1 / -1' }}><span className="label">Next of Kin</span><span className="value">{patient.nextOfKinName || '-'} {patient.nextOfKinPhone ? ` (${patient.nextOfKinPhone})` : ''} {patient.nextOfKinRelationship ? ` - ${patient.nextOfKinRelationship}` : ''}</span></div>
          </div>
        )}

        {/* VITALS TAB */}
        {currentTab === 'vitals' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ border: 'none', padding: 0, margin: 0 }}>Vital Signs History</h3>
              <button className="btn btn-primary" onClick={() => setShowVitalModal(true)}>➕ Record Vitals</button>
            </div>
            {vitals.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Date/Time</th><th>Nurse</th><th>BP (mmHg)</th><th>HR (bpm)</th><th>Temp (°C)</th><th>SpO₂ (%)</th><th>RR (/min)</th><th>Weight (kg)</th><th>Height (cm)</th><th>Notes</th></tr></thead>
                  <tbody>{vitals.map(v => (
                    <tr key={v.id}>
                      <td>{new Date(v.recordedAt).toLocaleString()}</td>
                      <td>{v.nurse?.firstName} {v.nurse?.lastName}</td>
                      <td>{v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</td>
                      <td>{v.heartRate}</td>
                      <td>{v.temperature}</td>
                      <td>{v.oxygenSaturation}</td>
                      <td>{v.respiratoryRate}</td>
                      <td>{v.weight}</td>
                      <td>{v.height}</td>
                      <td>{v.notes || '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (<p>No vitals recorded yet.</p>)}
          </>
        )}

        {/* NOTES TAB WITH EDIT/DELETE */}
        {currentTab === 'notes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ border: 'none', padding: 0, margin: 0 }}>Clinical Notes (SOAP)</h3>
              <button className="btn btn-secondary" onClick={() => {
                setEditingNote(null);
                setNoteForm({ type: 'SOAP', subjective: '', objective: '', assessment: '', plan: '', fullContent: '' });
                setShowNoteModal(true);
              }}>+ Add Note</button>
            </div>
            {patient.clinicalNotes && patient.clinicalNotes.length > 0 ? (
              patient.clinicalNotes.map(n => (
                <div key={n.id} className="note-card">
                  <div className="note-header">
                    <span><strong>{n.type}</strong> by {n.author?.firstName} {n.author?.lastName}</span>
                    <span className="note-date">{new Date(n.createdAt).toLocaleString()}</span>
                    {canModifyNote(n) && (
                      <div className="note-actions">
                        <button onClick={() => handleStartEditNote(n)}>✏️ Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteNote(n.id)}>🗑️ Delete</button>
                      </div>
                    )}
                  </div>
                  <div className="note-body">
                    {n.subjective && <div><strong>S:</strong> {n.subjective}</div>}
                    {n.objective && <div><strong>O:</strong> {n.objective}</div>}
                    {n.assessment && <div><strong>A:</strong> {n.assessment}</div>}
                    {n.plan && <div><strong>P:</strong> {n.plan}</div>}
                    {!n.subjective && !n.objective && !n.assessment && !n.plan && <div style={{ opacity: 0.7 }}>{n.fullContent || 'No structured content'}</div>}
                  </div>
                </div>
              ))
            ) : (<p>No clinical notes.</p>)}
          </>
        )}

        {/* PRESCRIPTIONS & LAB ORDERS TABS */}
        {currentTab === 'prescriptions' && (
          <div className="table-container">
            <h3 style={{ border: 'none', padding: 0 }}>Prescriptions</h3>
            <table>
              <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Status</th><th>Prescribed By</th></tr></thead>
              <tbody>{patient.prescriptions && patient.prescriptions.map(p => (
                <tr key={p.id}><td><strong>{p.medication}</strong></td><td>{p.dosage}</td><td>{p.frequency}</td><td><span className={`role-badge ${p.status === 'Dispensed' ? 'status-active' : ''}`}>{p.status}</span></td><td>{p.prescribedBy?.firstName} {p.prescribedBy?.lastName}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {currentTab === 'lab-orders' && (
          <div className="table-container">
            <h3 style={{ border: 'none', padding: 0 }}>Lab Orders</h3>
            <table>
              <thead><tr><th>Test Name</th><th>Type</th><th>Priority</th><th>Status</th><th>Result</th></tr></thead>
              <tbody>{patient.labOrders && patient.labOrders.map(l => (
                <tr key={l.id}><td><strong>{l.testName}</strong></td><td>{l.testType}</td><td><span className={`role-badge ${l.priority === 'Urgent' ? 'status-inactive' : ''}`}>{l.priority}</span></td><td>{l.status}</td><td>{l.result || '-'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* VITAL SIGNS MODAL */}
      {showVitalModal && (
        <div className="modal-overlay" onClick={() => setShowVitalModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Record Vitals – {patient.firstName} {patient.lastName}</h3><button className="modal-close" onClick={() => setShowVitalModal(false)}>×</button></div>
            <form onSubmit={handleVitalSubmit}>
              <div className="modal-body">
                <div className="form-row"><div className="form-group"><label>BP Systolic (mmHg)</label><input type="number" value={vitalsForm.bloodPressureSystolic} onChange={e => setVitalsForm({...vitalsForm, bloodPressureSystolic: e.target.value})} /></div>
                <div className="form-group"><label>BP Diastolic (mmHg)</label><input type="number" value={vitalsForm.bloodPressureDiastolic} onChange={e => setVitalsForm({...vitalsForm, bloodPressureDiastolic: e.target.value})} /></div></div>
                <div className="form-row"><div className="form-group"><label>Heart Rate (bpm)</label><input type="number" value={vitalsForm.heartRate} onChange={e => setVitalsForm({...vitalsForm, heartRate: e.target.value})} /></div>
                <div className="form-group"><label>Temperature (°C)</label><input type="number" step="0.1" value={vitalsForm.temperature} onChange={e => setVitalsForm({...vitalsForm, temperature: e.target.value})} /></div></div>
                <div className="form-row"><div className="form-group"><label>Respiratory Rate (breaths/min)</label><input type="number" value={vitalsForm.respiratoryRate} onChange={e => setVitalsForm({...vitalsForm, respiratoryRate: e.target.value})} /></div>
                <div className="form-group"><label>Oxygen Saturation (%)</label><input type="number" value={vitalsForm.oxygenSaturation} onChange={e => setVitalsForm({...vitalsForm, oxygenSaturation: e.target.value})} /></div></div>
                <div className="form-row"><div className="form-group"><label>Weight (kg)</label><input type="number" step="0.1" value={vitalsForm.weight} onChange={e => setVitalsForm({...vitalsForm, weight: e.target.value})} /></div>
                <div className="form-group"><label>Height (cm)</label><input type="number" value={vitalsForm.height} onChange={e => setVitalsForm({...vitalsForm, height: e.target.value})} /></div></div>
                <div className="form-group"><label>Notes</label><textarea value={vitalsForm.notes} onChange={e => setVitalsForm({...vitalsForm, notes: e.target.value})} rows="2" /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowVitalModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Vitals</button></div>
            </form>
          </div>
        </div>
      )}

      {/* NOTES MODAL */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingNote ? 'Edit Note' : 'Add Clinical Note'}</h3>
              <button className="modal-close" onClick={() => setShowNoteModal(false)}>×</button>
            </div>
            <form onSubmit={handleNoteSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Note Type</label>
                  <select value={noteForm.type} onChange={e => setNoteForm({...noteForm, type: e.target.value})}>
                    <option value="SOAP">SOAP Note</option>
                    <option value="Progress Note">Progress Note</option>
                    <option value="Discharge Summary">Discharge Summary</option>
                  </select>
                </div>
                <div className="form-group"><label>Subjective (Patient's complaints)</label><textarea rows="2" value={noteForm.subjective} onChange={e => setNoteForm({...noteForm, subjective: e.target.value})} /></div>
                <div className="form-group"><label>Objective (Examination findings)</label><textarea rows="2" value={noteForm.objective} onChange={e => setNoteForm({...noteForm, objective: e.target.value})} /></div>
                <div className="form-group"><label>Assessment (Diagnosis/Impression)</label><textarea rows="2" value={noteForm.assessment} onChange={e => setNoteForm({...noteForm, assessment: e.target.value})} /></div>
                <div className="form-group"><label>Plan (Treatment/Next steps)</label><textarea rows="2" value={noteForm.plan} onChange={e => setNoteForm({...noteForm, plan: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNoteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingNote ? 'Update Note' : 'Save Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default PatientProfile;