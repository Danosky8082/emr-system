// src/pages/ManagePermissions.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ManagePermissions = () => {
  const { token } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const modules = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'patients', label: 'Patients' },
    { key: 'staff', label: 'Staff Mgmt' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'prescriptions', label: 'Prescriptions' },
    { key: 'labOrders', label: 'Lab Orders' },
    { key: 'billing', label: 'Billing' },
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: 'clinics', label: 'Manage Clinics' },
    { key: 'wards', label: 'Manage Wards' },
    { key: 'pricing', label: 'Service Pricing' },
    { key: 'billingOfficer', label: 'Billing Desk' },
    { key: 'patientIntake', label: 'Patient Intake' },
    { key: 'admissions', label: 'ADT' },
    { key: 'patientHistory', label: 'Patient History' },
    { key: 'roiRequests', label: 'ROI Requests' },
    { key: 'nurseDashboard', label: 'Nurse Dashboard' },
    { key: 'doctorDashboard', label: 'Doctor Dashboard' },
  ];

  const fetchPermissions = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/permissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissions(res.data);
    } catch (error) { toast.error('Failed to load permissions'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPermissions(); }, []);

  const togglePermission = async (role, moduleKey, currentValue) => {
    try {
      await axios.patch(`http://localhost:3000/api/permissions/${role}`, 
        { [moduleKey]: !currentValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Updated ${role} permissions`);
      fetchPermissions();
    } catch (error) { toast.error('Failed to update permission'); }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Manage Role Permissions</h2>
        <p>Check/Uncheck modules to grant or revoke access for each role. Changes take effect immediately upon login.</p>
      </div>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '120px' }}>Role</th>
              {modules.map(m => <th key={m.key} style={{ textAlign: 'center', minWidth: '80px' }}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissions.map(p => (
              <tr key={p.role}>
                <td><strong>{p.role}</strong></td>
                {modules.map(m => (
                  <td key={m.key} style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={p[m.key] ?? false} 
                      onChange={() => togglePermission(p.role, m.key, p[m.key])}
                      disabled={p.role === 'Admin'} // Admin has God-mode, cannot be disabled
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ManagePermissions;