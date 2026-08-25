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
  const [editingClinic, setEditingClinic] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    location: '' 
  });

  const fetchClinics = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/clinics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClinics(res.data);
    } catch (error) { 
      toast.error('Failed to load clinics'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchClinics(); 
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Clinic name is required');
      return;
    }

    try {
      if (editingClinic) {
        // UPDATE existing clinic
        await axios.put(
          `http://localhost:3000/api/clinics/${editingClinic.id}`, 
          formData, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Clinic updated successfully!');
      } else {
        // CREATE new clinic
        await axios.post(
          'http://localhost:3000/api/clinics', 
          formData, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Clinic created successfully!');
      }
      
      setShowModal(false);
      setEditingClinic(null);
      setFormData({ name: '', description: '', location: '' });
      fetchClinics();
    } catch (error) { 
      toast.error(error.response?.data?.error || 'Operation failed'); 
    }
  };

  const handleEdit = (clinic) => {
    setEditingClinic(clinic);
    setFormData({
      name: clinic.name || '',
      description: clinic.description || '',
      location: clinic.location || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this clinic?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/clinics/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Clinic deleted successfully');
      fetchClinics();
    } catch (error) { 
      toast.error(error.response?.data?.error || 'Cannot delete clinic with active patients.'); 
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingClinic(null);
    setFormData({ name: '', description: '', location: '' });
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🏥 Manage Outpatient Clinics</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setEditingClinic(null);
            setFormData({ name: '', description: '', location: '' });
            setShowModal(true);
          }}
          style={{
            background: '#0f3460',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          + Add New Clinic
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clinics.length > 0 ? (
              clinics.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.description || '-'}</td>
                  <td>{c.location || '-'}</td>
                  <td>
                    {/* Edit Button */}
                    <button 
                      className="btn btn-sm btn-edit" 
                      onClick={() => handleEdit(c)}
                      style={{
                        background: '#0f3460',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginRight: '6px'
                      }}
                    >
                      ✏️ Edit
                    </button>
                    {/* Delete Button */}
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleDelete(c.id)}
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">No clinics created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Clinic Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{editingClinic ? '✏️ Edit Clinic' : '➕ Add New Clinic'}</h3>
              <button className="modal-close" onClick={handleCancel}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Clinic Name <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name} 
                    onChange={handleInputChange}
                    required 
                    placeholder="e.g., General Outpatient"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input 
                    type="text" 
                    name="description"
                    value={formData.description} 
                    onChange={handleInputChange}
                    placeholder="e.g., General outpatient services"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input 
                    type="text" 
                    name="location"
                    value={formData.location} 
                    onChange={handleInputChange}
                    placeholder="e.g., Ground Floor, Block A"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCancel}
                  style={{
                    background: '#e5e7eb',
                    color: '#1f2937',
                    border: '1px solid #d1d5db',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{
                    background: '#0f3460',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {editingClinic ? 'Update Clinic' : 'Create Clinic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClinics;