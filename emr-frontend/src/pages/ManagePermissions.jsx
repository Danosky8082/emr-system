// src/pages/ManagePermissions.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ManagePermissions = () => {
  const { token, user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');

  const modules = [
  // ===== CORE MODULES =====
  { key: 'dashboard', label: '📊 Dashboard', group: 'Core' },
  { key: 'patients', label: '👤 Patients', group: 'Core' },
  { key: 'staff', label: '👥 Staff Mgmt', group: 'Core' },
  { key: 'appointments', label: '📅 Appointments', group: 'Core' },
  
  // ===== CLINICAL MODULES =====
  { key: 'prescriptions', label: '💊 Prescriptions', group: 'Clinical' },
  { key: 'labOrders', label: '🔬 Lab Orders', group: 'Clinical' },
  { key: 'antenatal', label: '🤰 Antenatal Care', group: 'Clinical' },
  { key: 'nurseDashboard', label: '🏥 Nurse Dashboard', group: 'Clinical' },
  { key: 'doctorDashboard', label: '🩺 Doctor Dashboard', group: 'Clinical' },
  { key: 'doctorQueue', label: '📋 Doctor Queue', group: 'Clinical' },
  
  // ===== PHARMACY MODULES =====
  { key: 'pharmacy', label: '💊 Pharmacy', group: 'Pharmacy' },
  { key: 'pharmacyDashboard', label: '📊 Pharmacy Dashboard', group: 'Pharmacy' },
  { key: 'pharmacyInventory', label: '📦 Pharmacy Inventory', group: 'Pharmacy' },
  { key: 'nhisManagement', label: '🏥 NHIS Management', group: 'Pharmacy' },
  { key: 'nhisAuthorizations', label: '✅ NHIS Authorizations', group: 'Pharmacy' },
  { key: 'pharmacyStock', label: '📦 Stock Management', group: 'Pharmacy' },
  { key: 'pharmacyTransactions', label: '🔄 Transactions', group: 'Pharmacy' },
  { key: 'pharmacyBranches', label: '🏪 Pharmacy Branches', group: 'Pharmacy' },
  
  // ===== FINANCE MODULES =====
  { key: 'billing', label: '💰 Billing', group: 'Finance' },
  { key: 'pricing', label: '💲 Service Pricing', group: 'Finance' },
  { key: 'billingOfficer', label: '💳 Billing Desk', group: 'Finance' },
  { key: 'wallet', label: '💳 Patient Wallet', group: 'Finance' },
  
  // ===== RECORDS MODULES =====
  { key: 'patientIntake', label: '📋 Patient Intake', group: 'Records' },
  { key: 'admissions', label: '🏥 ADT', group: 'Records' },
  { key: 'patientHistory', label: '📋 Patient History', group: 'Records' },
  { key: 'roiRequests', label: '📄 ROI Requests', group: 'Records' },
  { key: 'archivedPatients', label: '📦 Archived (Manage)', group: 'Records' },
  { key: 'archivedPatientsView', label: '📦 Archived (View)', group: 'Records' },
  
  // ===== ADMIN MODULES =====
  { key: 'clinics', label: '🏥 Manage Clinics', group: 'Admin' },
  { key: 'wards', label: '🏥 Manage Wards', group: 'Admin' },
  
  // ===== QUEUE MANAGEMENT =====
  { key: 'queueManagement', label: '⏳ Queue Management', group: 'Queue' },
  
  // ===== HR MODULES =====
  { key: 'hrDashboard', label: '📊 HR Dashboard', group: 'HR' },
  { key: 'hrEmployees', label: '👥 HR Employees', group: 'HR' },
  { key: 'hrDepartments', label: '🏢 HR Departments', group: 'HR' },
  { key: 'hrLeaves', label: '📋 HR Leave', group: 'HR' },
  { key: 'hrAttendance', label: '⏰ HR Attendance', group: 'HR' },
  { key: 'hrPerformance', label: '📈 HR Performance', group: 'HR' },
  { key: 'hrTrainings', label: '📚 HR Trainings', group: 'HR' },
  
  // ===== SPECIALTY CLINICS =====
  { key: 'radiology', label: '📷 Radiology', group: 'Specialty' },
  { key: 'dental', label: '🦷 Dental', group: 'Specialty' },
  { key: 'optometry', label: '👁️ Optometry', group: 'Specialty' },
  { key: 'immunizations', label: '💉 Immunizations', group: 'Specialty' },
  
  // ===== PATIENT PORTAL =====
  { key: 'patientPortal', label: '🚑 Patient Portal', group: 'Portal' },
  { key: 'portalSetup', label: '🔑 Portal Setup', group: 'Portal' },
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
      const payload = {
        [moduleKey]: !currentValue
      };
      
      await axios.patch(`http://localhost:3000/api/permissions/${role}`, 
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Updated ${role} permissions`);
      fetchPermissions();
    } catch (error) {
      console.error('Toggle permission error:', error);
      toast.error(error.response?.data?.error || 'Failed to update permission');
    }
  };

  // Helper to check if a role should have certain permissions disabled
  const isPermissionLocked = (role, moduleKey) => {
    // Admin has all permissions (God mode) - cannot be disabled
    if (role === 'Admin') return true;
    if (role === 'ITAdmin') return true;
    
    // Lock specific permissions for specific roles
    const locks = {
      // Billing Officer can view pricing but not manage it
      'pricing': ['BillingOfficer'],
      // Accountant shouldn't access billing desk (they have their own view)
      'billingOfficer': ['Accountant'],
      // Only specific roles can access antenatal
      'antenatal': ['Doctor', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Radiologist'],
      // Only specific roles can access archived patients
      'archivedPatients': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'HR', 'Radiologist'],
      // Only Admin/ITAdmin/Records can manage patient intake
      'patientIntake': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'HR', 'Radiologist'],
      // Only Admin/ITAdmin/Records can manage admissions
      'admissions': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'HR', 'Radiologist'],
      // Only Admin/ITAdmin/HR can manage staff
      'staff': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      // Only Admin/ITAdmin can manage clinics
      'clinics': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'HR', 'Radiologist'],
      // Only Admin/ITAdmin can manage wards
      'wards': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'HR', 'Radiologist'],
      
      // Doctor Queue - Only Doctors and Obstetricians should have it
      'doctorQueue': ['Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Midwife', 'Records', 'HR', 'Radiologist'],
      
      // Queue Management - Only Admin, Records, Nurse, Doctor should have it
      'queueManagement': ['Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'HR', 'Radiologist'],
      
      // Pharmacy locks
      'pharmacyInventory': ['Doctor', 'Nurse', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'LabScientist', 'ITSupport', 'HR', 'Radiologist'],
      'pharmacyStock': ['Doctor', 'Nurse', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'LabScientist', 'ITSupport', 'HR', 'Radiologist'],
      'pharmacyTransactions': ['Doctor', 'Nurse', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'LabScientist', 'ITSupport', 'HR', 'Radiologist'],
      'pharmacyBranches': ['Doctor', 'Nurse', 'Pharmacist', 'Accountant', 'BillingOfficer', 'Receptionist', 'LabTechnician', 'LabScientist', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'HR', 'Radiologist'],
      'nhisManagement': ['Doctor', 'Nurse', 'LabTechnician', 'LabScientist', 'Receptionist', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'HR', 'Radiologist'],
      'nhisAuthorizations': ['Doctor', 'Nurse', 'LabTechnician', 'LabScientist', 'Receptionist', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'HR', 'Radiologist'],
    
      // Radiologist-specific locks
      'archivedPatients': ['Radiologist', 'LabScientist'],       // Cannot manage
      'patients': ['Radiologist', 'LabScientist'],               // View only
      
      // HR locks - Only HR, Admin, ITAdmin can manage HR
      'hrDashboard': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      'hrEmployees': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      'hrDepartments': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      'hrLeaves': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      'hrAttendance': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      'hrPerformance': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      'hrTrainings': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'Records', 'Radiologist'],
      
      // Patient Portal locks
      'patientPortal': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'HR', 'Radiologist'],
      'portalSetup': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'Obstetrician', 'Midwife', 'HR', 'Radiologist'],
      
      // Specialty clinics locks
      'dental': ['Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'HR', 'Radiologist'],
      'optometry': ['Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'HR', 'Radiologist'],
      'immunizations': ['Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'Accountant', 'BillingOfficer', 'ITSupport', 'HR', 'Radiologist'],
      
      // Wallet locks - Only Finance staff can manage
      'wallet': ['Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'LabScientist', 'Receptionist', 'ITSupport', 'Obstetrician', 'Midwife', 'Radiologist'],

      // Lab Scientist specific locks
    'patients': ['Radiologist', 'LabScientist'],  // View only, not manage
    'archivedPatients': ['Radiologist', 'LabScientist'],  // Cannot manage archived patients
    'patientHistory': ['LabScientist'],  // Lab Scientist can view only
    };
    
    return locks[moduleKey]?.includes(role) || false;
  };

  // Helper to get tooltip text for locked permissions
  const getLockTooltip = (role, moduleKey) => {
    const tooltips = {
      'pricing': 'Billing Officer can view pricing but not manage it',
      'billingOfficer': 'Accountant should use the main Billing module',
      'antenatal': 'Only Obstetricians, Midwives, and Nurses can access antenatal care',
      'archivedPatients': 'Only Records staff can manage archived patients',
      'archivedPatientsView': 'This role can view archived patients but not manage them',
      'patientIntake': 'Only Records staff can manage patient intake',
      'admissions': 'Only Records staff can manage admissions',
      'staff': 'Only Admin, ITAdmin, and HR can manage staff',
      'clinics': 'Only Admin and ITAdmin can manage clinics',
      'wards': 'Only Admin and ITAdmin can manage wards',
      
      'doctorQueue': '🔒 Only Doctors and Obstetricians can access their patient queue',
      'queueManagement': '🔒 Only Admin, Records, and clinical staff can manage the queue',
      
      'pharmacyInventory': 'Only Pharmacist, Admin, and ITAdmin can manage inventory',
      'pharmacyStock': 'Only Pharmacist, Admin, and ITAdmin can manage stock',
      'pharmacyTransactions': 'Only Pharmacist, Admin, and ITAdmin can view transactions',
      'pharmacyBranches': 'Only Admin and ITAdmin can manage pharmacy branches',
      'nhisManagement': 'Only Admin, ITAdmin, and Accountant can manage NHIS pricing',
      'nhisAuthorizations': 'Only Admin, ITAdmin, and Accountant can process NHIS authorizations',
      
      'patients': 'Lab Scientists can view patients but not manage them',
      'archivedPatients': 'Lab Scientists cannot manage archived patients',
      
      'hrDashboard': '🔒 Only HR, Admin, and ITAdmin can access HR Dashboard',
      'hrEmployees': '🔒 Only HR, Admin, and ITAdmin can manage employees',
      'hrDepartments': '🔒 Only HR, Admin, and ITAdmin can manage departments',
      'hrLeaves': '🔒 Only HR, Admin, and ITAdmin can manage leaves',
      'hrAttendance': '🔒 Only HR, Admin, and ITAdmin can manage attendance',
      'hrPerformance': '🔒 Only HR, Admin, and ITAdmin can manage performance reviews',
      'hrTrainings': '🔒 Only HR, Admin, and ITAdmin can manage trainings',
      
      'patientPortal': '🔒 Only Admin, ITAdmin, and Records can manage patient portal settings',
      'portalSetup': '🔒 Only Admin, ITAdmin, and Records can set up patient portal access',
      
      'dental': '🔒 Only Doctors, Nurses, and Admin can access dental records',
      'optometry': '🔒 Only Doctors, Nurses, and Admin can access optometry records',
      'immunizations': '🔒 Only Doctors, Nurses, and Admin can manage immunizations',
      
      'wallet': '💳 Only Finance staff (Admin, Accountant, BillingOfficer) can manage patient wallets',
    };
    return tooltips[moduleKey] || 'This permission is locked for this role';
  };

  // Helper to get recommended default permissions
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
        hrDashboard: true,
        hrEmployees: true,
        hrDepartments: true,
        hrLeaves: true,
        hrAttendance: true,
        hrPerformance: true,
        hrTrainings: true,
        radiology: true,
        dental: true,
        optometry: true,
        immunizations: true,
        patientPortal: true,
        portalSetup: true,
        wallet: true,
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
        hrDashboard: true,
        hrEmployees: true,
        hrDepartments: true,
        hrLeaves: true,
        hrAttendance: true,
        hrPerformance: true,
        hrTrainings: true,
        radiology: true,
        dental: true,
        optometry: true,
        immunizations: true,
        patientPortal: true,
        portalSetup: true,
        wallet: true,
      },
      'HR': {
        dashboard: true,
        patients: false,
        staff: true,
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
        hrDashboard: true,
        hrEmployees: true,
        hrDepartments: true,
        hrLeaves: true,
        hrAttendance: true,
        hrPerformance: true,
        hrTrainings: true,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: true,
        portalSetup: true,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: true,
        dental: true,
        optometry: true,
        immunizations: true,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: true,
        optometry: true,
        immunizations: true,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: true,
        dental: true,
        optometry: true,
        immunizations: true,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: true,
        optometry: true,
        immunizations: true,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: true,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: true,
      },
      'LabTechnician': {
        dashboard: true,
        patients: true,      // ✅ Can view patients
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: true,     // ✅ Can manage lab orders
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
      },
      // ✅ NEW: Lab Scientist role
      'LabScientist': {
        dashboard: true,
        patients: true,      // ✅ View patients
        staff: false,
        appointments: false,
        prescriptions: false,
        labOrders: true,     // ✅ Can view, add results, and validate
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
        patientHistory: true,  // ✅ Can view patient history for context
        roiRequests: false,
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: true,  // ✅ Can view archived patients
        doctorQueue: false,
        queueManagement: false,
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
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
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: false,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
      },
      'Radiologist': {
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
        nurseDashboard: false,
        doctorDashboard: false,
        antenatal: false,
        archivedPatients: false,
        archivedPatientsView: true,
        doctorQueue: false,
        queueManagement: false,
        hrDashboard: false,
        hrEmployees: false,
        hrDepartments: false,
        hrLeaves: false,
        hrAttendance: false,
        hrPerformance: false,
        hrTrainings: false,
        radiology: true,
        dental: false,
        optometry: false,
        immunizations: false,
        patientPortal: false,
        portalSetup: false,
        wallet: false,
      },
    };
    return defaults[role] || {};
  };

  // Helper to check if a permission is recommended
  const isRecommended = (role, moduleKey) => {
    const recommended = getRecommendedPermissions(role);
    return recommended[moduleKey] === true;
  };

  // Helper to check if user can manage permissions
  const canManagePermissions = () => {
    return ['Admin', 'ITAdmin'].includes(user?.role);
  };

  // Get unique roles for filter
  const getUniqueRoles = () => {
    const allRoles = new Set();
    permissions.forEach(p => allRoles.add(p.role));
    // Ensure all known roles are included
    const knownRoles = ['Admin', 'ITAdmin', 'ITSupport', 'Doctor', 'Nurse', 'Pharmacist', 
      'Accountant', 'Records', 'LabTechnician', 'LabScientist', 'Receptionist', 'BillingOfficer', 
      'Obstetrician', 'Midwife', 'Radiologist', 'HR'];
    knownRoles.forEach(r => allRoles.add(r));
    return Array.from(allRoles);
  };

  // Filter permissions by search and role
  const filteredPermissions = permissions.filter(p => {
    if (selectedRole !== 'all' && p.role !== selectedRole) return false;
    if (searchTerm) {
      return p.role.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  // Get group label for display
  const getGroupLabel = (group) => {
    const labels = {
      Core: '🔷 Core Modules',
      Clinical: '🩺 Clinical Modules',
      Pharmacy: '💊 Pharmacy Modules',
      Finance: '💰 Finance Modules',
      Records: '📋 Records Modules',
      Admin: '🔐 Admin Modules',
      Queue: '⏳ Queue Management',
      HR: '👔 HR Modules',
      Specialty: '🏥 Specialty Clinics',
      Portal: '🚑 Patient Portal',
    };
    return labels[group] || group;
  };

  if (loading) return <div className="spinner" />;

  if (!canManagePermissions()) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <h2>🔐 Access Denied</h2>
          <p style={{ color: '#ef4444' }}>
            You do not have permission to manage role permissions. Only Administrators can access this page.
          </p>
        </div>
      </div>
    );
  }

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
          <span style={{ fontSize: '12px', color: '#10b981' }}>
            ✅ All modules included
          </span>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{
        background: 'white',
        padding: '16px 20px',
        borderRadius: '12px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center'
      }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <input
            type="text"
            placeholder="🔍 Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px'
            }}
          />
        </div>
        <div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              background: 'white'
            }}
          >
            <option value="all">All Roles</option>
            {getUniqueRoles().map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <button 
          className="btn btn-sm btn-secondary"
          onClick={() => {
            setSearchTerm('');
            setSelectedRole('all');
            fetchPermissions();
          }}
          style={{
            background: '#e5e7eb',
            color: '#1f2937',
            border: '1px solid #d1d5db',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🔄 Reset Filters
        </button>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          Showing {filteredPermissions.length} roles
        </span>
      </div>

      {/* Info Banners */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '20px' }}>🆕</span>
        <span style={{ fontSize: '14px', color: '#1e3a5f' }}>
          <strong>New Module Added:</strong> 💳 Patient Wallet - Manage patient deposits and payments
        </span>
      </div>

      <div style={{
        background: '#f5f3ff',
        border: '1px solid #8b5cf6',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '20px' }}>🔬</span>
        <span style={{ fontSize: '14px', color: '#5b21b6' }}>
          <strong>Lab Scientist Added:</strong> Can view patients, manage lab orders, add results, and <strong>validate</strong> lab results
        </span>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '120px', position: 'sticky', left: 0, background: '#f8fafc' }}>Role</th>
              {modules.map(m => (
                <th key={m.key} style={{ textAlign: 'center', minWidth: '70px', fontSize: '10px', padding: '8px 4px' }}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPermissions.map(p => (
              <tr key={p.role}>
                <td style={{ 
                  position: 'sticky', 
                  left: 0, 
                  background: p.role === 'LabScientist' ? '#f5f3ff' : 'white', 
                  fontWeight: 'bold',
                  borderRight: p.role === 'LabScientist' ? '2px solid #8b5cf6' : 'none'
                }}>
                  {p.role}
                  {p.role === 'LabScientist' && (
                    <span style={{ 
                      fontSize: '10px', 
                      color: '#8b5cf6', 
                      display: 'block',
                      fontWeight: 'normal'
                    }}>
                      🔬 New
                  </span>
                  )}
                </td>
                {modules.map(m => {
                  const isLocked = isPermissionLocked(p.role, m.key);
                  const isRecommendedPerm = isRecommended(p.role, m.key);
                  const isChecked = p[m.key] ?? false;
                  
                  return (
                    <td key={m.key} style={{ 
                      textAlign: 'center',
                      background: p.role === 'LabScientist' && m.key === 'labOrders' ? '#f5f3ff' : 'transparent'
                    }}>
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
                      {p.role === 'LabScientist' && m.key === 'labOrders' && (
                        <span style={{ 
                          fontSize: '8px', 
                          color: '#8b5cf6', 
                          display: 'block',
                          marginTop: '2px'
                        }}>
                          validate
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

      <div style={{ marginTop: '16px', padding: '16px 20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e8ecf1' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}>
          <strong>💡 Tips:</strong>
        </p>
        <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#6b7280' }}>
          <li>For HR to manage staff (create, edit, deactivate), ensure <strong>"Staff Mgmt"</strong> permission is checked for the HR role.</li>
          <li>For Patient Portal access, ensure <strong>"Patient Portal"</strong> and <strong>"Portal Setup"</strong> permissions are configured appropriately.</li>
          <li><strong>Radiology</strong>, <strong>Dental</strong>, <strong>Optometry</strong>, and <strong>Immunizations</strong> are specialty modules with role-based access.</li>
          <li><strong>💳 Patient Wallet</strong> is available to Finance staff (Admin, Accountant, BillingOfficer).</li>
          <li><strong>🔬 Lab Scientist</strong> can view patients, manage lab orders, add results, and <strong>validate</strong> lab results.</li>
        </ul>
      </div>
    </div>
  );
};

export default ManagePermissions;