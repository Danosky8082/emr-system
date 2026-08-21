// src/pages/ManagePricing.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ManagePricing = () => {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: '',
    category: 'FPP',
    nhisPrice: '',
    corporatePrice: '',
    isActive: true,
  });

  // ✅ Fetch services
  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/pricing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServices(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // ✅ Handle form input
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ✅ Auto-calculate prices when base price changes
  useEffect(() => {
    if (formData.basePrice) {
      const base = parseFloat(formData.basePrice) || 0;
      setFormData(prev => ({
        ...prev,
        nhisPrice: (base * 0.1).toFixed(2), // 10% for NHIS
        corporatePrice: (base * 2).toFixed(2), // 200% for Corporate
      }));
    }
  }, [formData.basePrice]);

  // ✅ Handle submit (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        basePrice: parseFloat(formData.basePrice) || 0,
        nhisPrice: parseFloat(formData.nhisPrice) || 0,
        corporatePrice: parseFloat(formData.corporatePrice) || 0,
      };

      if (editingService) {
        await axios.put(
          `http://localhost:3000/api/pricing/${editingService.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Service updated successfully!');
      } else {
        await axios.post(
          'http://localhost:3000/api/pricing',
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Service created successfully!');
      }

      setShowModal(false);
      setEditingService(null);
      setFormData({
        name: '',
        description: '',
        basePrice: '',
        category: 'FPP',
        nhisPrice: '',
        corporatePrice: '',
        isActive: true,
      });
      fetchServices();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.error || 'Failed to save service');
    }
  };

  // ✅ Handle edit
  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      description: service.description || '',
      basePrice: service.basePrice || '',
      category: service.category || 'FPP',
      nhisPrice: service.nhisPrice || '',
      corporatePrice: service.corporatePrice || '',
      isActive: service.isActive !== undefined ? service.isActive : true,
    });
    setShowModal(true);
  };

  // ✅ Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/pricing/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Service deleted successfully');
      fetchServices();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete service');
    }
  };

  // ✅ Get category label
  const getCategoryLabel = (category) => {
    const map = {
      'FPP': '💰 FPP (100%)',
      'NHIS': '🏥 NHIS (10%)',
      'CORPORATE': '🏢 Corporate (200%)',
    };
    return map[category] || category;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💰 Service Pricing Management</h2>
        <button className="btn btn-primary" onClick={() => {
          setEditingService(null);
          setFormData({
            name: '',
            description: '',
            basePrice: '',
            category: 'FPP',
            nhisPrice: '',
            corporatePrice: '',
            isActive: true,
          });
          setShowModal(true);
        }}>
          + Add Service
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
          <span style={{ fontWeight: '600', color: '#1e3a5f' }}>Pricing Rules:</span>
          <span style={{ fontSize: '14px', color: '#1e3a5f', marginLeft: '8px' }}>
            FPP = 100% of base price | NHIS = 10% | Corporate = 200%
          </span>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Description</th>
              <th>Category</th>
              <th>Base Price (₦)</th>
              <th>NHIS (₦)</th>
              <th>Corporate (₦)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.length > 0 ? (
              services.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.description || '-'}</td>
                  <td>{getCategoryLabel(s.category)}</td>
                  <td>{s.basePrice?.toLocaleString() || '0'}</td>
                  <td>{s.nhisPrice?.toLocaleString() || '0'}</td>
                  <td>{s.corporatePrice?.toLocaleString() || '0'}</td>
                  <td>
                    <span className={`status-badge ${s.isActive ? 'status-active' : 'status-inactive'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEdit(s)}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(s.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="8" className="text-center">No services configured. Add your first service!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Add/Edit Service */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingService ? 'Edit Service' : 'Add New Service'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Basic Info */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Service Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Consultation"
                    />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="FPP">💰 FPP - Free Paying Patient</option>
                      <option value="NHIS">🏥 NHIS - National Health Insurance</option>
                      <option value="CORPORATE">🏢 Corporate/Company</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief description of the service"
                  />
                </div>

                {/* Pricing Section */}
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#1a1a2e' }}>
                    💳 Pricing Configuration
                  </h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Base Price (₦) *</label>
                      <input
                        type="number"
                        name="basePrice"
                        value={formData.basePrice}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., 5000"
                        min="0"
                        step="0.01"
                      />
                      <small>This is the standard price for FPP patients</small>
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        name="isActive"
                        value={formData.isActive ? 'true' : 'false'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          isActive: e.target.value === 'true'
                        }))}
                      >
                        <option value="true">✅ Active</option>
                        <option value="false">❌ Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>NHIS Price (₦)</label>
                      <input
                        type="number"
                        name="nhisPrice"
                        value={formData.nhisPrice}
                        onChange={handleInputChange}
                        placeholder="Auto-calculated"
                        min="0"
                        step="0.01"
                        disabled
                        style={{ background: '#f1f5f9' }}
                      />
                      <small style={{ color: '#065f46' }}>🏥 10% of base price (auto-calculated)</small>
                    </div>
                    <div className="form-group">
                      <label>Corporate Price (₦)</label>
                      <input
                        type="number"
                        name="corporatePrice"
                        value={formData.corporatePrice}
                        onChange={handleInputChange}
                        placeholder="Auto-calculated"
                        min="0"
                        step="0.01"
                        disabled
                        style={{ background: '#f1f5f9' }}
                      />
                      <small style={{ color: '#92400e' }}>🏢 200% of base price (auto-calculated)</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePricing;