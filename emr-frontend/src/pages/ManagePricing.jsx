// src/pages/ManagePricing.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ManagePricing = () => {
  const { token } = useAuth();
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', amount: '', clinicId: '' });

  const fetchPrices = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/service-prices', { headers: { Authorization: `Bearer ${token}` } });
      setPrices(res.data);
    } catch (error) { toast.error('Failed to load pricing'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchPrices(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`http://localhost:3000/api/service-prices/${editing.id}`, form, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Updated');
      } else {
        await axios.post('http://localhost:3000/api/service-prices', form, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Added');
      }
      setShowModal(false); setEditing(null); setForm({ name: '', description: '', amount: '', clinicId: '' });
      fetchPrices();
    } catch (error) { toast.error(error.response?.data?.error); }
  };

  return (
    <div className="dashboard">
      <div className="page-header"><h2>Manage Service Pricing</h2><button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Price</button></div>
      <div className="table-container">
        <table><thead><tr><th>Service Name</th><th>Amount (₦)</th><th>Clinic</th><th>Actions</th></tr></thead>
        <tbody>
          {prices.map(p => (
            <tr key={p.id}><td>{p.name}</td><td>₦{p.amount.toLocaleString()}</td><td>{p.clinic?.name || 'General'}</td>
              <td>
                <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(p); setForm(p); setShowModal(true); }}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={async () => { if (window.confirm('Delete?')) { await axios.delete(`http://localhost:3000/api/service-prices/${p.id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchPrices(); } }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editing ? 'Edit Price' : 'Add Price'}</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Service Name *</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div className="form-group"><label>Price (₦) *</label><input type="number" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary">{editing ? 'Update' : 'Add'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ManagePricing;