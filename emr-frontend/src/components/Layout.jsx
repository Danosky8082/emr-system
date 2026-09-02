// src/components/Layout.jsx - COMPLETE WITH ALL SPECIALIST MODULES

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // ✅ ORGANIZED MENU STRUCTURE WITH ALL SPECIALIST MODULES
  const menuStructure = {
    '📊 Dashboard': [
      { path: '/', label: 'Dashboard' }
    ],
    '👤 Patients': [
      { path: '/patients', label: 'All Patients' },
      { path: '/patient-intake', label: 'Patient Intake' },
      { path: '/admissions', label: 'ADT' },
      { path: '/patient-history', label: 'Patient History' },
      { path: '/archived-patients', label: 'Archived Patients' },
      { path: '/archived-patients-view', label: 'Archived (View)' },
    ],
    '🤰 Maternity': [
      { path: '/antenatal', label: 'Antenatal Care' },
      { path: '/labor-delivery', label: '🤱 Labor & Delivery' },
    ],
    '👨‍⚕️ Clinical': [
      { path: '/appointments', label: 'Appointments' },
      { path: '/prescriptions', label: 'Prescriptions' },
      { path: '/lab-orders', label: 'Lab Orders' },
      { path: '/doctor-dashboard', label: 'Doctor Dashboard' },
      { path: '/nurse-dashboard', label: 'Nurse Dashboard' },
      { path: '/doctor-queue', label: 'Doctor Queue' },
      { path: '/queue', label: 'Queue Management' },
    ],
    '💊 Pharmacy': [
      { path: '/pharmacy-patients', label: 'Patient List' },
      { path: '/pharmacy', label: 'Inventory' },
      { path: '/pharmacy-dashboard', label: 'Dashboard' },
      { path: '/nhis-drugs', label: 'NHIS Drugs' },
    ],
    '🔬 Lab': [
      { path: '/lab-patients', label: 'Patient List' },
      { path: '/lab-orders', label: 'Lab Orders' },
    ],
    '📷 Radiology': [
      { path: '/radiology-patients', label: 'Patient List' },
      { path: '/radiology-dashboard', label: 'Radiology Dashboard' },
    ],
    '🦷 Dental': [
      { path: '/dental', label: '🦷 Dental Clinic' },
    ],
    '👁️ Optometry': [
      { path: '/optometry', label: '👁️ Eye Clinic' },
    ],
    '👶 Paediatrics': [
      { path: '/paediatric', label: '👶 Paediatric Patients' },
    ],
    '🏥 Surgery': [
      { path: '/surgery', label: '🏥 Surgery Patients' },
    ],
    '🧠 Psychiatry': [
      { path: '/psychiatry', label: '🧠 Psychiatry Patients' },
    ],
    '💰 Finance': [
      { path: '/billing', label: 'Billing' },
      { path: '/billing-officer', label: 'Billing Desk' },
      { path: '/pricing', label: 'Service Pricing' },
      { path: '/wallet', label: 'Patient Wallet' },
      { path: '/service-config', label: 'Service Fees' },
    ],
    '👔 HR': [
      { path: '/hr/dashboard', label: 'HR Dashboard' },
      { path: '/hr/employees', label: 'Employees' },
      { path: '/hr/departments', label: 'Departments' },
      { path: '/hr/leaves', label: 'Leave Management' },
    ],
    '🔐 Admin': [
      { path: '/staff', label: 'Staff Management' },
      { path: '/clinics', label: 'Manage Clinics' },
      { path: '/wards', label: 'Manage Wards' },
      { path: '/permissions', label: 'Role Permissions' },
      { path: '/audit-logs', label: 'Audit Logs' },
      { path: '/system-status', label: 'System Status' },
    ],
    '🚑 Portal': [
      { path: '/patient-login', label: 'Patient Login' },
      { path: '/kiosk', label: 'Kiosk Mode' },
    ],
  };

  const pathToPermissionKey = {
    '/appointments': 'appointments',
    '/prescriptions': 'prescriptions',
    '/lab-orders': 'labOrders',
    '/pharmacy': 'pharmacy',
    '/billing': 'billing',
    '/billing-officer': 'billingOfficer',
    '/wallet': 'wallet',
    '/staff': 'staff',
    '/clinics': 'clinics',
    '/wards': 'wards',
    '/pricing': 'pricing',
    '/nurse-dashboard': 'nurseDashboard',
    '/doctor-dashboard': 'doctorDashboard',
    '/patient-intake': 'patientIntake',
    '/admissions': 'admissions',
    '/patient-history': 'patientHistory',
    '/roi-requests': 'roiRequests',
    '/patients': 'patients',
    '/antenatal': 'antenatal',
    '/labor-delivery': 'laborAndDelivery',
    '/archived-patients': 'archivedPatients',
    '/archived-patients-view': 'archivedPatientsView',
    '/nhis-drugs': 'nhisManagement',
    '/pharmacy-dashboard': 'pharmacyDashboard',
    '/doctor-queue': 'doctorQueue',
    '/queue': 'queueManagement',
    '/radiology-dashboard': 'radiology',
    '/pharmacy-patients': 'pharmacy',
    '/lab-patients': 'labOrders',
    '/radiology-patients': 'radiology',
    '/dental': 'dental',
    '/optometry': 'optometry',
    '/paediatric': 'paediatrics',
    '/surgery': 'surgery',
    '/psychiatry': 'psychiatry',
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) return;
      setLoadingPermissions(true);
      try {
        const token = localStorage.getItem('emr_token');
        const res = await axios.get('http://localhost:3000/api/permissions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const rolePerm = res.data.find(p => p.role === user.role);
        if (rolePerm) {
          setPermissions(rolePerm);
        } else {
          setPermissions(null);
        }
      } catch (error) {
        console.error('Failed to load permissions', error);
        setPermissions(null);
      } finally {
        setLoadingPermissions(false);
      }
    };
    fetchPermissions();
  }, [user]);

  const canAccess = (path) => {
    // Admin can access everything
    if (['Admin', 'ITAdmin'].includes(user?.role)) return true;

    // HR can only access HR routes
    if (user?.role === 'HR') {
      const hrPaths = ['/hr/dashboard', '/hr/employees', '/hr/departments', '/hr/leaves'];
      if (hrPaths.includes(path)) return true;
      return false;
    }

    // ============================================================
    // SPECIALIST MODULE ACCESS
    // ============================================================

    // Paediatrics - Paediatrician only
    if (path === '/paediatric') {
      if (user?.role === 'Paediatrician') return true;
      if (!loadingPermissions && permissions) {
        return permissions['paediatrics'] === true;
      }
      return false;
    }

    // Surgery - Surgeon only
    if (path === '/surgery') {
      if (user?.role === 'Surgeon') return true;
      if (!loadingPermissions && permissions) {
        return permissions['surgery'] === true;
      }
      return false;
    }

    // Psychiatry - Psychiatrist only
    if (path === '/psychiatry') {
      if (user?.role === 'Psychiatrist') return true;
      if (!loadingPermissions && permissions) {
        return permissions['psychiatry'] === true;
      }
      return false;
    }

    // Dental - Dentist only
    if (path === '/dental') {
      if (user?.role === 'Dentist') return true;
      if (!loadingPermissions && permissions) {
        return permissions['dental'] === true;
      }
      return false;
    }

    // Optometry - Optometrist only
    if (path === '/optometry') {
      if (user?.role === 'Optometrist') return true;
      if (!loadingPermissions && permissions) {
        return permissions['optometry'] === true;
      }
      return false;
    }

    // Labor & Delivery - Obstetricians, Midwives, Doctors, Nurses
    if (path === '/labor-delivery') {
      if (['Obstetrician', 'Midwife', 'Doctor', 'Nurse'].includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['laborAndDelivery'] === true;
      }
      return false;
    }

    // Antenatal - Specific roles
    if (path === '/antenatal') {
      const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Obstetrician', 'Midwife'];
      if (allowedRoles.includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['antenatal'] === true;
      }
      return false;
    }

    // Wallet - Finance roles only
    if (path === '/wallet') {
      if (['Accountant', 'BillingOfficer'].includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['wallet'] === true;
      }
      return false;
    }

    // Pharmacy - Pharmacist only
    if (path === '/pharmacy' || path === '/pharmacy-dashboard' || path === '/pharmacy-patients' || path === '/nhis-drugs') {
      if (user?.role === 'Pharmacist') return true;
      if (!loadingPermissions && permissions) {
        return permissions['pharmacy'] === true || permissions['pharmacyDashboard'] === true;
      }
      return false;
    }

    // Lab - Lab staff only
    if (path === '/lab-orders' || path === '/lab-patients') {
      if (['LabTechnician', 'LabScientist'].includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['labOrders'] === true;
      }
      return false;
    }

    // Radiology - Radiologist only
    if (path === '/radiology-dashboard' || path === '/radiology-patients') {
      if (user?.role === 'Radiologist') return true;
      if (!loadingPermissions && permissions) {
        return permissions['radiology'] === true;
      }
      return false;
    }

    // Doctor Queue - Doctors and Obstetricians
    if (path === '/doctor-queue') {
      if (['Doctor', 'Obstetrician'].includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['doctorQueue'] === true;
      }
      return false;
    }

    // Queue Management - Admin, Records, Nurse, Midwife
    if (path === '/queue') {
      if (['Records', 'Nurse', 'Midwife'].includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['queueManagement'] === true;
      }
      return false;
    }

    // Archived Patients (Manage)
    if (path === '/archived-patients') {
      if (['Records'].includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['archivedPatients'] === true;
      }
      return false;
    }

    // Archived Patients (View Only)
    if (path === '/archived-patients-view') {
      const allowedRoles = ['Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Records'];
      if (allowedRoles.includes(user?.role)) return true;
      if (!loadingPermissions && permissions) {
        return permissions['archivedPatientsView'] === true;
      }
      return false;
    }

    if (path === '/') return true;
    if (loadingPermissions) return false;
    if (!permissions) return false;

    const permissionKey = pathToPermissionKey[path];
    if (!permissionKey) return false;
    return permissions[permissionKey] === true;
  };

  // Redirect logic
  useEffect(() => {
    const hasRedirected = sessionStorage.getItem('hasRedirected');
    if (!hasRedirected && user) {
      if (['Nurse', 'Midwife'].includes(user?.role) && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/nurse-dashboard');
      } else if (['Doctor', 'Obstetrician'].includes(user?.role) && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/doctor-dashboard');
      } else if (user?.role === 'HR' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/hr/dashboard');
      } else if (user?.role === 'Pharmacist' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/pharmacy-dashboard');
      } else if (user?.role === 'Radiologist' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/radiology-dashboard');
      } else if (user?.role === 'Dentist' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/dental');
      } else if (user?.role === 'Optometrist' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/optometry');
      } else if (user?.role === 'Paediatrician' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/paediatric');
      } else if (user?.role === 'Surgeon' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/surgery');
      } else if (user?.role === 'Psychiatrist' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/psychiatry');
      }
    }
  }, [user, location.pathname, navigate]);

  // ============================================================
  // RENDER NAVIGATION - ORGANIZED DROPDOWNS
  // ============================================================
  
  const renderNav = () => {
    if (loadingPermissions) {
      return <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Loading menu...</span>;
    }

    // ============================================================
    // PAEDIATRICIAN NAVIGATION
    // ============================================================
    if (user?.role === 'Paediatrician') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#f472b6', fontWeight: 'bold' }}>
              👶 Paediatrics ▼
            </button>
            <div className="dropdown-content">
              <NavLink to="/paediatric" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                👶 Paediatric Patients
              </NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                📅 Appointments
              </NavLink>
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👨‍⚕️ Clinical ▼</button>
            <div className="dropdown-content">
              <NavLink to="/prescriptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💊 Prescriptions</NavLink>
              <NavLink to="/lab-orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔬 Lab Orders</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📦 Archived (View)
          </NavLink>
        </>
      );
    }

    // ============================================================
    // SURGEON NAVIGATION
    // ============================================================
    if (user?.role === 'Surgeon') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#dc2626', fontWeight: 'bold' }}>
              🏥 Surgery ▼
            </button>
            <div className="dropdown-content">
              <NavLink to="/surgery" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                🏥 Surgery Patients
              </NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                📅 Appointments
              </NavLink>
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👨‍⚕️ Clinical ▼</button>
            <div className="dropdown-content">
              <NavLink to="/prescriptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💊 Prescriptions</NavLink>
              <NavLink to="/lab-orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔬 Lab Orders</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📦 Archived (View)
          </NavLink>
        </>
      );
    }

    // ============================================================
    // PSYCHIATRIST NAVIGATION
    // ============================================================
    if (user?.role === 'Psychiatrist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#7c3aed', fontWeight: 'bold' }}>
              🧠 Psychiatry ▼
            </button>
            <div className="dropdown-content">
              <NavLink to="/psychiatry" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                🧠 Psychiatry Patients
              </NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                📅 Appointments
              </NavLink>
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👨‍⚕️ Clinical ▼</button>
            <div className="dropdown-content">
              <NavLink to="/prescriptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💊 Prescriptions</NavLink>
              <NavLink to="/lab-orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔬 Lab Orders</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📦 Archived (View)
          </NavLink>
        </>
      );
    }

    // ============================================================
    // DENTIST NAVIGATION
    // ============================================================
    if (user?.role === 'Dentist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#0f3460', fontWeight: 'bold' }}>
              🦷 Dental ▼
            </button>
            <div className="dropdown-content">
              <NavLink to="/dental" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                🦷 Dental Clinic
              </NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                📅 Appointments
              </NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📦 Archived (View)
          </NavLink>
        </>
      );
    }

    // ============================================================
    // OPTOMETRIST NAVIGATION
    // ============================================================
    if (user?.role === 'Optometrist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#06b6d4', fontWeight: 'bold' }}>
              👁️ Optometry ▼
            </button>
            <div className="dropdown-content">
              <NavLink to="/optometry" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                👁️ Eye Clinic
              </NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                📅 Appointments
              </NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📦 Archived (View)
          </NavLink>
        </>
      );
    }

    // ============================================================
    // OBSTETRICIAN NAVIGATION
    // ============================================================
    if (user?.role === 'Obstetrician') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#dc2626', fontWeight: 'bold' }}>
              🤱 Maternity ▼
            </button>
            <div className="dropdown-content">
              <NavLink to="/antenatal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                🤰 Antenatal Care
              </NavLink>
              <NavLink to="/labor-delivery" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ 
                color: '#dc2626', 
                fontWeight: 'bold',
                background: location.pathname === '/labor-delivery' ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                borderRadius: '4px'
              }}>
                🤱 Labor & Delivery <span style={{ fontSize: '9px', background: '#dc2626', color: 'white', padding: '1px 8px', borderRadius: '10px', marginLeft: '4px' }}>PRIMARY</span>
              </NavLink>
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👨‍⚕️ Clinical ▼</button>
            <div className="dropdown-content">
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
              <NavLink to="/prescriptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💊 Prescriptions</NavLink>
              <NavLink to="/lab-orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔬 Lab Orders</NavLink>
              <NavLink to="/doctor-queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 My Queue</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📦 Archived (View)
          </NavLink>
        </>
      );
    }

    // ============================================================
    // MIDWIFE NAVIGATION
    // ============================================================
    if (user?.role === 'Midwife') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/nurse-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👩‍⚕️ My Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#dc2626', fontWeight: 'bold' }}>
              🤱 Maternity ▼
            </button>
            <div className="dropdown-content">
              <NavLink to="/antenatal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                🤰 Antenatal Care
              </NavLink>
              <NavLink to="/labor-delivery" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ 
                color: '#dc2626', 
                fontWeight: 'bold',
                background: location.pathname === '/labor-delivery' ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                borderRadius: '4px'
              }}>
                🤱 Labor & Delivery <span style={{ fontSize: '9px', background: '#dc2626', color: 'white', padding: '1px 8px', borderRadius: '10px', marginLeft: '4px' }}>PRIMARY</span>
              </NavLink>
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">📋 Records ▼</button>
            <div className="dropdown-content">
              <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 All Patients</NavLink>
              <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 Queue</NavLink>
              <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
            </div>
          </div>
        </>
      );
    }

    // ============================================================
    // DOCTOR NAVIGATION
    // ============================================================
    if (user?.role === 'Doctor') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">🤱 Maternity ▼</button>
            <div className="dropdown-content">
              <NavLink to="/antenatal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🤰 Antenatal Care</NavLink>
              <NavLink to="/labor-delivery" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🤱 Labor & Delivery</NavLink>
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👨‍⚕️ Clinical ▼</button>
            <div className="dropdown-content">
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
              <NavLink to="/prescriptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💊 Prescriptions</NavLink>
              <NavLink to="/lab-orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔬 Lab Orders</NavLink>
              <NavLink to="/doctor-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👨‍⚕️ My Patients</NavLink>
              <NavLink to="/doctor-queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 My Queue</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📦 Archived (View)
          </NavLink>
        </>
      );
    }

    // ============================================================
    // NURSE NAVIGATION
    // ============================================================
    if (user?.role === 'Nurse') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/nurse-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👩‍⚕️ My Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">🤱 Maternity ▼</button>
            <div className="dropdown-content">
              <NavLink to="/antenatal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🤰 Antenatal Care</NavLink>
              <NavLink to="/labor-delivery" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🤱 Labor & Delivery</NavLink>
            </div>
          </div>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">📋 Records ▼</button>
            <div className="dropdown-content">
              <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 All Patients</NavLink>
              <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 Queue</NavLink>
              <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
            </div>
          </div>
        </>
      );
    }

    // ============================================================
    // PHARMACIST NAVIGATION
    // ============================================================
    if (user?.role === 'Pharmacist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">💊 Pharmacy ▼</button>
            <div className="dropdown-content">
              <NavLink to="/pharmacy-patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patient List</NavLink>
              <NavLink to="/pharmacy" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💊 Inventory</NavLink>
              <NavLink to="/pharmacy-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
              <NavLink to="/nhis-drugs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 NHIS Drugs</NavLink>
            </div>
          </div>
        </>
      );
    }

    // ============================================================
    // LAB TECHNICIAN / LAB SCIENTIST NAVIGATION
    // ============================================================
    if (['LabTechnician', 'LabScientist'].includes(user?.role)) {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">🔬 Laboratory ▼</button>
            <div className="dropdown-content">
              <NavLink to="/lab-patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patient List</NavLink>
              <NavLink to="/lab-orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔬 Lab Orders</NavLink>
            </div>
          </div>
        </>
      );
    }

    // ============================================================
    // RADIOLOGIST NAVIGATION
    // ============================================================
    if (user?.role === 'Radiologist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">📷 Radiology ▼</button>
            <div className="dropdown-content">
              <NavLink to="/radiology-patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patient List</NavLink>
              <NavLink to="/radiology-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📷 Dashboard</NavLink>
            </div>
          </div>
        </>
      );
    }

    // ============================================================
    // HR NAVIGATION
    // ============================================================
    if (user?.role === 'HR') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👔 HR ▼</button>
            <div className="dropdown-content">
              <NavLink to="/hr/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 HR Dashboard</NavLink>
              <NavLink to="/hr/employees" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Employees</NavLink>
              <NavLink to="/hr/departments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏢 Departments</NavLink>
              <NavLink to="/hr/leaves" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📋 Leave Management</NavLink>
            </div>
          </div>
        </>
      );
    }

    // ============================================================
    // RECORDS NAVIGATION
    // ============================================================
    if (user?.role === 'Records') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">📋 Records ▼</button>
            <div className="dropdown-content">
              <NavLink to="/patient-intake" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔄 Patient Intake</NavLink>
              <NavLink to="/admissions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 ADT</NavLink>
              <NavLink to="/patient-history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📂 Patient History</NavLink>
              <NavLink to="/roi-requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📄 ROI Requests</NavLink>
              <NavLink to="/archived-patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived Patients</NavLink>
              <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 Queue Management</NavLink>
            </div>
          </div>
          <NavLink to="/patient-login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ color: '#60a5fa' }}>
            🚑 Patient Portal
          </NavLink>
        </>
      );
    }

    // ============================================================
    // ADMIN AND ITADMIN - Full menu with all dropdowns
    // ============================================================
    if (['Admin', 'ITAdmin'].includes(user?.role)) {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          
          {Object.entries(menuStructure).map(([groupName, items]) => {
            const visibleItems = items.filter(item => canAccess(item.path));
            if (visibleItems.length === 0) return null;
            
            // Dashboard is a direct link, not a dropdown
            if (groupName === '📊 Dashboard') {
              return null;
            }
            
            // Patient Portal is a dropdown
            if (groupName === '🚑 Portal') {
              return (
                <div key={groupName} className="nav-dropdown">
                  <button className="nav-dropdown-header" style={{ color: '#60a5fa' }}>🚑 Portal ▼</button>
                  <div className="dropdown-content">
                    {visibleItems.map(item => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }
            
            return (
              <div key={groupName} className="nav-dropdown">
                <button className="nav-dropdown-header">{groupName} ▼</button>
                <div className="dropdown-content">
                  {visibleItems.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      );
    }

    // ============================================================
    // OTHER ROLES (Accountant, BillingOfficer, etc.)
    // ============================================================
    return (
      <>
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📊 Dashboard
        </NavLink>
        
        {Object.entries(menuStructure).map(([groupName, items]) => {
          // Skip role-specific groups that don't apply
          if (groupName === '👨‍⚕️ Clinical' && !['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(user?.role)) {
            return null;
          }
          if (groupName === '🤰 Maternity' && !['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(user?.role)) {
            return null;
          }
          if (groupName === '💊 Pharmacy' && user?.role !== 'Pharmacist') {
            return null;
          }
          if (groupName === '🔬 Lab' && !['LabTechnician', 'LabScientist'].includes(user?.role)) {
            return null;
          }
          if (groupName === '📷 Radiology' && user?.role !== 'Radiologist') {
            return null;
          }
          if (groupName === '🦷 Dental' && user?.role !== 'Dentist') {
            return null;
          }
          if (groupName === '👁️ Optometry' && user?.role !== 'Optometrist') {
            return null;
          }
          if (groupName === '👶 Paediatrics' && user?.role !== 'Paediatrician') {
            return null;
          }
          if (groupName === '🏥 Surgery' && user?.role !== 'Surgeon') {
            return null;
          }
          if (groupName === '🧠 Psychiatry' && user?.role !== 'Psychiatrist') {
            return null;
          }
          if (groupName === '👔 HR' && user?.role !== 'HR') {
            return null;
          }
          if (groupName === '🚑 Portal') {
            return null;
          }
          if (groupName === '🔐 Admin' && !['Admin', 'ITAdmin'].includes(user?.role)) {
            return null;
          }
          if (groupName === '📊 Dashboard') {
            return null;
          }
          
          const visibleItems = items.filter(item => canAccess(item.path));
          if (visibleItems.length === 0) return null;
          
          return (
            <div key={groupName} className="nav-dropdown">
              <button className="nav-dropdown-header">{groupName} ▼</button>
              <div className="dropdown-content">
                {visibleItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout app-container">
      <nav className="navbar">
        <div className="nav-brand">
          <svg className="unique-logo" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#4facfe" />
              </linearGradient>
            </defs>
            <path d="M50 8 L85 28 L85 72 L50 92 L15 72 L15 28 Z" fill="none" stroke="url(#glow)" strokeWidth="5" strokeLinejoin="round"/>
            <path d="M 25 45 Q 45 30 50 50 Q 55 70 75 55" fill="none" stroke="#fff" strokeWidth="3" opacity="0.8"/>
            <path d="M 25 55 Q 45 70 50 50 Q 55 30 75 45" fill="none" stroke="#fff" strokeWidth="3" opacity="0.6"/>
            <rect x="45" y="40" width="10" height="20" rx="2" fill="#00f2fe" />
            <rect x="40" y="45" width="20" height="10" rx="2" fill="#00f2fe" />
          </svg>
          <span>NexGen EMR</span>
        </div>

        <div className="nav-menu">{renderNav()}</div>

        <div className="nav-search">
          <input
            type="text"
            placeholder="🔍 Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="nav-user">
          <span>{user?.firstName} {user?.lastName}</span>
          <span className="role-badge">{user?.role}</span>
          <button onClick={handleLogout} className="btn btn-danger btn-sm">Logout</button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet context={{ searchTerm }} />
      </main>
    </div>
  );
};

export default Layout;
export const useSearch = () => useOutletContext();