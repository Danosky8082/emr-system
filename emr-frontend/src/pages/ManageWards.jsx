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
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to create ward'); }
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
        {/* 🟢 This button explicitly sets the modal state to true */}
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

      {/* Modal - Built directly with inline styles to guarantee it works */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '16px',
            maxWidth: '500px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8ecf1', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Add New Ward</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Ward Name *</label>
                <input type="text" required value={newWard.name} onChange={e => setNewWard({...newWard, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" value={newWard.description} onChange={e => setNewWard({...newWard, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" value={newWard.capacity} onChange={e => setNewWard({...newWard, capacity: e.target.value})} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Ward</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ManageWards;