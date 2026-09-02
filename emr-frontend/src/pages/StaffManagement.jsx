// src/pages/StaffManagement.jsx - COMPLETE WITH ALL SPECIALIST ROLES

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
  const [showAssignmentAlert, setShowAssignmentAlert] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');
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

  // Assignment state
  const [clinics, setClinics] = useState([]);
  const [wards, setWards] = useState([]);
  const [assignedClinicIds, setAssignedClinicIds] = useState([]);
  const [assignedWardIds, setAssignedWardIds] = useState([]);

  // ✅ COMPLETE ROLES LIST WITH ALL SPECIALISTS
  const roles = [
    // ===== ADMIN ROLES =====
    'Admin', 'ITAdmin', 'ITSupport',
    
    // ===== CLINICAL ROLES =====
    'Doctor', 'Nurse',
    
    // ===== SPECIALIST ROLES =====
    'Obstetrician', 'Midwife', 
    'Radiologist', 'Dentist', 'Optometrist', 
    'Paediatrician', 'Surgeon', 'Psychiatrist',
    'Ophthalmologist', 'Dermatologist', 'Cardiologist',
    'Neurologist', 'Orthopedic', 'ENT', 'Urologist',
    'Anaesthesiologist', 'Pathologist',
    
    // ===== PHARMACY ROLES =====
    'Pharmacist',
    
    // ===== LAB ROLES =====
    'LabTechnician', 'LabScientist',
    
    // ===== FINANCE ROLES =====
    'Accountant', 'BillingOfficer',
    
    // ===== ADMINISTRATIVE ROLES =====
    'Records', 'Receptionist', 'HR',
  ];

  // ✅ DEPARTMENT LIST WITH SPECIALIST DEPARTMENTS
  const departments = [
    'Administration', 'ICT', 'Information Technology', 'Health Informatics',
    'Internal Medicine', 'Surgery', 'Paediatrics', 'Obstetrics & Gynaecology',
    'Pharmacy', 'Laboratory', 'Medical Records', 'Accounts', 'Radiology',
    'Outpatient', 'Inpatient', 'Dental', 'Optometry', 'Ophthalmology',
    'Cardiology', 'Neurology', 'Orthopedics', 'ENT', 'Urology',
    'Anaesthesiology', 'Pathology', 'Psychiatry', 'Dermatology',
    'Emergency Medicine', 'Family Medicine', 'Geriatrics', 'Oncology',
    'Pulmonology', 'Rheumatology', 'Nephrology', 'Endocrinology',
    'Gastroenterology', 'Infectious Diseases', 'Sports Medicine'
  ];

  // ✅ ROLES THAT REQUIRE CLINIC/WARD ASSIGNMENT
  const rolesRequiringAssignment = [
    'Doctor', 'Nurse', 'Obstetrician', 'Midwife',
    'Paediatrician', 'Surgeon', 'Psychiatrist',
    'Cardiologist', 'Neurologist', 'Orthopedic',
    'ENT', 'Urologist', 'Anaesthesiologist',
    'Dermatologist', 'Ophthalmologist', 'Pathologist'
  ];

  // ✅ ROLES THAT ARE SPECIALISTS (shown with badge)
  const specialistRoles = [
    'Obstetrician', 'Midwife', 'Radiologist', 'Dentist', 'Optometrist',
    'Paediatrician', 'Surgeon', 'Psychiatrist', 'Ophthalmologist',
    'Dermatologist', 'Cardiologist', 'Neurologist', 'Orthopedic',
    'ENT', 'Urologist', 'Anaesthesiologist', 'Pathologist'
  ];

  // ✅ ROLE ICON MAPPING
  const getRoleIcon = (role) => {
    const icons = {
      'Admin': '🔐',
      'ITAdmin': '💻',
      'ITSupport': '🛠️',
      'Doctor': '👨‍⚕️',
      'Nurse': '👩‍⚕️',
      'Obstetrician': '🤱',
      'Midwife': '👩‍🍼',
      'Radiologist': '📷',
      'Dentist': '🦷',
      'Optometrist': '👁️',
      'Paediatrician': '👶',
      'Surgeon': '🔪',
      'Psychiatrist': '🧠',
      'Ophthalmologist': '👁️',
      'Dermatologist': '🧴',
      'Cardiologist': '❤️',
      'Neurologist': '🧬',
      'Orthopedic': '🦴',
      'ENT': '👂',
      'Urologist': '🫘',
      'Anaesthesiologist': '💉',
      'Pathologist': '🔬',
      'Pharmacist': '💊',
      'LabTechnician': '🧪',
      'LabScientist': '🔬',
      'Accountant': '💰',
      'BillingOfficer': '💳',
      'Records': '📋',
      'Receptionist': '📞',
      'HR': '👔'
    };
    return icons[role] || '👤';
  };

  // ✅ GET ROLE COLOR
  const getRoleColor = (role) => {
    const colors = {
      'Admin': '#ef4444',
      'ITAdmin': '#8b5cf6',
      'ITSupport': '#6b7280',
      'Doctor': '#3b82f6',
      'Nurse': '#10b981',
      'Obstetrician': '#ec4899',
      'Midwife': '#f59e0b',
      'Radiologist': '#8b5cf6',
      'Dentist': '#0f3460',
      'Optometrist': '#06b6d4',
      'Paediatrician': '#f472b6',
      'Surgeon': '#dc2626',
      'Psychiatrist': '#7c3aed',
      'Pharmacist': '#f59e0b',
      'LabTechnician': '#3b82f6',
      'LabScientist': '#8b5cf6',
      'Accountant': '#10b981',
      'BillingOfficer': '#14b8a6',
      'Records': '#6366f1',
      'Receptionist': '#f472b6',
      'HR': '#8b5cf6'
    };
    return colors[role] || '#6b7280';
  };

  // ✅ GET ROLE GROUP
  const getRoleGroup = (role) => {
    const groups = {
      'Admin': 'Admin',
      'ITAdmin': 'Admin',
      'ITSupport': 'Admin',
      'Doctor': 'Clinical',
      'Nurse': 'Clinical',
      'Obstetrician': 'Maternity',
      'Midwife': 'Maternity',
      'Radiologist': 'Imaging',
      'Dentist': 'Dental',
      'Optometrist': 'Eye Care',
      'Paediatrician': 'Paediatrics',
      'Surgeon': 'Surgery',
      'Psychiatrist': 'Mental Health',
      'Ophthalmologist': 'Eye Care',
      'Dermatologist': 'Dermatology',
      'Cardiologist': 'Cardiology',
      'Neurologist': 'Neurology',
      'Orthopedic': 'Orthopedics',
      'ENT': 'ENT',
      'Urologist': 'Urology',
      'Anaesthesiologist': 'Anaesthesiology',
      'Pathologist': 'Pathology',
      'Pharmacist': 'Pharmacy',
      'LabTechnician': 'Laboratory',
      'LabScientist': 'Laboratory',
      'Accountant': 'Finance',
      'BillingOfficer': 'Finance',
      'Records': 'Records',
      'Receptionist': 'Administrative',
      'HR': 'HR'
    };
    return groups[role] || 'Other';
  };

  // ✅ FETCH STAFF WITH ASSIGNMENTS
  const fetchStaff = async () => {
    setLoading(true);
    try {
      console.log('📋 Fetching staff list...');
      const res = await axios.get('http://localhost:3000/api/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const staffWithAssignments = await Promise.all(
        res.data.map(async (staffMember) => {
          try {
            const assignRes = await axios.get(
              `http://localhost:3000/api/staff/${staffMember.id}/assignments`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            return {
              ...staffMember,
              StaffClinic: assignRes.data.clinics || [],
              StaffWard: assignRes.data.wards || []
            };
          } catch (e) {
            return { 
              ...staffMember, 
              StaffClinic: [], 
              StaffWard: [] 
            };
          }
        })
      );

      setStaff(staffWithAssignments);
      localStorage.setItem('staffData', JSON.stringify(staffWithAssignments));
      console.log(`✅ Staff loaded: ${staffWithAssignments.length} members`);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH CLINICS AND WARDS
  const fetchClinicsAndWards = async () => {
    try {
      const [clinicRes, wardRes] = await Promise.all([
        axios.get('http://localhost:3000/api/clinics', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/wards', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setClinics(clinicRes.data);
      setWards(wardRes.data);
    } catch (error) {
      console.error('Error fetching clinics/wards:', error);
      toast.error('Failed to load clinics/wards');
    }
  };

  // ✅ FETCH ASSIGNMENTS FOR EDITING
  const fetchAssignments = async (staffId) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/staff/${staffId}/assignments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignedClinicIds(res.data.clinicIds || []);
      setAssignedWardIds(res.data.wardIds || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignedClinicIds([]);
      setAssignedWardIds([]);
    }
  };

  // ✅ GET ASSIGNMENT DISPLAY
  const getAssignmentDisplay = (staffMember) => {
    const assignedClinics = staffMember?.StaffClinic || [];
    const assignedWards = staffMember?.StaffWard || [];
    
    const clinicNames = assignedClinics
      .map(clinic => clinic?.name)
      .filter(Boolean);
      
    const wardNames = assignedWards
      .map(ward => ward?.name)
      .filter(Boolean);
      
    const allAssignments = [...clinicNames, ...wardNames];

    if (allAssignments.length > 0) {
      return (
        <span style={{ color: '#10b981', fontSize: '11px', display: 'block', marginTop: '2px' }}>
          📍 {allAssignments.join(', ')}
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-block',
        marginTop: '2px',
        padding: '2px 8px',
        background: '#fef3c7',
        color: '#92400e',
        fontSize: '10px',
        borderRadius: '12px',
        fontWeight: '600'
      }}>
        ⚠️ No Clinic/Ward Assigned
      </span>
    );
  };

  useEffect(() => {
    if (token) {
      fetchStaff();
      fetchClinicsAndWards();
    }
  }, [token]);

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
        const { password, ...updateData } = formData;
        if (updateData.username) updateData.username = updateData.username.toLowerCase().trim();
        await axios.put(`http://localhost:3000/api/staff/${editingStaff.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Staff updated successfully!');

        if (rolesRequiringAssignment.includes(formData.role) && editingStaff) {
          try {
            const currentAssignments = await axios.get(
              `http://localhost:3000/api/staff/${editingStaff.id}/assignments`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const oldClinicIds = currentAssignments.data.clinicIds || [];
            const oldWardIds = currentAssignments.data.wardIds || [];

            for (const clinicId of oldClinicIds) {
              try {
                await axios.delete(
                  `http://localhost:3000/api/staff/${editingStaff.id}/clinics/${clinicId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
              } catch (err) {}
            }

            for (const wardId of oldWardIds) {
              try {
                await axios.delete(
                  `http://localhost:3000/api/staff/${editingStaff.id}/wards/${wardId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
              } catch (err) {}
            }

            for (const clinicId of assignedClinicIds) {
              try {
                await axios.post(
                  `http://localhost:3000/api/staff/${editingStaff.id}/clinics`,
                  { clinicId },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
              } catch (err) {}
            }

            for (const wardId of assignedWardIds) {
              try {
                await axios.post(
                  `http://localhost:3000/api/staff/${editingStaff.id}/wards`,
                  { wardId },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
              } catch (err) {}
            }

            toast.success('Assignments updated successfully!');
          } catch (error) {
            toast.error('Failed to update assignments');
          }
        }
      } else {
        const newStaff = { ...formData, username: formData.username.toLowerCase().trim() };
        const response = await axios.post('http://localhost:3000/api/staff', newStaff, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const createdStaff = response.data;
        toast.success('Staff created successfully!');

        if (rolesRequiringAssignment.includes(formData.role)) {
          setNewStaffName(`${formData.firstName} ${formData.lastName}`);
          setNewStaffRole(formData.role);
          setShowAssignmentAlert(true);

          setEditingStaff(createdStaff);
          setFormData({
            employeeId: createdStaff.employeeId,
            firstName: createdStaff.firstName,
            lastName: createdStaff.lastName,
            username: createdStaff.username || '',
            email: createdStaff.email,
            role: createdStaff.role,
            department: createdStaff.department || '',
            password: ''
          });
          if (rolesRequiringAssignment.includes(createdStaff.role)) {
            await fetchAssignments(createdStaff.id);
          }
          setShowModal(true);
        }
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

  const handleEdit = async (staffMember) => {
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

    if (rolesRequiringAssignment.includes(staffMember.role)) {
      await fetchAssignments(staffMember.id);
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
      {/* Assignment Alert Banner */}
      {showAssignmentAlert && (
        <div className="alert-banner" style={{
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '16px 24px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#92400e', fontSize: '16px' }}>
                {newStaffRole} Created Successfully!
              </strong>
              <p style={{ margin: '4px 0 0 0', color: '#78350f', fontSize: '14px' }}>
                <strong>{newStaffName}</strong> needs to be assigned to a <strong>Clinic</strong> or <strong>Ward</strong>
                before they can see patients.
              </p>
            </div>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowAssignmentAlert(false)}
            style={{ flexShrink: 0 }}
          >
            Got it 👍
          </button>
        </div>
      )}

      <div className="page-header">
        <h2>👥 Staff Management</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
              setShowAssignmentAlert(false);
              setShowModal(true);
            }}
          >
            + Add Staff
          </button>
          <button className="btn btn-secondary" onClick={fetchStaff}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <div className="stat-value">{staff.length}</div>
            <div className="stat-label">Total Staff</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{staff.filter(s => s.isActive).length}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">🦷</div>
          <div className="stat-info">
            <div className="stat-value">{staff.filter(s => s.role === 'Dentist').length}</div>
            <div className="stat-label">Dentists</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #06b6d4' }}>
          <div className="stat-icon">👁️</div>
          <div className="stat-info">
            <div className="stat-value">{staff.filter(s => s.role === 'Optometrist' || s.role === 'Ophthalmologist').length}</div>
            <div className="stat-label">Eye Specialists</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ec4899' }}>
          <div className="stat-icon">🤱</div>
          <div className="stat-info">
            <div className="stat-value">{staff.filter(s => s.role === 'Obstetrician' || s.role === 'Midwife').length}</div>
            <div className="stat-label">Maternity Team</div>
          </div>
        </div>
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
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '18px' }}>💡</span>
        <span style={{ fontSize: '14px', color: '#1e3a5f' }}>
          <strong>Specialist Roles:</strong> Dentist 🦷, Optometrist 👁️, Paediatrician 👶, Surgeon 🔪, 
          Psychiatrist 🧠, and many more. Each specialist gets their own module in the system.
        </span>
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
            {filteredStaff.map((s) => {
              const needsAssignment = rolesRequiringAssignment.includes(s.role);
              const isSpecialist = specialistRoles.includes(s.role);
              const roleIcon = getRoleIcon(s.role);
              const roleColor = getRoleColor(s.role);
              const roleGroup = getRoleGroup(s.role);
              
              return (
                <tr key={s.id} style={!s.isActive ? { opacity: 0.6 } : {}}>
                  <td><strong>{s.employeeId}</strong></td>
                  <td><code>{s.username || '—'}</code></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{s.firstName} {s.lastName}</span>
                      {isSpecialist && (
                        <span style={{
                          fontSize: '9px',
                          background: '#dbeafe',
                          color: '#1e40af',
                          padding: '1px 8px',
                          borderRadius: '10px',
                          fontWeight: '600'
                        }}>
                          SPECIALIST
                        </span>
                      )}
                    </div>
                    {needsAssignment && getAssignmentDisplay(s)}
                  </td>
                  <td>{s.email}</td>
                  <td>
                    <span className="role-badge" style={{
                      background: roleColor,
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {roleIcon} {s.role}
                      <span style={{
                        fontSize: '8px',
                        opacity: 0.7,
                        marginLeft: '2px'
                      }}>
                        ({roleGroup})
                      </span>
                    </span>
                  </td>
                  <td>{s.department || '-'}</td>
                  <td>
                    <span className={`status-badge ${s.isActive ? 'status-active' : 'status-inactive'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => handleEdit(s)}
                        style={{
                          background: '#0f3460',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="btn btn-sm btn-primary" 
                        onClick={() => handleResetPassword(s)}
                        style={{
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        🔑 Reset PW
                      </button>
                      {s.isActive ? (
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={() => handleDeactivate(s)}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          🚫 Deactivate
                        </button>
                      ) : (
                        <button 
                          className="btn btn-sm btn-success" 
                          onClick={() => handleReactivate(s)}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          ✅ Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
              <h3>{editingStaff ? '✏️ Edit Staff' : '➕ Add New Staff'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Basic Info */}
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
                      <optgroup label="🔐 Admin Roles">
                        {['Admin', 'ITAdmin', 'ITSupport'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="👨‍⚕️ Clinical Roles">
                        {['Doctor', 'Nurse'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🤱 Maternity Roles">
                        {['Obstetrician', 'Midwife'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🦷 Specialist Roles">
                        {['Dentist', 'Optometrist', 'Ophthalmologist', 'Paediatrician', 'Surgeon', 'Psychiatrist'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="❤️ Medical Specialists">
                        {['Cardiologist', 'Neurologist', 'Orthopedic', 'ENT', 'Urologist', 'Anaesthesiologist', 'Pathologist', 'Dermatologist'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="📷 Imaging & Lab">
                        {['Radiologist', 'LabTechnician', 'LabScientist'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="💊 Pharmacy">
                        {['Pharmacist'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="💰 Finance">
                        {['Accountant', 'BillingOfficer'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                      <optgroup label="📋 Administrative">
                        {['Records', 'Receptionist', 'HR'].map(role => (
                          <option key={role} value={role}>{getRoleIcon(role)} {role}</option>
                        ))}
                      </optgroup>
                    </select>
                    <small style={{ color: '#6b7280' }}>
                      {formData.role && `Group: ${getRoleGroup(formData.role)}`}
                      {specialistRoles.includes(formData.role) && ' ⭐ Specialist Role'}
                    </small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={formData.department} onChange={handleInputChange}>
                      <option value="">Select Department</option>
                      {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                  </div>
                </div>

                {!editingStaff && (
                  <div className="form-group">
                    <label>Password *</label>
                    <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
                    <small>Minimum 6 characters</small>
                  </div>
                )}

                {/* Assignment section for roles that need it */}
                {editingStaff && rolesRequiringAssignment.includes(formData.role) && (
                  <>
                    <div style={{
                      background: '#eff6ff',
                      border: '1px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px'
                    }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#1e3a5f' }}>
                        <strong>⚠️ Important:</strong> Assign this {formData.role} to at least one
                        <strong> Clinic</strong> or <strong>Ward</strong> so they can see patients.
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Assign Clinics</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {clinics.length > 0 ? (
                          clinics.map(c => (
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
                          ))
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '14px' }}>
                            ⚠️ No clinics available. Please create a clinic first.
                          </span>
                        )}
                      </div>
                      {assignedClinicIds.length > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#10b981' }}>
                          ✅ Currently assigned to: {assignedClinicIds.map(id =>
                            clinics.find(c => c.id === id)?.name
                          ).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Assign Wards</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {wards.length > 0 ? (
                          wards.map(w => (
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
                          ))
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '14px' }}>
                            ⚠️ No wards available. Please create a ward first.
                          </span>
                        )}
                      </div>
                      {assignedWardIds.length > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#10b981' }}>
                          ✅ Currently assigned to: {assignedWardIds.map(id =>
                            wards.find(w => w.id === id)?.name
                          ).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {editingStaff && !rolesRequiringAssignment.includes(formData.role) && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px'
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#065f46' }}>
                      ✅ {formData.role} does not require clinic/ward assignment.
                      {specialistRoles.includes(formData.role) && ' This is a specialist role with its own module.'}
                    </p>
                  </div>
                )}
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