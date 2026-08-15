// src/pages/ManageWards.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ManageWards = () => {
  const { token } = useAuth();
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newWard, setNewWard] = useState({ name: '', description: '', capacity: '' });

  const fetchWards = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/wards', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWards(res.data);
    } catch (error) { toast.error('Failed to load wards'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchWards(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/wards', newWard, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ward created!');
      setShowModal(false);
      setNewWard({ name: '', description: '', capacity: '' });
      fetchWards();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ward?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/wards/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ward deleted');
      fetchWards();
    } catch (error) { toast.error('Cannot delete ward with active admissions'); }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Manage Wards</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Ward</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Capacity</th><th>Actions</th></tr></thead>
          <tbody>
            {wards.map(w => (
              <tr key={w.id}>
                <td><strong>{w.name}</strong></td>
                <td>{w.description || '-'}</td>
                <td>{w.capacity || '-'}</td>
                <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(w.id)}>Delete</button></td>
              </tr>
            ))}
            {wards.length === 0 && <tr><td colSpan="4">No wards created.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* ... modal ... */}
    </div>
  );
};
export default ManageWards;