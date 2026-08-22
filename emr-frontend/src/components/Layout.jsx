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
      { path: '/pharmacy-dashboard', label: '💊 Pharmacy Dashboard' },
      { path: '/nhis-drugs', label: '🏥 NHIS Drugs' },
    ],
    Finance: [
      { path: '/billing', label: '💰 Billing' },
      { path: '/billing-officer', label: '💵 Billing Desk' },
      { path: '/pricing', label: '💲 Service Pricing' },
    ],
    Admin: [
      { path: '/staff', label: '👨‍⚕️ Staff' },
      { path: '/clinics', label: '🏥 Manage Clinics' },
      { path: '/wards', label: '🛏️ Manage Wards' },
      { path: '/permissions', label: '🔐 Role Permissions' },
    ],
    Records: [
      { path: '/patient-intake', label: '🔄 Patient Intake' },
      { path: '/admissions', label: '🏥 ADT' },
      { path: '/patient-history', label: '📂 Patient History' },
      { path: '/roi-requests', label: '📄 ROI Requests' },
      { path: '/archived-patients', label: '📦 Archived Patients' },
      { path: '/queue', label: '🏥 Queue Management' },
    ],
    Doctor: [
      { path: '/doctor-dashboard', label: '👨‍⚕️ My Patients' },
      { path: '/doctor-queue', label: '🏥 My Queue' },
      { path: '/patients', label: '👤 All Patients' },
      { path: '/archived-patients-view', label: '📦 Archived Patients (View)' },
      { path: '/prescriptions', label: '💊 Prescriptions' },
      { path: '/lab-orders', label: '🔬 Lab Orders' },
    ],
    Nurse: [
      { path: '/nurse-dashboard', label: '👩‍⚕️ My Patients' },
      { path: '/queue', label: '🏥 Queue Management' },
      { path: '/patients', label: '👤 All Patients' },
      { path: '/archived-patients-view', label: '📦 Archived Patients (View)' },
      { path: '/antenatal', label: '🤰 Antenatal Care' },
    ],
    Midwife: [
      { path: '/nurse-dashboard', label: '👩‍⚕️ My Patients' },
      { path: '/queue', label: '🏥 Queue Management' },
      { path: '/patients', label: '👤 All Patients' },
      { path: '/archived-patients-view', label: '📦 Archived Patients (View)' },
      { path: '/antenatal', label: '🤰 Antenatal Care' },
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
    '/archived-patients-view': 'archivedPatientsView',
    '/nhis-drugs': 'nhisManagement',
    '/pharmacy-dashboard': 'pharmacyDashboard',
    '/doctor-queue': 'doctorQueue',
    '/queue': 'queueManagement',
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

    // ✅ Doctor Queue: Only Doctors and Obstetricians
    if (path === '/doctor-queue') {
      if (user?.role === 'Admin') return true;
      if (!loadingPermissions && permissions) {
        return permissions['doctorQueue'] === true;
      }
      if (loadingPermissions) return false;
      return ['Doctor', 'Obstetrician'].includes(user?.role);
    }

    // ✅ Queue Management: Admin, Records, Nurse, Midwife
    if (path === '/queue') {
      if (user?.role === 'Admin') return true;
      if (!loadingPermissions && permissions) {
        return permissions['queueManagement'] === true;
      }
      if (loadingPermissions) return false;
      return ['Records', 'Nurse', 'Midwife'].includes(user?.role);
    }

    // ✅ Antenatal: Only specific roles can access
    if (path === '/antenatal') {
      const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Obstetrician', 'Midwife'];
      if (user?.role === 'Nurse') return false;
      return allowedRoles.includes(user?.role);
    }

    // ✅ Archived Patients (Manage): Only Records/Admin/ITAdmin
    if (path === '/archived-patients') {
      if (user?.role === 'Admin') return true;
      if (!loadingPermissions && permissions) {
        return permissions['archivedPatients'] === true;
      }
      if (loadingPermissions) return false;
      return ['Records', 'ITAdmin'].includes(user?.role);
    }

    // ✅ Archived Patients (View Only): Clinical staff and Records can view
    if (path === '/archived-patients-view') {
      if (user?.role === 'Admin') return true;
      if (!loadingPermissions && permissions) {
        return permissions['archivedPatientsView'] === true;
      }
      if (loadingPermissions) return false;
      const allowedRoles = ['Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Records', 'ITAdmin'];
      return allowedRoles.includes(user?.role);
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

  const isGroupVisible = (groupName) => {
    // Admin and ITAdmin see all groups
    if (['Admin', 'ITAdmin'].includes(user?.role)) return true;

    // Doctor group only for Doctors and Obstetricians
    if (groupName === 'Doctor') {
      return ['Doctor', 'Obstetrician'].includes(user?.role);
    }

    // Nurse group only for Nurses and Midwives
    if (groupName === 'Nurse') {
      return ['Nurse', 'Midwife'].includes(user?.role);
    }

    // Records group only for Records, Admin, ITAdmin
    if (groupName === 'Records') {
      return ['Records', 'Admin', 'ITAdmin'].includes(user?.role);
    }

    // Admin group only for Admin, ITAdmin
    if (groupName === 'Admin') {
      return ['Admin', 'ITAdmin'].includes(user?.role);
    }

    // Finance group for Accountant, BillingOfficer, Admin, ITAdmin
    if (groupName === 'Finance') {
      return ['Accountant', 'BillingOfficer', 'Admin', 'ITAdmin'].includes(user?.role);
    }

    // Clinical group for most roles except some
    if (groupName === 'Clinical') {
      const allowedRoles = ['Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Pharmacist', 'Admin', 'ITAdmin', 'Records'];
      return allowedRoles.includes(user?.role);
    }

    return true;
  };

  const renderNav = () => {
    if (loadingPermissions) {
      return <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Loading menu...</span>;
    }

    // ✅ For Doctors and Obstetricians - show both Clinical and Doctor dropdowns
    if (['Doctor', 'Obstetrician'].includes(user?.role)) {
      // Get Doctor paths to exclude duplicates
      const doctorPaths = allGroups.Doctor.map(item => item.path);
      
      // Clinical items EXCLUDING those already in Doctor dropdown
      const clinicalItems = allGroups.Clinical.filter(item => 
        canAccess(item.path) && !doctorPaths.includes(item.path)
      );
      
      // Doctor items
      const doctorItems = allGroups.Doctor.filter(item => canAccess(item.path));
      
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          
          {/* ✅ Clinical Dropdown - Only unique items */}
          {clinicalItems.length > 0 && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-header">Clinical ▼</button>
              <div className="dropdown-content">
                {clinicalItems.map(item => (
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
          )}
          
          {/* ✅ Doctor Dropdown */}
          {doctorItems.length > 0 && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-header">Doctor ▼</button>
              <div className="dropdown-content">
                {doctorItems.map(item => (
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
          )}
        </>
      );
    }

    // ✅ For Midwives - show Midwife dropdown with Antenatal
    if (user?.role === 'Midwife') {
      const midwifeItems = allGroups.Midwife.filter(item => canAccess(item.path));
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          {midwifeItems.length > 0 && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-header">Midwife ▼</button>
              <div className="dropdown-content">
                {midwifeItems.map(item => (
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
          )}
        </>
      );
    }

    // ✅ For Nurses (NOT Midwives) - show Nurse dropdown WITHOUT Antenatal
    if (user?.role === 'Nurse') {
      const nurseItems = allGroups.Nurse.filter(item => canAccess(item.path));
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          {nurseItems.length > 0 && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-header">Nurse ▼</button>
              <div className="dropdown-content">
                {nurseItems.map(item => (
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
          )}
        </>
      );
    }

    // ✅ For Records - show the Records dropdown
    if (user?.role === 'Records') {
      const recordsItems = allGroups.Records.filter(item => canAccess(item.path));
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
          {recordsItems.length > 0 && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-header">Records ▼</button>
              <div className="dropdown-content">
                {recordsItems.map(item => (
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
          )}
        </>
      );
    }

    // ✅ For Admin - show ALL dropdowns
    if (['Admin', 'ITAdmin'].includes(user?.role)) {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
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
    }

    // ✅ For other roles (Pharmacist, Accountant, etc.) - show relevant groups
    return (
      <>
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📊 Dashboard
        </NavLink>
        {canAccess('/patients') && (
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            👤 Patients
          </NavLink>
        )}
        {Object.entries(allGroups).map(([groupName, items]) => {
          // Skip Doctor, Nurse, and Midwife groups for other roles
          if (['Doctor', 'Nurse', 'Midwife'].includes(groupName)) {
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