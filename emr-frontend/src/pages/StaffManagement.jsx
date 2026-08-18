// src/pages/StaffManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import './StaffManagement.css';
import { useSearch } from '../components/Layout';

const StaffManagement = () => {
  const { token } = useAuth();
  const { searchTerm } = useSearch();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    role: 'Records',
    department: '',
    password: ''
  });

  // Assignment state (for nurses and doctors)
  const [clinics, setClinics] = useState([]);
  const [wards, setWards] = useState([]);
  const [assignedClinicIds, setAssignedClinicIds] = useState([]);
  const [assignedWardIds, setAssignedWardIds] = useState([]);

  // Available roles
  const roles = [
    'Admin', 'ITAdmin', 'ITSupport', 'Doctor', 'Nurse',
    'Pharmacist', 'Accountant', 'Records', 'LabTechnician', 'Receptionist', 'BillingOfficer','Obstetrician', 'Midwife'      
  ];

  // Departments
  const departments = [
    'Administration', 'Internal Medicine', 'Surgery', 'Paediatrics',
    'Obstetrics & Gynaecology', 'Pharmacy', 'Laboratory', 'Medical Records',
    'Accounts', 'Radiology', 'Outpatient', 'Inpatient', 'ICT',
    'Information Technology', 'Health Informatics'
  ];

  // Fetch staff on load
  useEffect(() => {
    fetchStaff();
    fetchClinicsAndWards();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(res.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const fetchClinicsAndWards = async () => {
    try {
      const [clinicRes, wardRes] = await Promise.all([
        axios.get('http://localhost:3000/api/clinics', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/wards', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setClinics(clinicRes.data);
      setWards(wardRes.data);
    } catch (error) {
      console.error('Error fetching clinics/wards:', error);
      toast.error('Failed to load clinics/wards');
    }
  };

  // Fetch assignments when editing a nurse or doctor
  const fetchAssignments = async (staffId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/staff/${staffId}/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssignedClinicIds(res.data.clinicIds);
      setAssignedWardIds(res.data.wardIds);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load assignments');
    }
  };

    // Filter staff by search term
  const filteredStaff = staff.filter(s => {
    const searchString = `${s.firstName} ${s.lastName} ${s.username || ''} ${s.email || ''} ${s.role} ${s.employeeId || ''} ${s.department || ''}`.toLowerCase().trim();
    return searchString.includes(searchTerm.toLowerCase().trim());
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        // Update existing staff
        const { password, ...updateData } = formData;
        if (updateData.username) updateData.username = updateData.username.toLowerCase().trim();
        await axios.put(`http://localhost:3000/api/staff/${editingStaff.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Staff updated successfully!');

        // If editing a nurse or doctor, update assignments
        if (['Nurse', 'Doctor'].includes(formData.role)) {
          // Remove all existing assignments (simplified approach: replace)
          const currentClinics = await axios.get(`http://localhost:3000/api/staff/${editingStaff.id}/assignments`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const oldClinicIds = currentClinics.data.clinicIds;
          const oldWardIds = currentClinics.data.wardIds;

          // Remove old clinics
          await Promise.all(oldClinicIds.map(clinicId =>
            axios.delete(`http://localhost:3000/api/staff/${editingStaff.id}/clinics/${clinicId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ));
          // Remove old wards
          await Promise.all(oldWardIds.map(wardId =>
            axios.delete(`http://localhost:3000/api/staff/${editingStaff.id}/wards/${wardId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ));

          // Add new assignments
          await Promise.all(assignedClinicIds.map(clinicId =>
            axios.post(`http://localhost:3000/api/staff/${editingStaff.id}/clinics`, { clinicId }, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ));
          await Promise.all(assignedWardIds.map(wardId =>
            axios.post(`http://localhost:3000/api/staff/${editingStaff.id}/wards`, { wardId }, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ));
          toast.success('Assignments updated successfully!');
        }
      } else {
        // Create new staff
        const newStaff = { ...formData, username: formData.username.toLowerCase().trim() };
        await axios.post('http://localhost:3000/api/staff', newStaff, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Staff created successfully!');
      }

      setShowModal(false);
      setEditingStaff(null);
      setFormData({
        employeeId: '', firstName: '', lastName: '', username: '', email: '',
        role: 'Records', department: '', password: ''
      });
      setAssignedClinicIds([]);
      setAssignedWardIds([]);
      fetchStaff();
    } catch (error) {
      const message = error.response?.data?.error || 'Operation failed';
      toast.error(message);
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      employeeId: staffMember.employeeId,
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      username: staffMember.username || '',
      email: staffMember.email,
      role: staffMember.role,
      department: staffMember.department || '',
      password: ''
    });
    // If editing a nurse or doctor, fetch their assignments
    if (['Nurse', 'Doctor'].includes(staffMember.role)) {
      fetchAssignments(staffMember.id);
    } else {
      setAssignedClinicIds([]);
      setAssignedWardIds([]);
    }
    setShowModal(true);
  };

  const handleDeactivate = async (staffMember) => {
    if (!window.confirm(`Are you sure you want to deactivate ${staffMember.firstName} ${staffMember.lastName}?`)) return;
    try {
      await axios.delete(`http://localhost:3000/api/staff/${staffMember.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Staff deactivated successfully');
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleReactivate = async (staffMember) => {
    try {
      await axios.patch(`http://localhost:3000/api/staff/${staffMember.id}/reactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Staff reactivated successfully');
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleResetPassword = async (staffMember) => {
    const newPassword = prompt(`Enter new password for ${staffMember.firstName} ${staffMember.lastName}:`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await axios.post(`http://localhost:3000/api/staff/${staffMember.id}/reset-password`, { newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="staff-management">
      <div className="page-header">
        <h2>Staff Management</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setEditingStaff(null);
            setFormData({
              employeeId: '', firstName: '', lastName: '', username: '', email: '',
              role: 'Records', department: '', password: ''
            });
            setAssignedClinicIds([]);
            setAssignedWardIds([]);
            setShowModal(true);
          }}
        >
          + Add Staff
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.employeeId}</strong></td>
                <td><code>{s.username || '—'}</code></td>
                <td>{s.firstName} {s.lastName}</td>
                <td>{s.email}</td>
                <td><span className="role-badge">{s.role}</span></td>
                <td>{s.department || '-'}</td>
                <td>
                  <span className={`status-badge ${s.isActive ? 'status-active' : 'status-inactive'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleResetPassword(s)}>Reset PW</button>
                    {s.isActive ? (
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(s)}>Deactivate</button>
                    ) : (
                      <button className="btn btn-sm btn-success" onClick={() => handleReactivate(s)}>Reactivate</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredStaff.length === 0 && (
              <tr><td colSpan="8" className="text-center">No matching staff found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Add/Edit Staff */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingStaff ? 'Edit Staff' : 'Add New Staff'}</h3>
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
                    <label>Username *</label>
                    <input type="text" name="username" value={formData.username} onChange={handleInputChange} required />
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
                    <label>Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select name="role" value={formData.role} onChange={handleInputChange} required>
                      {roles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Department *</label>
                    <select name="department" value={formData.department} onChange={handleInputChange} required>
                      <option value="">Select Department</option>
                      {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                  </div>
                </div>
                {!editingStaff && (
                  <div className="form-group">
                    <label>Password *</label>
                    <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
                  </div>
                )}

                {/* --- 🆕 Assignment section for nurses AND doctors --- */}
                {editingStaff && ['Nurse', 'Doctor'].includes(formData.role) && (
                  <>
                    <div className="form-group">
                      <label>Assign Clinics</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {clinics.map(c => (
                          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                              type="checkbox"
                              checked={assignedClinicIds.includes(c.id)}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...assignedClinicIds, c.id]
                                  : assignedClinicIds.filter(id => id !== c.id);
                                setAssignedClinicIds(newIds);
                              }}
                            />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Assign Wards</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {wards.map(w => (
                          <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                              type="checkbox"
                              checked={assignedWardIds.includes(w.id)}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...assignedWardIds, w.id]
                                  : assignedWardIds.filter(id => id !== w.id);
                                setAssignedWardIds(newIds);
                              }}
                            />
                            {w.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {/* -------------------------------------------------- */}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingStaff ? 'Update Staff' : 'Create Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;