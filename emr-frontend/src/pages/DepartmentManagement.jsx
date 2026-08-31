// src/pages/DepartmentManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Dashboard.css';

const DepartmentManagement = () => {
  const { token, user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    location: '',
    costCenter: ''
  });
  const [staff, setStaff] = useState([]);

  const canManage = ['Admin', 'ITAdmin', 'HR'].includes(user?.role);

  // Fetch departments
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/departments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(res.data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff for manager selection
  const fetchStaff = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(res.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDepartments();
      if (canManage) fetchStaff();
    }
  }, [token]);

  // Handle form input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle submit (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || formData.name.trim() === '') {
      toast.error('Department name is required');
      return;
    }

    try {
      let response;
      if (editingDepartment) {
        response = await axios.put(
          `http://localhost:3000/api/departments/${editingDepartment.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Department updated successfully!');
      } else {
        response = await axios.post(
          'http://localhost:3000/api/departments',
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Department created successfully!');
      }

      setShowModal(false);
      setEditingDepartment(null);
      resetForm();
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  // Handle edit
  const handleEdit = (department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name || '',
      description: department.description || '',
      managerId: department.managerId || '',
      location: department.location || '',
      costCenter: department.costCenter || ''
    });
    setShowModal(true);
  };

  // Handle delete (deactivate)
  const handleDelete = async (department) => {
    if (!window.confirm(`Are you sure you want to deactivate "${department.name}"? This will hide it from the system.`)) return;
    
    try {
      await axios.delete(`http://localhost:3000/api/departments/${department.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Department "${department.name}" deactivated`);
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to deactivate department');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      managerId: '',
      location: '',
      costCenter: ''
    });
  };

  // Get staff name by ID
  const getStaffName = (id) => {
    const staffMember = staff.find(s => s.id === id);
    return staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : '—';
  };

  if (!canManage) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <h2>🔐 Access Denied</h2>
          <p style={{ color: '#ef4444' }}>
            You do not have permission to manage departments.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🏢 Department Management</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setEditingDepartment(null);
            resetForm();
            setShowModal(true);
          }}
        >
          + Add Department
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div className="stat-info">
            <div className="stat-value">{departments.length}</div>
            <div className="stat-label">Total Departments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{departments.filter(d => d.isActive).length}</div>
            <div className="stat-label">Active Departments</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{departments.filter(d => !d.isActive).length}</div>
            <div className="stat-label">Inactive Departments</div>
          </div>
        </div>
      </div>

      {/* Departments Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Department Name</th>
              <th>Description</th>
              <th>Manager</th>
              <th>Location</th>
              <th>Staff Count</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length > 0 ? (
              departments.map(dept => (
                <tr key={dept.id} style={!dept.isActive ? { opacity: 0.6 } : {}}>
                  <td><strong>{dept.name}</strong></td>
                  <td>{dept.description || '—'}</td>
                  <td>{dept.manager ? `${dept.manager.firstName} ${dept.manager.lastName}` : '—'}</td>
                  <td>{dept.location || '—'}</td>
                  <td>{dept.staff?.length || 0}</td>
                  <td>
                    <span className={`status-badge ${dept.isActive ? 'status-active' : 'status-inactive'}`}>
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-sm btn-edit" 
                        onClick={() => handleEdit(dept)}
                        style={{ background: '#0f3460', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ✏️ Edit
                      </button>
                      {dept.isActive && (
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={() => handleDelete(dept)}
                          style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          🗑️ Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7" className="text-center">No departments found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>{editingDepartment ? 'Edit Department' : 'Add New Department'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Department Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Cardiology"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Brief description of the department"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Manager</label>
                    <select
                      name="managerId"
                      value={formData.managerId}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Manager</option>
                      {staff.filter(s => s.isActive).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g., Main Building, 3rd Floor"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Cost Center</label>
                  <input
                    type="text"
                    name="costCenter"
                    value={formData.costCenter}
                    onChange={handleInputChange}
                    placeholder="e.g., CC-001"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingDepartment ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagement;