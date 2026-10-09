// src/components/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import api from '../api/client';
import MobileMenu from './MobileMenu';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const { clearTenant, hospitalName, hospitalLogo, primaryColor } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(
  typeof window !== 'undefined' ? window.innerWidth < 1400 : false
);

  // ============================================================
  // MENU STRUCTURE — drives both desktop nav and mobile menu
  // ============================================================
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
      { path: '/ledger', label: '📒 Ledger' },
      { path: '/analytics', label: '📊 Analytics' },
      { path: '/staff-activity', label: '👥 Staff Activity' }, 
    ],
    '👔 HR': [
      { path: '/hr/dashboard', label: 'HR Dashboard' },
      { path: '/hr/employees', label: 'Employees' },
      { path: '/hr/departments', label: 'Departments' },
      { path: '/hr/leaves', label: 'Leave Management' },
      { path: '/staff-activity', label: '👥 Staff Activity' }, 
    ],
    '🔐 Admin': [
      { path: '/staff', label: 'Staff Management' },
      { path: '/clinics', label: 'Manage Clinics' },
      { path: '/wards', label: 'Manage Wards' },
      { path: '/permissions', label: 'Role Permissions' },
      { path: '/capabilities', label: 'Capabilities' },
      { path: '/audit-logs', label: 'Audit Logs' },
      { path: '/system-status', label: 'System Status' },
      { path: '/ledger', label: '📒 Ledger' },
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
    '/ledger': 'ledger',
    '/analytics': 'analytics',
    '/staff-activity': 'staffActivity',
    '/permissions': 'staff',
    '/capabilities': 'staff',
  };

  // ============================================================
  // FETCH PERMISSIONS
  // ============================================================
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) return;
      setLoadingPermissions(true);
      try {
        const res = await api.get('/permissions');
        const rolePerm = res.data.find(p => p.role === user.role);
        setPermissions(rolePerm || null);
      } catch (error) {
        console.error('Failed to load permissions', error);
        setPermissions(null);
      } finally {
        setLoadingPermissions(false);
      }
    };
    fetchPermissions();
  }, [user]);

  // ============================================================
  // VIEWPORT TRACKING — swap between desktop nav and mobile menu
  // Breakpoint at 1300px so medium laptops get the sidebar
  // ============================================================
  useEffect(() => {
    const handleResize = () => {
  const mobile = window.innerWidth < 1400;
  setIsMobileView(mobile);
  if (!mobile) setMobileMenuOpen(false);
};
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ============================================================
  // LOGOUT EVENT — fired by MobileMenu
  // ============================================================
  useEffect(() => {
    const handleLogoutEvent = () => {
      handleLogout();
    };
    window.addEventListener('app:logout', handleLogoutEvent);
    return () => window.removeEventListener('app:logout', handleLogoutEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // PERMISSION CHECK
  // ============================================================
    const canAccess = (path) => {
    if (['Admin', 'ITAdmin'].includes(user?.role)) return true;

    // Analytics is available to Pharmacist and Accountant regardless of the
    // DB permission flag — they are the two roles that need it most and
    // we don't want a missing DB row to hide the link.
        if (path === '/analytics') {
      if (['Admin', 'ITAdmin', 'Pharmacist', 'Accountant'].includes(user?.role)) return true;
      return permissions?.['analytics'] === true;
    }

    if (path === '/staff-activity') {
      if (['Admin', 'ITAdmin', 'HR', 'Accountant'].includes(user?.role)) return true;
      return permissions?.['staffActivity'] === true;
    }

    if (user?.role === 'HR') {
      const hrPaths = ['/hr/dashboard', '/hr/employees', '/hr/departments', '/hr/leaves'];
      return hrPaths.includes(path);
    }

    if (path === '/paediatric') {
      if (user?.role === 'Paediatrician') return true;
      return permissions?.['paediatrics'] === true;
    }

    if (path === '/surgery') {
      if (user?.role === 'Surgeon') return true;
      return permissions?.['surgery'] === true;
    }

    if (path === '/psychiatry') {
      if (user?.role === 'Psychiatrist') return true;
      return permissions?.['psychiatry'] === true;
    }

    if (path === '/dental') {
      if (user?.role === 'Dentist') return true;
      return permissions?.['dental'] === true;
    }

    if (path === '/optometry') {
      if (user?.role === 'Optometrist') return true;
      return permissions?.['optometry'] === true;
    }

    if (path === '/labor-delivery') {
      if (['Obstetrician', 'Midwife', 'Doctor', 'Nurse'].includes(user?.role)) return true;
      return permissions?.['laborAndDelivery'] === true;
    }

    if (path === '/antenatal') {
      const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Obstetrician', 'Midwife'];
      if (allowedRoles.includes(user?.role)) return true;
      return permissions?.['antenatal'] === true;
    }

    if (path === '/wallet') {
      if (['Accountant', 'BillingOfficer'].includes(user?.role)) return true;
      return permissions?.['wallet'] === true;
    }

    if (['/pharmacy', '/pharmacy-dashboard', '/pharmacy-patients', '/nhis-drugs'].includes(path)) {
      if (user?.role === 'Pharmacist') return true;
      return permissions?.['pharmacy'] === true || permissions?.['pharmacyDashboard'] === true;
    }

    if (['/lab-orders', '/lab-patients'].includes(path)) {
      if (['LabTechnician', 'LabScientist'].includes(user?.role)) return true;
      return permissions?.['labOrders'] === true;
    }

    if (['/radiology-dashboard', '/radiology-patients'].includes(path)) {
      if (user?.role === 'Radiologist') return true;
      return permissions?.['radiology'] === true;
    }

    if (path === '/doctor-queue') {
      if (['Doctor', 'Obstetrician'].includes(user?.role)) return true;
      return permissions?.['doctorQueue'] === true;
    }

    if (path === '/queue') {
      if (['Records', 'Nurse', 'Midwife'].includes(user?.role)) return true;
      return permissions?.['queueManagement'] === true;
    }

    if (path === '/archived-patients') {
      if (['Records'].includes(user?.role)) return true;
      return permissions?.['archivedPatients'] === true;
    }

    if (path === '/archived-patients-view') {
      const allowedRoles = ['Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Records'];
      if (allowedRoles.includes(user?.role)) return true;
      return permissions?.['archivedPatientsView'] === true;
    }

    if (path === '/') return true;
    if (loadingPermissions) return false;
    if (!permissions) return false;

    const permissionKey = pathToPermissionKey[path];
    if (!permissionKey) return false;
    return permissions[permissionKey] === true;
  };

  // ============================================================
  // ROLE-BASED REDIRECTS
  // ============================================================
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
      } else if (user?.role === 'Receptionist' && location.pathname === '/') {
        sessionStorage.setItem('hasRedirected', 'true');
        navigate('/patients');
      }
    }
  }, [user, location.pathname, navigate]);

  // ============================================================
  // HELPER: Render a set of menu items as NavLinks
  // ============================================================
  const renderDropdownItems = (items) => {
    return items
      .filter((item) => canAccess(item.path))
      .map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          {item.label}
        </NavLink>
      ));
  };

  // ============================================================
  // RENDER NAV — desktop only (mobile uses MobileMenu)
  //
  // Consolidated to 6 top-level items so the navbar never overflows:
  //   Dashboard | Patients | Clinical | Pharmacy | Finance | More
  // ============================================================
  const renderNav = () => {
    if (loadingPermissions) {
      return <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Loading menu...</span>;
    }

    // SuperAdmin — simple
    if (user?.role === 'SuperAdmin') {
      return (
        <>
          <NavLink to="/super-admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            🔐 Platform Dashboard
          </NavLink>
          <button
            onClick={() => navigate('/register-hospital')}
            className="nav-link"
            style={{
              background: 'rgba(96, 165, 250, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              borderRadius: '6px',
              padding: '8px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              fontFamily: 'inherit',
            }}
          >
            ➕ Register Hospital
          </button>
        </>
      );
    }

    // Admin / ITAdmin — CONSOLIDATED 6-item nav
    if (['Admin', 'ITAdmin'].includes(user?.role)) {
      // Groups that go into "More ▼"
      const moreGroups = [
        { key: '🔬 Lab', title: '🔬 Laboratory' },
        { key: '📷 Radiology', title: '📷 Radiology' },
        { key: '🦷 Dental', title: '🦷 Dental' },
        { key: '👁️ Optometry', title: '👁️ Optometry' },
        { key: '👶 Paediatrics', title: '👶 Paediatrics' },
        { key: '🏥 Surgery', title: '🏥 Surgery' },
        { key: '🧠 Psychiatry', title: '🧠 Psychiatry' },
        { key: '👔 HR', title: '👔 HR' },
        { key: '🔐 Admin', title: '🔐 Admin' },
        { key: '🚑 Portal', title: '🚑 Portal' },
      ];

      return (
        <>
          {/* Dashboard — direct link */}
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>

          {/* Patients */}
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👤 Patients ▼</button>
            <div className="dropdown-content">
              {renderDropdownItems(menuStructure['👤 Patients'])}
            </div>
          </div>

          {/* Clinical — includes Maternity */}
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👨‍⚕️ Clinical ▼</button>
            <div className="dropdown-content">
              {renderDropdownItems(menuStructure['👨‍⚕️ Clinical'])}
              <div className="dropdown-divider" />
              <div className="dropdown-section-title">Maternity</div>
              {renderDropdownItems(menuStructure['🤰 Maternity'])}
            </div>
          </div>

          {/* Pharmacy */}
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">💊 Pharmacy ▼</button>
            <div className="dropdown-content">
              {renderDropdownItems(menuStructure['💊 Pharmacy'])}
            </div>
          </div>

          {/* Finance */}
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">💰 Finance ▼</button>
            <div className="dropdown-content">
              {renderDropdownItems(menuStructure['💰 Finance'])}
            </div>
          </div>

          {/* More — everything else */}
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">⋯ More ▼</button>
            <div className="dropdown-content dropdown-content-tall">
              {moreGroups.map((group, idx) => {
                const items = (menuStructure[group.key] || []).filter((i) => canAccess(i.path));
                if (items.length === 0) return null;
                return (
                  <div key={group.key}>
                    {idx > 0 && <div className="dropdown-divider" />}
                    <div className="dropdown-section-title">{group.title}</div>
                    {items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    // All other roles — keep existing per-role navs but they're short enough
    // to fit on one line
    if (user?.role === 'Paediatrician') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#f472b6', fontWeight: 'bold' }}>👶 Paediatrics ▼</button>
            <div className="dropdown-content">
              <NavLink to="/paediatric" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👶 Paediatric Patients</NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
        </>
      );
    }

    if (user?.role === 'Surgeon') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#dc2626', fontWeight: 'bold' }}>🏥 Surgery ▼</button>
            <div className="dropdown-content">
              <NavLink to="/surgery" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 Surgery Patients</NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
        </>
      );
    }

    if (user?.role === 'Psychiatrist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#7c3aed', fontWeight: 'bold' }}>🧠 Psychiatry ▼</button>
            <div className="dropdown-content">
              <NavLink to="/psychiatry" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🧠 Psychiatry Patients</NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
        </>
      );
    }

    if (user?.role === 'Dentist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#0f3460', fontWeight: 'bold' }}>🦷 Dental ▼</button>
            <div className="dropdown-content">
              <NavLink to="/dental" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🦷 Dental Clinic</NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
        </>
      );
    }

    if (user?.role === 'Optometrist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#06b6d4', fontWeight: 'bold' }}>👁️ Optometry ▼</button>
            <div className="dropdown-content">
              <NavLink to="/optometry" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👁️ Eye Clinic</NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
        </>
      );
    }

    if (user?.role === 'Obstetrician') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#dc2626', fontWeight: 'bold' }}>🤱 Maternity ▼</button>
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
              <NavLink to="/doctor-queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 My Queue</NavLink>
            </div>
          </div>
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
        </>
      );
    }

    if (user?.role === 'Midwife') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/nurse-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👩‍⚕️ My Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header" style={{ color: '#dc2626', fontWeight: 'bold' }}>🤱 Maternity ▼</button>
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

    if (user?.role === 'Doctor') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
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
          <NavLink to="/archived-patients-view" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📦 Archived (View)</NavLink>
        </>
      );
    }

    if (user?.role === 'Nurse') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/nurse-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👩‍⚕️ My Patients</NavLink>
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

    if (user?.role === 'Receptionist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">📋 Records ▼</button>
            <div className="dropdown-content">
              <NavLink to="/patient-intake" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🔄 Patient Intake</NavLink>
              <NavLink to="/appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📅 Appointments</NavLink>
              <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 Queue</NavLink>
            </div>
          </div>
        </>
      );
    }

        if (user?.role === 'Pharmacist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">💊 Pharmacy ▼</button>
            <div className="dropdown-content">
              <NavLink to="/pharmacy-patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patient List</NavLink>
              <NavLink to="/pharmacy" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💊 Inventory</NavLink>
              <NavLink to="/pharmacy-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
              <NavLink to="/nhis-drugs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏥 NHIS Drugs</NavLink>
              <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Analytics</NavLink>
            </div>
          </div>
        </>
      );
    }

    if (['LabTechnician', 'LabScientist'].includes(user?.role)) {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
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

    if (user?.role === 'Radiologist') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
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

    if (user?.role === 'HR') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">👔 HR ▼</button>
            <div className="dropdown-content">
              <NavLink to="/hr/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 HR Dashboard</NavLink>
              <NavLink to="/hr/employees" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Employees</NavLink>
              <NavLink to="/hr/departments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏢 Departments</NavLink>
                            <NavLink to="/hr/leaves" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📋 Leave Management</NavLink>
              <NavLink to="/staff-activity" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👥 Staff Activity</NavLink>
            </div>
          </div>
        </>
      );
    }

    if (user?.role === 'Records') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👤 Patients</NavLink>
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
          <NavLink to="/patient-login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ color: '#60a5fa' }}>🚑 Patient Portal</NavLink>
        </>
      );
    }

        if (user?.role === 'Accountant') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">💰 Finance ▼</button>
            <div className="dropdown-content">
              <NavLink to="/billing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💰 Billing</NavLink>
              <NavLink to="/pricing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💲 Service Pricing</NavLink>
              <NavLink to="/wallet" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💳 Patient Wallet</NavLink>
              <NavLink to="/billing-officer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💳 Billing Desk</NavLink>
              <NavLink to="/ledger" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📒 Ledger</NavLink>
                            <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Analytics</NavLink>
              <NavLink to="/staff-activity" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>👥 Staff Activity</NavLink>
            </div>
          </div>
        </>
      );
    }

    if (user?.role === 'BillingOfficer') {
      return (
        <>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-header">💰 Finance ▼</button>
            <div className="dropdown-content">
              <NavLink to="/billing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💰 Billing</NavLink>
              <NavLink to="/billing-officer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💳 Billing Desk</NavLink>
               <NavLink to="/wallet" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>💳 Patient Wallet</NavLink>
              <NavLink to="/ledger" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📒 Ledger</NavLink>
              <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Analytics</NavLink>
            </div>
          </div>
        </>
      );
    }

    // Fallback
    return (
      <>
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📊 Dashboard</NavLink>
      </>
    );
  };

  const handleLogout = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('emr_token');
        localStorage.removeItem('emr_user');
        localStorage.removeItem('emr_tenant_id');
        localStorage.removeItem('emr_hospital');
        localStorage.removeItem('emr_hospital_settings');
        localStorage.removeItem('platform_token');
        localStorage.removeItem('platform_user');
        localStorage.removeItem('patient_token');
        localStorage.removeItem('patient_data');
        localStorage.removeItem('must_change_password');
        sessionStorage.clear();
      }
    } catch (err) {
      console.warn('Failed clearing session during logout:', err);
    }

    clearTenant();
    logout();
    navigate('/login');
  };

  // Prepare mobile menu groups
  const menuGroupsForMobile = Object.entries(menuStructure).map(
    ([title, items]) => ({
      title: title.replace(/^[^\w]+\s*/, '') || title,
      items: items.filter((item) => canAccess(item.path)),
    })
  ).filter((g) => g.items.length > 0);

  return (
    <div className="layout app-container">
      <nav
        className="navbar"
        style={{ borderBottom: `2px solid ${primaryColor || '#00f2fe'}` }}
      >
        <button
          className="nav-hamburger"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation"
        >
          ☰
        </button>

        <div className="nav-brand">
          <img
  src={hospitalLogo || '/logo.png'}
  alt={hospitalName || 'NexGen EMR'}
  className="unique-logo"
  style={{
    height: '38px',
    width: '38px',
    objectFit: 'contain',
  }}
/>
          <span>{hospitalName || 'NexGen EMR'}</span>
        </div>

        {!isMobileView && (
          <>
            <div className="nav-menu">{renderNav()}</div>

            <div className="nav-search">
              <input
                type="text"
                placeholder="🔍 Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="nav-user">
  <span>{user?.firstName} {user?.lastName}</span>
  <span className="role-badge">{user?.role}</span>
  <button
    onClick={() => {
      if (window.confirm('Switch to another hospital? You will be logged out.')) {
        handleLogout();
      }
    }}
    className="btn btn-secondary btn-sm"
    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
    title="Change hospital"
  >
    🏥 Switch
          </button>
          
          <button
  onClick={() => navigate('/change-password')}
  className="btn btn-secondary btn-sm"
  style={{
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
  }}
  title="Change your password"
>
  🔑
          </button>
          
  <button onClick={handleLogout} className="btn btn-danger btn-sm">Logout</button>
</div>
      </nav>

      <main className="main-content">
  {/* The `key` forces React to remount the wrapper on every route change,
      which re-triggers the CSS animation each time. */}
  <div key={location.pathname} className="page-fade-in">
    <Outlet context={{ searchTerm }} />
  </div>
</main>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        menuGroups={menuGroupsForMobile}
      />
    </div>
  );
};

export default Layout;
export const useSearch = () => useOutletContext();