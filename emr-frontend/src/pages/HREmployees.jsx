// src/pages/HREmployees.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const HREmployees = () => {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    role: 'Doctor',
    departmentId: '',
    managerId: '',
    dateOfBirth: '',
    gender: 'Male',
    phone: '',
    address: '',
    emergencyContact: '',
    employmentType: 'Full-time',
    startDate: '',
    salary: '',
    bankName: '',
    bankAccount: '',
    bankBranch: '',
    taxId: '',
    nationalId: '',
    isActive: true
  });

  const roles = [
    'Admin', 'ITAdmin', 'ITSupport', 'Doctor', 'Nurse',
    'Pharmacist', 'Accountant', 'Records', 'LabTechnician',
    'Receptionist', 'BillingOfficer', 'Obstetrician', 'Midwife',
    'Radiologist', 'HR', 'Auditor', 'Dentist'
  ];

  const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Intern'];

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/hr/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(res.data);
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/hr/departments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(res.data);
    } catch (error) {
      toast.error('Failed to load departments');
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
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
      if (editingEmployee) {
        await axios.put(`http://localhost:3000/api/hr/employees/${editingEmployee.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Employee updated successfully!');
      } else {
        // Create new employee (uses existing staff creation)
        await axios.post('http://localhost:3000/api/staff', {
          ...formData,
          username: formData.email.split('@')[0],
          password: 'TempPass123!'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Employee added successfully!');
      }
      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      role: 'Doctor',
      departmentId: '',
      managerId: '',
      dateOfBirth: '',
      gender: 'Male',
      phone: '',
      address: '',
      emergencyContact: '',
      employmentType: 'Full-time',
      startDate: '',
      salary: '',
      bankName: '',
      bankAccount: '',
      bankBranch: '',
      taxId: '',
      nationalId: '',
      isActive: true
    });
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      employeeId: employee.employeeId || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      role: employee.role,
      departmentId: employee.departmentId || '',
      managerId: employee.managerId || '',
      dateOfBirth: employee.dateOfBirth?.split('T')[0] || '',
      gender: employee.gender || 'Male',
      phone: employee.phone || '',
      address: employee.address || '',
      emergencyContact: employee.emergencyContact || '',
      employmentType: employee.employmentType || 'Full-time',
      startDate: employee.startDate?.split('T')[0] || '',
      salary: employee.salary || '',
      bankName: employee.bankName || '',
      bankAccount: employee.bankAccount || '',
      bankBranch: employee.bankBranch || '',
      taxId: employee.taxId || '',
      nationalId: employee.nationalId || '',
      isActive: employee.isActive !== undefined ? employee.isActive : true
    });
    setShowModal(true);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = `${emp.firstName} ${emp.lastName} ${emp.employeeId} ${emp.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === 'all' || emp.departmentId === filterDepartment;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && emp.isActive) ||
      (filterStatus === 'inactive' && !emp.isActive);
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>👤 Employee Management</h2>
        <button className="btn btn-primary" onClick={() => {
          setEditingEmployee(null);
          resetForm();
          setShowModal(true);
        }}>
          + Add Employee
        </button>
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
          placeholder="🔍 Search employees..."
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
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            background: 'white'
          }}
        >
          <option value="all">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            background: 'white'
          }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {filteredEmployees.length} employees
        </span>
      </div>

      {/* Employee Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Employment Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => (
              <tr key={emp.id}>
                <td><strong>{emp.employeeId}</strong></td>
                <td>{emp.firstName} {emp.lastName}</td>
                <td><span className="role-badge">{emp.role}</span></td>
                <td>{emp.department?.name || '—'}</td>
                <td>{emp.employmentType || '—'}</td>
                <td>
                  <span className={`status-badge ${emp.isActive ? 'status-active' : 'status-inactive'}`}>
                    {emp.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
  <button className="btn btn-sm btn-edit" onClick={() => handleEdit(emp)}>✏️ Edit</button>
  <Link 
    to={`/hr/employees/${emp.id}`} 
    className="btn btn-sm btn-primary" 
    style={{ 
      marginLeft: '4px',
      background: '#0f3460',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '4px 10px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '600',
      textDecoration: 'none',
      display: 'inline-block'
    }}
  >
    📄 View
  </Link>
</td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr><td colSpan="7" className="text-center">No employees found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Employee Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Employee ID *</label>
                    <input type="text" name="employeeId" value={formData.employeeId} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role *</label>
                    <select name="role" value={formData.role} onChange={handleInputChange} required>
                      {roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select name="departmentId" value={formData.departmentId} onChange={handleInputChange}>
                      <option value="">None</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Employment Type</label>
                    <select name="employmentType" value={formData.employmentType} onChange={handleInputChange}>
                      {employmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Emergency Contact</label>
                    <input type="text" name="emergencyContact" value={formData.emergencyContact} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Salary</label>
                    <input type="number" name="salary" value={formData.salary} onChange={handleInputChange} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="isActive" value={formData.isActive ? 'true' : 'false'} onChange={(e) => setFormData(prev => ({...prev, isActive: e.target.value === 'true'}))}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input type="text" name="bankName" value={formData.bankName} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Bank Account</label>
                    <input type="text" name="bankAccount" value={formData.bankAccount} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tax ID</label>
                    <input type="text" name="taxId" value={formData.taxId} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>National ID</label>
                    <input type="text" name="nationalId" value={formData.nationalId} onChange={handleInputChange} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingEmployee ? 'Update Employee' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HREmployees;