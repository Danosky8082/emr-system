// src/pages/PatientIntake.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import PatientCard from '../components/PatientCard'; // <--- IMPORT THE CARD

const PatientIntake = () => {
  const { token } = useAuth();
  const [journeys, setJourneys] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // --- NEW: Card Print State ---
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardPatient, setCardPatient] = useState(null);
  // ----------------------------

  const [newJourney, setNewJourney] = useState({ 
    patientId: '', 
    destinationType: 'CLINIC', 
    clinicId: '', 
    wardId: '' 
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [journeyRes, clinicRes, wardRes] = await Promise.all([
        axios.get('http://localhost:3000/api/patient-journeys', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/clinics', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/wards', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setJourneys(journeyRes.data);
      setClinics(clinicRes.data);
      setWards(wardRes.data);
    } catch (error) { 
      toast.error('Failed to load intake data'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getStatusColor = (status) => {
    const map = {
      'REGISTERED': '#3b4a5a',
      'PENDING_BILLING': '#b45309',
      'BILLING_CLEARED': '#047857',
      'CARD_PRINTED': '#6d28d9',
      'SENT_TO_DESTINATION': '#0e7490',
      'COMPLETED': '#1d4ed8'
    };
    return map[status] || '#6b7280';
  };

  const handleStartJourney = async (e) => {
    e.preventDefault();
    if (!newJourney.patientId) {
      toast.error('Please enter a Patient Hospital ID');
      return;
    }
    if (newJourney.destinationType === 'CLINIC' && !newJourney.clinicId) {
      toast.error('Please select a Clinic');
      return;
    }
    if (newJourney.destinationType === 'WARD' && !newJourney.wardId) {
      toast.error('Please select a Ward');
      return;
    }

    try {
      const payload = {
  patientId: newJourney.patientId,
  destinationType: newJourney.destinationType,
  clinicId: newJourney.destinationType === 'CLINIC' ? newJourney.clinicId : null,
  wardId: newJourney.destinationType === 'WARD' ? newJourney.wardId : null
};

      await axios.post('http://localhost:3000/api/patient-journeys', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Patient intake started successfully!');
      setShowModal(false);
      setNewJourney({ patientId: '', destinationType: 'CLINIC', clinicId: '', wardId: '' });
      fetchData();
    } catch (error) { 
      toast.error(error.response?.data?.error || 'Failed to start intake'); 
    }
  };

  const handleStatusUpdate = async (journeyId, status) => {
    try {
      await axios.patch(`http://localhost:3000/api/patient-journeys/${journeyId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
      fetchData();
    } catch (error) { 
      toast.error('Failed to update status'); 
    }
  };

  // --- 🖨️ NEW: Open Card Print Modal ---
  const handlePrintCard = (patient) => {
    setCardPatient(patient);
    setShowCardModal(true);
  };

  const handlePrint = () => {
    window.print();
  };
  // ------------------------------------

  const getStatusLabel = (status) => {
    const map = {
      'REGISTERED': '📝 Registered',
      'PENDING_BILLING': '💰 Pending Billing',
      'BILLING_CLEARED': '✅ Billing Cleared',
      'CARD_PRINTED': '🖨️ Card Printed',
      'SENT_TO_DESTINATION': '🚑 Sent to Dest.',
      'COMPLETED': '🎉 Completed'
    };
    return map[status] || status;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Patient Intake Pipeline</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Start New Patient Intake</button>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Patient Name</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {journeys.map(j => {
              let action = null;
              if (j.status === 'REGISTERED') {
                action = { label: '💰 Send to Billing', status: 'PENDING_BILLING' };
              } else if (j.status === 'BILLING_CLEARED') {
                action = { label: '🖨️ Mark Card Printed', status: 'CARD_PRINTED' };
              } else if (j.status === 'CARD_PRINTED') {
                action = { label: '🚑 Send to Destination', status: 'SENT_TO_DESTINATION' };
              } else if (j.status === 'SENT_TO_DESTINATION') {
                action = { label: '🎉 Mark Completed', status: 'COMPLETED' };
              }

              const destinationName = j.destinationType === 'WARD' 
                ? j.ward?.name 
                : j.clinic?.name;

              return (
                <tr key={j.id}>
                  <td><strong>{j.patient?.hospitalId}</strong></td>
                  <td>{j.patient?.firstName} {j.patient?.lastName}</td>
                  <td>
                    {destinationName || '—'}
                    <span style={{fontSize: '0.75rem', color: '#ccc', marginLeft: '5px'}}>
                      ({j.destinationType})
                    </span>
                  </td>
                  <td>
                    <span 
                      className="role-badge" 
                      style={{ backgroundColor: getStatusColor(j.status), color: '#ffffff', fontWeight: 600, border: 'none' }}
                    >
                      {getStatusLabel(j.status)}
                    </span>
                  </td>
                  <td>
                    {/* --- 🖨️ NEW: Print Card Button (Visible when Billing is Cleared or Card Printed) --- */}
                    {['BILLING_CLEARED', 'CARD_PRINTED'].includes(j.status) && (
                      <button 
                        className="btn btn-sm btn-secondary" 
                        style={{ marginRight: '5px' }}
                        onClick={() => handlePrintCard(j.patient)}
                      >
                        🖨️ Print Card
                      </button>
                    )}
                    {/* ------------------------------------------------------------------------------- */}
                    
                    {action ? (
                      <button 
                        className="btn btn-sm btn-primary" 
                        onClick={() => handleStatusUpdate(j.id, action.status)}
                      >
                        {action.label}
                      </button>
                    ) : (
                      <span style={{opacity: 0.6}}>End of process</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {journeys.length === 0 && <tr><td colSpan="5" className="text-center">No active patient intakes. Start a new one!</td></tr>}
          </tbody>
        </table>
      </div>

      {/* --- 🖨️ PATIENT CARD MODAL --- */}
      {showCardModal && cardPatient && (
        <div className="modal-overlay" onClick={() => setShowCardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', padding: '30px', backgroundColor: '#f8f9fa' }}>
            <div className="modal-header">
              <h3>Print Patient Card</h3>
              <button className="modal-close" onClick={() => setShowCardModal(false)}>×</button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <PatientCard patient={cardPatient} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCardModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={handlePrint}>🖨️ Print Card</button>
            </div>
          </div>
        </div>
      )}
      /* -------------------------------------------------------- */

      {/* Intake Modal (Unchanged) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Start Patient Intake</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleStartJourney}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Patient Hospital ID</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. 000007" 
                    value={newJourney.patientId} 
                    onChange={e => setNewJourney({...newJourney, patientId: e.target.value})} 
                  />
                  <small>Ensure the patient is already registered in the system.</small>
                </div>
                <div className="form-group">
                  <label>Destination Type *</label>
                  <select 
                    required 
                    value={newJourney.destinationType} 
                    onChange={e => {
                      setNewJourney({ 
                        ...newJourney, 
                        destinationType: e.target.value,
                        clinicId: '', 
                        wardId: '' 
                      });
                    }}
                  >
                    <option value="CLINIC">Clinic (Outpatient)</option>
                    <option value="WARD">Ward (Inpatient / ADT)</option>
                  </select>
                </div>
                {newJourney.destinationType === 'CLINIC' && (
                  <div className="form-group">
                    <label>Select Clinic *</label>
                    <select 
                      required 
                      value={newJourney.clinicId} 
                      onChange={e => setNewJourney({...newJourney, clinicId: e.target.value})}
                    >
                      <option value="">-- Choose a Clinic --</option>
                      {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {newJourney.destinationType === 'WARD' && (
                  <div className="form-group">
                    <label>Select Ward *</label>
                    <select 
                      required 
                      value={newJourney.wardId} 
                      onChange={e => setNewJourney({...newJourney, wardId: e.target.value})}
                    >
                      <option value="">-- Choose a Ward --</option>
                      {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Start Intake</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default PatientIntake;