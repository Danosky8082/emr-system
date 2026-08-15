// src/pages/Patients.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom'; // <--- ADD THIS IMPORT

const Patients = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', phone: '', email: '', address: '',
    emergencyContact: '', allergies: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: ''
  });

  useEffect(() => { fetchPatients(); }, []);

  // Inside the fetchPatients function in Patients.jsx
const fetchPatients = async () => {
  try {
    // If the user is a Doctor, they get filtered patients. Everyone else gets all.
    let url = 'http://localhost:3000/api/patients';
    if (user?.role === 'Doctor') {
      url = 'http://localhost:3000/api/doctor/patients';
    } else if (user?.role === 'Nurse') {
      url = 'http://localhost:3000/api/nurse/patients';
    }
    
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    
    // If Doctor or Nurse, the API returns Journeys wrapping the patient.
    if (user?.role === 'Doctor' || user?.role === 'Nurse') {
      setPatients(res.data.map(j => j.patient));
    } else {
      setPatients(res.data);
    }
  } catch (error) { console.error(error); } finally { setLoading(false); }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPatient) {
        await axios.put(`http://localhost:3000/api/patients/${editingPatient.id}`, formData, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Patient updated successfully!');
      } else {
        await axios.post('http://localhost:3000/api/patients', formData, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Patient registered successfully!');
      }
      setShowModal(false);
      setEditingPatient(null);
      setFormData({ firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', phone: '', email: '', address: '', emergencyContact: '', allergies: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '' });
      fetchPatients();
    } catch (error) { toast.error(error.response?.data?.error || 'Operation failed'); }
  };

  const handleEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      firstName: patient.firstName, lastName: patient.lastName, gender: patient.gender, dateOfBirth: patient.dateOfBirth?.split('T')[0] || '',
      phone: patient.phone || '', email: patient.email || '', address: patient.address || '', emergencyContact: patient.emergencyContact || '',
      allergies: patient.allergies || '', nextOfKinName: patient.nextOfKinName || '', nextOfKinPhone: patient.nextOfKinPhone || '',
      nextOfKinRelationship: patient.nextOfKinRelationship || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this patient? This cannot be undone!')) return;
    try {
      await axios.delete(`http://localhost:3000/api/patients/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Patient deleted successfully');
      fetchPatients();
    } catch (error) { toast.error('Failed to delete patient'); }
  };

  const filteredPatients = patients.filter(p => 
    `${p.firstName} ${p.lastName} ${p.hospitalId || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="spinner" />;
  
  // Permission checks
  const canManage = ['Admin', 'Records', 'ITAdmin'].includes(user?.role);
  const canViewProfile = ['Admin', 'Records', 'ITAdmin', 'Nurse', 'Doctor'].includes(user?.role);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Patient Management</h2>
        {canManage && <button className="btn btn-primary" onClick={() => { setEditingPatient(null); setFormData({ firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', phone: '', email: '', address: '', emergencyContact: '', allergies: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '' }); setShowModal(true); }}>+ Register New Patient</button>}
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Phone</th>
              <th>Next of Kin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.hospitalId}</strong></td>
                <td>{p.firstName} {p.lastName}</td>
                <td>{p.gender}</td>
                <td>{p.phone || '-'}</td>
                <td>{p.nextOfKinName || '-'}</td>
                <td>
                  {/* --- 🟢 NEW: Open File Button --- */}
                  {canViewProfile && (
                    <Link to={`/patient-profile/${p.id}`} className="btn btn-sm btn-secondary" style={{ marginRight: '5px' }}>
                      📂 Open File
                    </Link>
                  )}
                  {/* ------------------------------ */}
                  
                  {canManage && (
                    <>
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: '5px' }} onClick={() => handleEdit(p)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredPatients.length === 0 && <tr><td colSpan="6" className="text-center">No patients found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Registration/Edit Modal - Unchanged */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingPatient ? 'Edit Patient' : 'Register New Patient'}</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              {/* ... (Keep your existing modal body code here) ... */}
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>First Name *</label><input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required /></div>
                  <div className="form-group"><label>Last Name *</label><input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Gender *</label><select name="gender" value={formData.gender} onChange={handleInputChange}><option>Male</option><option>Female</option><option>Other</option></select></div>
                  <div className="form-group"><label>Date of Birth *</label><input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Phone</label><input type="text" name="phone" value={formData.phone} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Email</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} /></div>
                </div>
                <div className="form-group"><label>Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} /></div>
                
                <h4 style={{marginTop:'10px', borderTop:'1px solid #eee', paddingTop:'10px'}}>Next of Kin Details <span style={{color:'red'}}>*</span></h4>
                <div className="form-row">
                  <div className="form-group"><label>Full Name</label><input type="text" name="nextOfKinName" value={formData.nextOfKinName} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Phone <span style={{color:'red'}}>*</span></label><input type="text" name="nextOfKinPhone" value={formData.nextOfKinPhone} onChange={handleInputChange} required /></div>
                </div>
                <div className="form-group"><label>Relationship</label><input type="text" name="nextOfKinRelationship" value={formData.nextOfKinRelationship} onChange={handleInputChange} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingPatient ? 'Update Patient' : 'Register Patient'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Patients;