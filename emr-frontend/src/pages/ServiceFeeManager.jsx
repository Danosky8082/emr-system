// src/pages/ServiceFeeManager.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import api from '../api/client';

const ServiceFeeManager = () => {
  const { token } = useAuth();
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [formData, setFormData] = useState({
    serviceType: '',
    name: '',
    description: '',
    baseAmount: '',
    isActive: true
  });

  const fetchFees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/service-fees');
      setFees(res.data);
    } catch (error) {
      console.error('Error fetching fees:', error);
      toast.error('Failed to load service fees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.serviceType || !formData.name || !formData.baseAmount) {
      toast.error('Service Type, Name, and Base Amount are required');
      return;
    }

    try {
      if (editingFee) {
        await api.put(`/admin/service-fees/${editingFee.id}`, {
          name: formData.name,
          description: formData.description,
          baseAmount: parseFloat(formData.baseAmount),
          isActive: formData.isActive
        });
        toast.success('Service fee updated successfully!');
      } else {
        await api.post('/admin/service-fees', {
          serviceType: formData.serviceType.toUpperCase(),
          name: formData.name,
          description: formData.description,
          baseAmount: parseFloat(formData.baseAmount),
          isActive: formData.isActive
        });
        toast.success('Service fee created successfully!');
      }
      
      setShowModal(false);
      resetForm();
      fetchFees();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleEdit = (fee) => {
    setEditingFee(fee);
    setFormData({
      serviceType: fee.serviceType,
      name: fee.name,
      description: fee.description || '',
      baseAmount: fee.baseAmount.toString(),
      isActive: fee.isActive
    });
    setShowModal(true);
  };

    const handleToggleActive = async (fee) => {
    try {
      await api.put(`/admin/service-fees/${fee.id}`, {
        name: fee.name,
        description: fee.description,
        baseAmount: fee.baseAmount,
        isActive: !fee.isActive
      });
      toast.success(`Service ${fee.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchFees();
    } catch (error) {
      toast.error('Failed to update service status');
    }
  };

  // 👇👇👇 PASTE handleDelete RIGHT HERE 👇👇👇
  const handleDelete = async (fee) => {
    const isProtected = ['REGISTRATION', 'CARD', 'CONSULTATION'].includes(fee.serviceType);

    const confirmMessage = isProtected
      ? `⚠️ "${fee.serviceType}" is a system service fee.\n\n` +
        `Deleting it will make the app fall back to hardcoded defaults:\n` +
        `  • REGISTRATION → ₦2,000\n` +
        `  • CARD → ₦1,000\n` +
        `  • CONSULTATION → ₦5,000\n\n` +
        `Recommended: click "Deactivate" instead.\n\n` +
        `Type OK to force-delete anyway.`
      : `Permanently delete "${fee.name}" (${fee.serviceType})?\n\nThis cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const url = isProtected
        ? `/api/admin/service-fees/${fee.id}?force=true`
        : `/api/admin/service-fees/${fee.id}`;

      const res = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data._meta?.warning) {
        // Forced delete of a protected type — show the warning explicitly
        toast.success(res.data.message, { duration: 4000 });
        toast(res.data._meta.warning, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(res.data.message || 'Service fee deleted successfully');
      }

      fetchFees();
    } catch (error) {
      // Server returns 409 for protected types without force — surface the hint
      if (error.response?.status === 409) {
        toast.error(error.response.data.error, { duration: 6000 });
      } else {
        toast.error(error.response?.data?.error || 'Failed to delete service fee');
      }
    }
  };
  // 👆👆👆 END OF handleDelete 👆👆👆

  const resetForm = () => {
    setFormData({
      serviceType: '',
      name: '',
      description: '',
      baseAmount: '',
      isActive: true
    });
    setEditingFee(null);
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💰 Service Fee Management</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          + Add Service Fee
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '20px' }}>💡</span>
        <div>
          <span style={{ fontWeight: '600', color: '#1e3a5f' }}>Service Fees:</span>
          <span style={{ fontSize: '14px', color: '#1e3a5f', marginLeft: '8px' }}>
            These fees are automatically applied during patient intake and billing.
          </span>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Service Type</th>
              <th>Name</th>
              <th>Description</th>
              <th>Base Amount (₦)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fees.length > 0 ? (
              fees.map(fee => (
                <tr key={fee.id}>
                  <td><code>{fee.serviceType}</code></td>
                  <td><strong>{fee.name}</strong></td>
                  <td>{fee.description || '-'}</td>
                  <td>₦{fee.baseAmount.toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${fee.isActive ? 'status-active' : 'status-inactive'}`}>
                      {fee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
  <button 
    className="btn btn-sm btn-secondary"
    onClick={() => handleEdit(fee)}
  >
    ✏️ Edit
  </button>
  <button 
    className="btn btn-sm"
    style={{
      background: fee.isActive ? '#ef4444' : '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '4px 10px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '600'
    }}
    onClick={() => handleToggleActive(fee)}
  >
    {fee.isActive ? '🔴 Deactivate' : '🟢 Activate'}
  </button>
  <button 
    className="btn btn-sm"
    style={{
      background: '#6b7280',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '4px 10px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '600'
    }}
    onClick={() => handleDelete(fee)}
    title="Permanently delete this service fee"
  >
    🗑️ Delete
  </button>
</div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  No service fees configured. Add your first service fee!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>{editingFee ? 'Edit Service Fee' : 'Add New Service Fee'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Service Type *</label>
                  <input
                    type="text"
                    name="serviceType"
                    value={formData.serviceType}
                    onChange={handleInputChange}
                    placeholder="e.g., CONSULTATION"
                    required
                    disabled={editingFee}
                    style={{ 
                      textTransform: 'uppercase',
                      background: editingFee ? '#f3f4f6' : 'white'
                    }}
                  />
                  <small>Unique identifier (uppercase, no spaces)</small>
                </div>

                <div className="form-group">
                  <label>Display Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Consultation Fee"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief description of this service"
                  />
                </div>

                <div className="form-group">
                  <label>Base Amount (₦) *</label>
                  <input
                    type="number"
                    name="baseAmount"
                    value={formData.baseAmount}
                    onChange={handleInputChange}
                    placeholder="e.g., 5000"
                    required
                    min="0"
                    step="0.01"
                  />
                  <small>This is the base price. Category multipliers will be applied (NHIS: 10%, Corporate: 200%)</small>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                    />
                    {' '}Active
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingFee ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceFeeManager;