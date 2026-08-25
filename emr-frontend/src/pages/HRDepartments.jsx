// src/pages/HRDepartments.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const HRDepartments = () => {
  const { token } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    location: '',
    costCenter: ''
  });

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/hr/departments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(res.data);
    } catch (error) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/hr/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(res.data.filter(e => e.isActive));
    } catch (error) {
      toast.error('Failed to load employees');
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await axios.put(`http://localhost:3000/api/hr/departments/${editingDept.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Department updated successfully!');
      } else {
        await axios.post('http://localhost:3000/api/hr/departments', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Department created successfully!');
      }
      setShowModal(false);
      setEditingDept(null);
      resetForm();
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      managerId: '',
      location: '',
      costCenter: ''
    });
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      managerId: dept.managerId || '',
      location: dept.location || '',
      costCenter: dept.costCenter || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department? This will remove all associated data.')) return;
    try {
      await axios.delete(`http://localhost:3000/api/hr/departments/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Department deleted successfully');
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete department');
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🏢 Department Management</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setEditingDept(null); setShowModal(true); }}>
          + Add Department
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Manager</th>
              <th>Location</th>
              <th>Staff Count</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => (
              <tr key={dept.id}>
                <td><strong>{dept.name}</strong></td>
                <td>{dept.description || '—'}</td>
                <td>{dept.manager?.firstName} {dept.manager?.lastName || '—'}</td>
                <td>{dept.location || '—'}</td>
                <td>{dept.staff?.length || 0}</td>
                <td>
  <button 
    className="btn btn-sm btn-edit" 
    onClick={() => handleEdit(dept)}
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
    onClick={() => handleDelete(dept.id)}
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
            {departments.length === 0 && (
              <tr><td colSpan="6" className="text-center">No departments created yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Department Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{editingDept ? 'Edit Department' : 'Add Department'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Department Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" />
                </div>
                <div className="form-group">
                  <label>Manager</label>
                  <select name="managerId" value={formData.managerId} onChange={handleInputChange}>
                    <option value="">None</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label>Cost Center</label>
                  <input type="text" name="costCenter" value={formData.costCenter} onChange={handleInputChange} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingDept ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRDepartments;