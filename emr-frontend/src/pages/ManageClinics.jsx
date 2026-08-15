// src/pages/ManageClinics.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ManageClinics = () => {
  const { token } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newClinic, setNewClinic] = useState({ name: '', description: '', location: '' });

  const fetchClinics = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/clinics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClinics(res.data);
    } catch (error) { toast.error('Failed to load clinics'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchClinics(); }, []);

  const handleCreateClinic = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/clinics', newClinic, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Clinic created successfully!');
      setShowModal(false);
      setNewClinic({ name: '', description: '', location: '' });
      fetchClinics();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to create clinic'); }
  };

  const handleDeleteClinic = async (id) => {
    if (!window.confirm('Are you sure you want to delete this clinic?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/clinics/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Clinic deleted');
      fetchClinics();
    } catch (error) { toast.error(error.response?.data?.error || 'Cannot delete clinic with active patients.'); }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Manage Outpatient Clinics</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add New Clinic</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Location</th><th>Actions</th></tr></thead>
          <tbody>
            {clinics.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.description || '-'}</td>
                <td>{c.location || '-'}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteClinic(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {clinics.length === 0 && <tr><td colSpan="4" className="text-center">No clinics created yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Add New Clinic</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            <form onSubmit={handleCreateClinic}>
              <div className="modal-body">
                <div className="form-group"><label>Clinic Name *</label><input type="text" required value={newClinic.name} onChange={e => setNewClinic({...newClinic, name: e.target.value})} /></div>
                <div className="form-group"><label>Description</label><input type="text" value={newClinic.description} onChange={e => setNewClinic({...newClinic, description: e.target.value})} /></div>
                <div className="form-group"><label>Location</label><input type="text" value={newClinic.location} onChange={e => setNewClinic({...newClinic, location: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Clinic</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ManageClinics;