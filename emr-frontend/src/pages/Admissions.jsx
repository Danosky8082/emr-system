import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';

const Admissions = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
  const [admissions, setAdmissions] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWardModal, setShowWardModal] = useState(false);
  const [newWard, setNewWard] = useState({ name: '', description: '', capacity: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adRes, wardRes] = await Promise.all([
        axios.get('http://localhost:3000/api/admissions', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/wards', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAdmissions(adRes.data);
      setWards(wardRes.data);
    } catch (error) { toast.error('Failed to load data'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateWard = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/wards', newWard, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Ward created successfully!');
      setShowWardModal(false);
      setNewWard({ name: '', description: '', capacity: '' });
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to create ward'); }
  };

  const handleDeleteWard = async (id) => {
    if (!window.confirm('Delete this ward?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/wards/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Ward deleted');
      fetchData();
    } catch (error) { toast.error('Cannot delete ward with active admissions'); }
  };

  const isAdmin = ['Admin', 'ITAdmin'].includes(user?.role);
  const filteredAdmissions = admissions.filter(a => 
    `${a.patient?.firstName} ${a.patient?.lastName} ${a.admissionNumber}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>ADT Tracking (Admissions, Discharges, Transfers)</h2>
        {isAdmin && <button className="btn btn-secondary" onClick={() => setShowWardModal(true)}>+ Manage Wards</button>}
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Admission No.</th><th>Patient</th><th>Ward</th><th>Doctor</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredAdmissions.map(a => (
              <tr key={a.id}>
                <td><strong>{a.admissionNumber}</strong></td>
                <td>{a.patient?.firstName} {a.patient?.lastName}</td>
                <td>{a.ward?.name || 'N/A'}</td>
                <td>{a.staff?.firstName} {a.staff?.lastName}</td>
                <td>{new Date(a.admissionDate).toLocaleDateString()}</td>
                <td><span className={`status-badge ${a.status === 'Admitted' ? 'status-active' : 'status-inactive'}`}>{a.status}</span></td>
                <td>
                  {a.status === 'Admitted' ? (
                    <button className="btn btn-sm btn-danger" onClick={() => {/* trigger discharge */}}>Discharge</button>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manage Wards Modal (Admin Only) */}
      {showWardModal && (
        <div className="modal-overlay" onClick={() => setShowWardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Manage Wards</h3><button className="modal-close" onClick={() => setShowWardModal(false)}>×</button></div>
            <div className="modal-body">
              <form onSubmit={handleCreateWard}>
                <div className="form-row">
                  <div className="form-group"><label>Ward Name *</label><input type="text" required value={newWard.name} onChange={e => setNewWard({...newWard, name: e.target.value})} /></div>
                  <div className="form-group"><label>Capacity</label><input type="number" value={newWard.capacity} onChange={e => setNewWard({...newWard, capacity: e.target.value})} /></div>
                </div>
                <div className="form-group"><label>Description</label><input type="text" value={newWard.description} onChange={e => setNewWard({...newWard, description: e.target.value})} /></div>
                <button type="submit" className="btn btn-primary">Add Ward</button>
              </form>
              <hr />
              <h4>Existing Wards</h4>
              <ul style={{listStyle:'none', padding:0}}>
                {wards.map(w => (
                  <li key={w.id} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                    <span><strong>{w.name}</strong> {w.description && `- ${w.description}`}</span>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteWard(w.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Admissions;