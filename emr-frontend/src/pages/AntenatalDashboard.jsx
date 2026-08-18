import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import toast from 'react-hot-toast';

const AntenatalDashboard = () => {
  const { token, user } = useAuth();
  const [pregnancies, setPregnancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPregnancy, setEditingPregnancy] = useState(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    expectedDelivery: '',
    gravida: '',
    para: '',
    lastMenstrualPeriod: '',
    estimatedDueDate: '',
    riskLevel: 'Low',
    notes: '',
    status: 'Active'
  });

  const fetchPregnancies = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/pregnancies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPregnancies(res.data);
    } catch (error) {
      toast.error('Failed to load pregnancies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPregnancies();
  }, []);

  // Open edit modal with pregnancy data
  const handleEditClick = (pregnancy) => {
    setEditingPregnancy(pregnancy);
    setEditForm({
      expectedDelivery: pregnancy.expectedDelivery?.split('T')[0] || '',
      gravida: pregnancy.gravida || '',
      para: pregnancy.para || '',
      lastMenstrualPeriod: pregnancy.lastMenstrualPeriod?.split('T')[0] || '',
      estimatedDueDate: pregnancy.estimatedDueDate?.split('T')[0] || '',
      riskLevel: pregnancy.riskLevel || 'Low',
      notes: pregnancy.notes || '',
      status: pregnancy.status || 'Active'
    });
    setShowEditModal(true);
  };

  // Handle form input changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  // Submit edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        expectedDelivery: editForm.expectedDelivery,
        gravida: parseInt(editForm.gravida) || undefined,
        para: parseInt(editForm.para) || undefined,
        lastMenstrualPeriod: editForm.lastMenstrualPeriod || undefined,
        estimatedDueDate: editForm.estimatedDueDate || undefined,
        riskLevel: editForm.riskLevel,
        notes: editForm.notes,
        status: editForm.status
      };

      await axios.put(
        `http://localhost:3000/api/pregnancies/${editingPregnancy.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Pregnancy updated successfully!');
      setShowEditModal(false);
      setEditingPregnancy(null);
      fetchPregnancies();
    } catch (error) {
      console.error('Update pregnancy error:', error);
      toast.error(error.response?.data?.error || 'Failed to update pregnancy');
    } finally {
      setSaving(false);
    }
  };

  // Update pregnancy status (quick action)
  const handleStatusChange = async (pregnancyId, newStatus) => {
    try {
      await axios.put(
        `http://localhost:3000/api/pregnancies/${pregnancyId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Status updated to ${newStatus}`);
      fetchPregnancies();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (loading) return <div className="spinner" />;

  // Get status badge color
  const getStatusBadge = (status) => {
    const colors = {
      'Active': 'status-active',
      'Delivered': 'status-delivered',
      'Miscarried': 'status-miscarried'
    };
    return colors[status] || 'status-pending';
  };

  // Get status options for dropdown
  const statusOptions = ['Active', 'Delivered', 'Miscarried'];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🤰 Antenatal Care</h2>
        <Link to="/pregnancy/new" className="btn btn-primary">
          ➕ Register New Pregnancy
        </Link>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Expected Delivery</th>
              <th>Last Visit</th>
              <th>Risk Level</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pregnancies.map(p => (
              <tr key={p.id}>
                <td>
                  <strong>{p.patient?.firstName} {p.patient?.lastName}</strong>
                  <br />
                  <small style={{ color: '#6b7280' }}>ID: {p.patient?.hospitalId}</small>
                </td>
                <td>{new Date(p.expectedDelivery).toLocaleDateString()}</td>
                <td>
                  {p.visits.length > 0 
                    ? new Date(p.visits[0].visitDate).toLocaleDateString() 
                    : '—'}
                </td>
                <td>
                  <span className={`risk-badge ${p.riskLevel?.toLowerCase() || 'low'}`}>
                    {p.riskLevel || 'Low'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <Link 
                      to={`/pregnancy/${p.id}`} 
                      className="btn btn-sm btn-secondary"
                    >
                      📋 View
                    </Link>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEditClick(p)}
                    >
                      ✏️ Edit
                    </button>
                    {p.status === 'Active' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleStatusChange(p.id, 'Delivered')}
                      >
                        ✅ Deliver
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pregnancies.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center">
                  No pregnancies found. Click "Register New Pregnancy" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      {showEditModal && editingPregnancy && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '600px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5>✏️ Edit Pregnancy</h5>
              <button className="close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSubmit}>
                {/* Patient Info - Read Only */}
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '12px 16px', 
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{editingPregnancy.patient?.firstName} {editingPregnancy.patient?.lastName}</strong>
                      <br />
                      <small style={{ color: '#6b7280' }}>
                        ID: {editingPregnancy.patient?.hospitalId}
                      </small>
                    </div>
                    <span className={`status-badge ${getStatusBadge(editingPregnancy.status)}`}>
                      {editingPregnancy.status}
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Expected Delivery Date *</label>
                  <input
                    type="date"
                    name="expectedDelivery"
                    value={editForm.expectedDelivery}
                    onChange={handleEditChange}
                    required
                    className="form-control"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Gravida</label>
                    <input
                      type="number"
                      name="gravida"
                      value={editForm.gravida}
                      onChange={handleEditChange}
                      className="form-control"
                      placeholder="Number of pregnancies"
                    />
                  </div>
                  <div className="form-group">
                    <label>Para</label>
                    <input
                      type="number"
                      name="para"
                      value={editForm.para}
                      onChange={handleEditChange}
                      className="form-control"
                      placeholder="Number of deliveries"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Last Menstrual Period</label>
                    <input
                      type="date"
                      name="lastMenstrualPeriod"
                      value={editForm.lastMenstrualPeriod}
                      onChange={handleEditChange}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Estimated Due Date</label>
                    <input
                      type="date"
                      name="estimatedDueDate"
                      value={editForm.estimatedDueDate}
                      onChange={handleEditChange}
                      className="form-control"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Risk Level</label>
                    <select
                      name="riskLevel"
                      value={editForm.riskLevel}
                      onChange={handleEditChange}
                      className="form-control"
                    >
                      <option value="Low">🟢 Low</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="High">🔴 High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      name="status"
                      value={editForm.status}
                      onChange={handleEditChange}
                      className="form-control"
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={editForm.notes}
                    onChange={handleEditChange}
                    className="form-control"
                    rows="3"
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : '💾 Update Pregnancy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS for risk badges and status colors */}
      <style>{`
        .risk-badge {
          padding: 2px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .risk-badge.low {
          background: #d1fae5;
          color: #065f46;
        }
        .risk-badge.medium {
          background: #fef3c7;
          color: #92400e;
        }
        .risk-badge.high {
          background: #fee2e2;
          color: #991b1b;
        }
        .status-delivered {
          background: #dbeafe;
          color: #1e40af;
        }
        .status-miscarried {
          background: #fee2e2;
          color: #991b1b;
        }
        .action-buttons .btn-sm {
          padding: 4px 10px;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};

export default AntenatalDashboard;