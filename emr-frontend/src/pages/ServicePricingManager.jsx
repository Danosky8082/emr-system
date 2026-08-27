// src/pages/ServicePricingManager.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ServicePricingManager = () => {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: 'Lab',
    basePrice: '',
    nhisPrice: '',
    corporatePrice: '',
    isActive: true,
    requiresApproval: false
  });

  const categoriesList = [
    'Lab',
    'Imaging',
    'Consultation',
    'Pharmacy',
    'Dental',
    'Optometry',
    'Surgery',
    'Therapy',
    'Immunization',
    'Other'
  ];

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServices(res.data);
    } catch (error) {
      console.error('Fetch services error:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/services/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data);
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchCategories();
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
    try {
      if (editingService) {
        await axios.put(`http://localhost:3000/api/services/${editingService.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Service updated successfully!');
      } else {
        await axios.post('http://localhost:3000/api/services', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Service created successfully!');
      }
      setShowModal(false);
      setEditingService(null);
      resetForm();
      fetchServices();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    try {
      let servicesData;
      try {
        servicesData = JSON.parse(bulkData);
      } catch {
        toast.error('Invalid JSON format. Please check your data.');
        return;
      }

      if (!Array.isArray(servicesData)) {
        toast.error('Data must be an array of services');
        return;
      }

      const res = await axios.post('http://localhost:3000/api/services/bulk', { services: servicesData }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Bulk import: ${res.data.created} created, ${res.data.updated} updated`);
      setShowBulkModal(false);
      setBulkData('');
      fetchServices();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Bulk import failed');
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      code: service.code || '',
      description: service.description || '',
      category: service.category || 'Lab',
      basePrice: service.basePrice || '',
      nhisPrice: service.nhisPrice || '',
      corporatePrice: service.corporatePrice || '',
      isActive: service.isActive !== undefined ? service.isActive : true,
      requiresApproval: service.requiresApproval || false
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/services/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Service deleted successfully');
      fetchServices();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      category: 'Lab',
      basePrice: '',
      nhisPrice: '',
      corporatePrice: '',
      isActive: true,
      requiresApproval: false
    });
  };

  const filteredServices = services.filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || s.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💰 Service Pricing Manager</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowBulkModal(true)}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            📤 Bulk Import
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setEditingService(null);
              resetForm();
              setShowModal(true);
            }}
          >
            + Add Service
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="🔍 Search services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            flex: '1',
            minWidth: '200px'
          }}
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            background: 'white'
          }}
        >
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {filteredServices.length} services
        </span>
      </div>

      {/* Services Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Category</th>
              <th>Base Price (₦)</th>
              <th>NHIS (₦)</th>
              <th>Corporate (₦)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map(s => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.code || '-'}</td>
                <td><span className="role-badge">{s.category}</span></td>
                <td>₦{s.basePrice?.toLocaleString() || '0'}</td>
                <td style={{ color: '#10b981' }}>₦{s.nhisPrice?.toLocaleString() || '0'}</td>
                <td style={{ color: '#8b5cf6' }}>₦{s.corporatePrice?.toLocaleString() || '0'}</td>
                <td>
                  <span className={`status-badge ${s.isActive ? 'status-active' : 'status-inactive'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button 
                    className="btn btn-sm btn-edit" 
                    onClick={() => handleEdit(s)}
                    style={{
                      background: '#0f3460',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      marginRight: '4px'
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="btn btn-sm btn-danger" 
                    onClick={() => handleDelete(s.id)}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredServices.length === 0 && (
              <tr><td colSpan="8" className="text-center">No services found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingService ? 'Edit Service' : 'Add New Service'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Service Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Full Blood Count"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Service Code</label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      placeholder="e.g., LAB-001"
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
                      {categoriesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Brief description of the service"
                  />
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>💰 Pricing</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Base Price (₦) *</label>
                    <input
                      type="number"
                      name="basePrice"
                      value={formData.basePrice}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g., 5000"
                    />
                    <small>Standard price for FPP patients</small>
                  </div>
                  <div className="form-group">
                    <label>NHIS Price (₦)</label>
                    <input
                      type="number"
                      name="nhisPrice"
                      value={formData.nhisPrice}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="Auto: 10% of base"
                    />
                    <small style={{ color: '#10b981' }}>10% of base (auto-calculated)</small>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Corporate Price (₦)</label>
                    <input
                      type="number"
                      name="corporatePrice"
                      value={formData.corporatePrice}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="Auto: 200% of base"
                    />
                    <small style={{ color: '#8b5cf6' }}>200% of base (auto-calculated)</small>
                  </div>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                      />
                      Active
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <input
                        type="checkbox"
                        name="requiresApproval"
                        checked={formData.requiresApproval}
                        onChange={handleInputChange}
                      />
                      Requires Approval
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>📤 Bulk Import Services</h3>
              <button className="modal-close" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#6b7280', marginBottom: '12px' }}>
                Paste a JSON array of services to import. Existing services will be updated.
              </p>
              <div className="form-group">
                <label>JSON Data *</label>
                <textarea
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  rows="10"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                  placeholder={`[
  {
    "name": "Full Blood Count",
    "code": "LAB-001",
    "category": "Lab",
    "basePrice": 5000,
    "description": "Complete blood count test"
  },
  {
    "name": "Chest X-Ray",
    "code": "IMG-001",
    "category": "Imaging",
    "basePrice": 8000
  }
]`}
                />
              </div>
              <div style={{
                background: '#fef3c7',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#92400e'
              }}>
                💡 Fields: name (required), code, category (required), basePrice (required), 
                nhisPrice, corporatePrice, description
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleBulkImport}>Import Services</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicePricingManager;