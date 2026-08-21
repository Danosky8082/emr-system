// src/components/Layout.jsx
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

 const allGroups = {
  Clinical: [
    { path: '/appointments', label: '📅 Appointments' },
    { path: '/prescriptions', label: '💊 Prescriptions' },
    { path: '/lab-orders', label: '🔬 Lab Orders' },
    { path: '/pharmacy', label: '🏥 Pharmacy' },
    { path: '/antenatal', label: '🤰 Antenatal Care' },
    { path: '/pharmacy-dashboard', label: '💊 Pharmacy Dashboard' }, // ✅ NEW
    { path: '/nhis-drugs', label: '🏥 NHIS Drugs' }, // ✅ Moved from separate to Clinical
  ] ,
  Finance: [
    { path: '/billing', label: '💰 Billing' },
    { path: '/billing-officer', label: '💵 Billing Desk' },
    { path: '/pricing', label: '💲 Service Pricing' }, // ✅ Moved from Admin to Finance
  ],
  Admin: [
    { path: '/staff', label: '👨‍⚕️ Staff' },
    { path: '/clinics', label: '🏥 Manage Clinics' },
    { path: '/wards', label: '🛏️ Manage Wards' },
    { path: '/nurse-dashboard', label: '🩺 Nurse Dashboard' },
    { path: '/permissions', label: '🔐 Role Permissions' },
  ],
  Records: [
    { path: '/patient-intake', label: '🔄 Patient Intake' },
    { path: '/admissions', label: '🏥 ADT' },
    { path: '/patient-history', label: '📂 Patient History' },
    { path: '/roi-requests', label: '📄 ROI Requests' },
    { path: '/archived-patients', label: '📦 Archived Patients' },
  ],
  Doctor: [
    { path: '/doctor-dashboard', label: '🩺 Doctor Dashboard' },
    { path: '/appointments', label: '📅 Appointments' },
    { path: '/prescriptions', label: '💊 Prescriptions' },
    { path: '/lab-orders', label: '🔬 Lab Orders' },
  ],
};

  const pathToPermissionKey = {
    '/appointments': 'appointments',
    '/prescriptions': 'prescriptions',
    '/lab-orders': 'labOrders',
    '/pharmacy': 'pharmacy',
    '/billing': 'billing',
    '/billing-officer': 'billingOfficer',
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
    '/archived-patients': 'archivedPatients',
    '/nhis-drugs': 'nhisManagement', 
    '/pharmacy-dashboard': 'pharmacy',
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
    // --- Hard override for Obstetrician / Midwife ---
    if (user?.role === 'Obstetrician' && path === '/nurse-dashboard') return false;
    if (user?.role === 'Midwife' && path === '/doctor-dashboard') return false;
    // ------------------------------------------------

    // ✅ Antenatal: Only specific roles can access
    if (path === '/antenatal') {
      const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Obstetrician', 'Midwife', 'Nurse'];
      return allowedRoles.includes(user?.role) && user?.role !== 'Doctor';
    }

    // ✅ Archived Patients: Use permission system with role-based fallback
    if (path === '/archived-patients') {
      // Admin bypass - always allowed
      if (user?.role === 'Admin') return true;
      
      // Check permission if loaded
      if (!loadingPermissions && permissions) {
        const permissionKey = 'archivedPatients';
        return permissions[permissionKey] === true;
      }
      
      // Fallback: Allow Records and ITAdmin if permissions not loaded yet
      if (loadingPermissions) return false;
      return ['Records', 'ITAdmin'].includes(user?.role);
    }

    if (path === '/') return true;
    if (loadingPermissions) return false;
    if (!permissions) return false;
    if (user?.role === 'Admin') return true;
    const permissionKey = pathToPermissionKey[path];
    if (!permissionKey) return false;
    return permissions[permissionKey] === true;
  };

  // --- Updated redirect logic to support Obstetrician & Midwife ---
  useEffect(() => {
    const hasRedirected = sessionStorage.getItem('hasRedirected');
    if (!hasRedirected) {
      if (['Nurse', 'Midwife'].includes(user?.role) && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/nurse-dashboard');
      } else if (['Doctor', 'Obstetrician'].includes(user?.role) && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/doctor-dashboard');
      }
    }
  }, [user, location.pathname, navigate]);

  const renderNav = () => {
    if (loadingPermissions) {
      return <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Loading menu...</span>;
    }

    return (
      <>
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📊 Dashboard
        </NavLink>

        {canAccess('/nurse-dashboard') && (
          <NavLink to="/nurse-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            🩺 Nurse Dashboard
          </NavLink>
        )}

        {canAccess('/patients') && (
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
        )}

        {Object.entries(allGroups).map(([groupName, items]) => {
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