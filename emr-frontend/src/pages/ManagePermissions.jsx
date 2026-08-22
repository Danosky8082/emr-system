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
    // Core Modules
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'patients', label: 'Patients' },
    { key: 'staff', label: 'Staff Mgmt' },
    { key: 'appointments', label: 'Appointments' },
    
    // Clinical Modules
    { key: 'prescriptions', label: 'Prescriptions' },
    { key: 'labOrders', label: 'Lab Orders' },
    { key: 'antenatal', label: 'Antenatal Care' },
    { key: 'nurseDashboard', label: 'Nurse Dashboard' },
    { key: 'doctorDashboard', label: 'Doctor Dashboard' },
    { key: 'doctorQueue', label: 'Doctor Queue' },
    
    // Pharmacy Modules
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: 'pharmacyDashboard', label: 'Pharmacy Dashboard' },
    { key: 'pharmacyInventory', label: 'Pharmacy Inventory' },
    { key: 'nhisManagement', label: 'NHIS Management' },
    { key: 'nhisAuthorizations', label: 'NHIS Authorizations' },
    { key: 'pharmacyStock', label: 'Stock Management' },
    { key: 'pharmacyTransactions', label: 'Transactions' },
    { key: 'pharmacyBranches', label: 'Pharmacy Branches' },
    
    // Finance Modules
    { key: 'billing', label: 'Billing' },
    { key: 'pricing', label: 'Service Pricing' },
    { key: 'billingOfficer', label: 'Billing Desk' },
    
    // Records Modules
    { key: 'patientIntake', label: 'Patient Intake' },
    { key: 'admissions', label: 'ADT' },
    { key: 'patientHistory', label: 'Patient History' },
    { key: 'roiRequests', label: 'ROI Requests' },
    { key: 'archivedPatients', label: 'Archived Patients (Manage)' },
    { key: 'archivedPatientsView', label: 'Archived Patients (View Only)' },
    
    // Admin Modules
    { key: 'clinics', label: 'Manage Clinics' },
    { key: 'wards', label: 'Manage Wards' },
    
    // Queue Management
    { key: 'queueManagement', label: 'Queue Management' },
  ];

  const fetchPermissions = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/permissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissions(res.data);
    } catch (error) { 
      console.error('Failed to load permissions:', error);
      toast.error('Failed to load permissions'); 
    } 
    finally { setLoading(false); }
  };

  useEffect(() => { 
    if (token) {
      fetchPermissions(); 
    }
  }, [token]);

  const togglePermission = async (role, moduleKey, currentValue) => {
    try {
      await axios.patch(`http://localhost:3000/api/permissions/${role}`, 
        { [moduleKey]: !currentValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Updated ${role} permissions`);
      fetchPermissions();
    } catch (error) { 
      console.error('Toggle permission error:', error);
      toast.error('Failed to update permission'); 
    }
  };

  // ✅ Helper to check if a role should have certain permissions disabled
  const isPermissionLocked = (role, moduleKey) => {
    // Admin has all permissions (God mode) - cannot be disabled
    if (role === 'Admin') return true;
    
    // Lock specific permissions for specific roles
    const locks = {
      // Billing Officer can view pricing but not manage it
      'pricing': ['BillingOfficer'],
      // Accountant shouldn't access billing desk (they have their own view)
      'billingOfficer': ['Accountant'],
      // Only specific roles can access antenatal
      'antenatal': ['Doctor', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport'],
      // Only specific roles can access archived patients
      'archivedPatients': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport'],
      // Only Admin/ITAdmin/Records can manage patient intake
      'patientIntake': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife'],
      // Only Admin/ITAdmin/Records can manage admissions
      'admissions': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife'],
      // Only Admin/ITAdmin/Records can manage staff
      'staff': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife'],
      // Only Admin/ITAdmin can manage clinics
      'clinics': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records'],
      // Only Admin/ITAdmin can manage wards
      'wards': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records'],
      
      // 🆕 Doctor Queue - Only Doctors and Obstetricians should have it
      'doctorQueue': ['Nurse', 'Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Midwife', 'Records'],
      
      // 🆕 Queue Management - Only Admin, Records, Nurse, Doctor should have it
      'queueManagement': ['Pharmacist', 'LabTechnician', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport'],
      
      // Pharmacy locks
      'pharmacyInventory': ['Doctor', 'Nurse', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'ITSupport'],
      'pharmacyStock': ['Doctor', 'Nurse', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'ITSupport'],
      'pharmacyTransactions': ['Doctor', 'Nurse', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'ITSupport'],
      'pharmacyBranches': ['Doctor', 'Nurse', 'Pharmacist', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'ITSupport', 'Obstetrician', 'Midwife', 'Records'],
      'nhisManagement': ['Doctor', 'Nurse', 'LabTechnician', 'Receptionist', 'ITSupport', 'Obstetrician', 'Midwife', 'Records'],
      'nhisAuthorizations': ['Doctor', 'Nurse', 'LabTechnician', 'Receptionist', 'ITSupport', 'Obstetrician', 'Midwife', 'Records'],
    };
    
    return locks[moduleKey]?.includes(role) || false;
  };

  // ✅ Helper to get tooltip text for locked permissions
  const getLockTooltip = (role, moduleKey) => {
    const tooltips = {
      'pricing': 'Billing Officer can view pricing but not manage it',
      'billingOfficer': 'Accountant should use the main Billing module',
      'antenatal': 'Only Obstetricians, Midwives, and Nurses can access antenatal care',
      'archivedPatients': 'Only Records staff can manage archived patients',
      'archivedPatientsView': 'This role can view archived patients but not manage them',
      'patientIntake': 'Only Records staff can manage patient intake',
      'admissions': 'Only Records staff can manage admissions',
      'staff': 'Only Admin, ITAdmin, and Records can manage staff',
      'clinics': 'Only Admin and ITAdmin can manage clinics',
      'wards': 'Only Admin and ITAdmin can manage wards',
      
      // 🆕 Doctor Queue tooltips
      'doctorQueue': '🔒 Only Doctors and Obstetricians can access their patient queue',
      'queueManagement': '🔒 Only Admin, Records, and clinical staff can manage the queue',
      
      // Pharmacy tooltips
      'pharmacyInventory': 'Only Pharmacist, Admin, and ITAdmin can manage inventory',
      'pharmacyStock': 'Only Pharmacist, Admin, and ITAdmin can manage stock',
      'pharmacyTransactions': 'Only Pharmacist, Admin, and ITAdmin can view transactions',
      'pharmacyBranches': 'Only Admin and ITAdmin can manage pharmacy branches',
      'nhisManagement': 'Only Admin, ITAdmin, and Accountant can manage NHIS pricing',
      'nhisAuthorizations': 'Only Admin, ITAdmin, and Accountant can process NHIS authorizations',
    };
    return tooltips[moduleKey] || 'This permission is locked for this role';
  };

  // ✅ Helper to get recommended default permissions
  const getRecommendedPermissions = (role) => {
    const defaults = {
      'Admin': {
        dashboard: true,
        patients: true,
        staff: true,
        appointments: true,
        prescriptions: true,
        labOrders: true,
        billing: true,
        pharmacy: true,
        pharmacyDashboard: true,
        pharmacyInventory: true,
        nhisManagement: true,
        nhisAuthorizations: true,
        pharmacyStock: true,
        pharmacyTransactions: true,
        pharmacyBranches: true,
        clinics: true,
        wards: true,
        pricing: true,
        billingOfficer: true,
        patientIntake: true,
        admissions: true,
        patientHistory: true,
        roiRequests: true,
        nurseDashboard: true,
        doctorDashboard: true,
        antenatal: true,
        archivedPatients: true,
        archivedPatientsView: true,
        doctorQueue: true,
        queueManagement: true,
      },
      'ITAdmin': {
        dashboard: true,
        patients: true,
        staff: true,
        appointments: true,
        prescriptions: true,
        labOrders: true,
        billing: true,
        pharmacy: true,
        pharmacyDashboard: true,
        pharmacyInventory: true,
        nhisManagement: true,
        nhisAuthorizations: true,
        pharmacyStock: true,
        pharmacyTransactions: true,
        pharmacyBranches: true,
        clinics: true,
        wards: true,
        pricing: true,
        billingOfficer: true,
        patientIntake: true,
        admissions: true,
        patientHistory: true,
        roiRequests: true,
        nurseDashboard: true,
        doctorDashboard: true,
        antenatal: true,
        archivedPatients: true,
        archivedPatientsView: true,
        doctorQueue: true,
        queueManagement: true,
      },
      'Records': {
        dashboard: true,
        patients: true,
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: false,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: true,
        admissions: true,
        patientHistory: true,
        roiRequests: true,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: true,
        archivedPatientsView: true,
        doctorQueue: false,
        queueManagement: true,
      },
      'Doctor': {
        dashboard: true,
        patients: true,
        staff: false,
        appointments: true,
        prescriptions: true,
        labOrders: true,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: true,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: true,
        doctorQueue: true,
        queueManagement: false,
      },
      'Nurse': {
        dashboard: true,
        patients: true,
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: false,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: true,
        doctorDashboard: false,
        antenatal: true,
        archivedPatients: false,
        archivedPatientsView: true,
        doctorQueue: false,
        queueManagement: true,
      },
      'Obstetrician': {
        dashboard: true,
        patients: true,
        staff: false,
        appointments: true,
        prescriptions: true,
        labOrders: true,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: true,
        antenatal: true,
        archivedPatients: false,
        archivedPatientsView: true,
        doctorQueue: true,
        queueManagement: false,
      },
      'Midwife': {
        dashboard: true,
        patients: true,
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: false,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: true,
        doctorDashboard: false,
        antenatal: true,
        archivedPatients: false,
        archivedPatientsView: true,
        doctorQueue: false,
        queueManagement: true,
      },
      'Pharmacist': {
        dashboard: true,
        patients: false,
        staff: false,
        appointments: false,
        prescriptions: true,
        labOrders: false,
        billing: false,
        pharmacy: true,
        pharmacyDashboard: true,
        pharmacyInventory: true,
        nhisManagement: true,
        nhisAuthorizations: true,
        pharmacyStock: true,
        pharmacyTransactions: true,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: false,
        doctorQueue: false,
        queueManagement: false,
      },
      'Accountant': {
        dashboard: true,
        patients: false,
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: false,
        billing: true,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: true,
        nhisAuthorizations: true,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: true,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: false,
        doctorQueue: false,
        queueManagement: false,
      },
      'BillingOfficer': {
        dashboard: true,
        patients: true,
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: false,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: true,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: false,
        doctorQueue: false,
        queueManagement: false,
      },
      'LabTechnician': {
        dashboard: true,
        patients: false,
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: true,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: false,
        doctorQueue: false,
        queueManagement: false,
      },
      'Receptionist': {
        dashboard: true,
        patients: true,
        staff: false,
        appointments: true,
        prescriptions: false,
        labOrders: false,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: false,
        doctorQueue: false,
        queueManagement: false,
      },
      'ITSupport': {
        dashboard: true,
        patients: false,
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: false,
        billing: false,
        pharmacy: false,
        pharmacyDashboard: false,
        pharmacyInventory: false,
        nhisManagement: false,
        nhisAuthorizations: false,
        pharmacyStock: false,
        pharmacyTransactions: false,
        pharmacyBranches: false,
        clinics: false,
        wards: false,
        pricing: false,
        billingOfficer: false,
        patientIntake: false,
        admissions: false,
        patientHistory: false,
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: false,
        doctorQueue: false,
        queueManagement: false,
      },
    };
    return defaults[role] || {};
  };

  // ✅ Helper to check if a permission is recommended
  const isRecommended = (role, moduleKey) => {
    const recommended = getRecommendedPermissions(role);
    return recommended[moduleKey] === true;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Manage Role Permissions</h2>
        <p>Check/Uncheck modules to grant or revoke access for each role. Changes take effect immediately upon login.</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            <span style={{ background: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>🔵</span> Recommended
          </span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            <span style={{ background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>🟡</span> Locked (system default)
          </span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>⚪</span> Available to toggle
          </span>
        </div>
      </div>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '120px', position: 'sticky', left: 0, background: '#f8fafc' }}>Role</th>
              {modules.map(m => (
                <th key={m.key} style={{ textAlign: 'center', minWidth: '80px' }}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map(p => (
              <tr key={p.role}>
                <td style={{ position: 'sticky', left: 0, background: 'white', fontWeight: 'bold' }}>
                  {p.role}
                </td>
                {modules.map(m => {
                  const isLocked = isPermissionLocked(p.role, m.key);
                  const isRecommendedPerm = isRecommended(p.role, m.key);
                  const isChecked = p[m.key] ?? false;
                  
                  return (
                    <td key={m.key} style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => togglePermission(p.role, m.key, p[m.key])}
                        disabled={isLocked}
                        title={isLocked ? getLockTooltip(p.role, m.key) : (isRecommendedPerm ? 'Recommended for this role' : '')}
                        style={{ 
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          accentColor: isRecommendedPerm && isChecked ? '#0f3460' : undefined,
                        }}
                      />
                      {isLocked && (
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#6b7280', 
                          display: 'block',
                          marginTop: '2px'
                        }}>
                          🔒
                        </span>
                      )}
                      {!isLocked && isRecommendedPerm && isChecked && (
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#10b981', 
                          display: 'block',
                          marginTop: '2px'
                        }}>
                          ✅
                        </span>
                      )}
                      {!isLocked && isRecommendedPerm && !isChecked && (
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#6b7280', 
                          display: 'block',
                          marginTop: '2px'
                        }}>
                          ○
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManagePermissions;