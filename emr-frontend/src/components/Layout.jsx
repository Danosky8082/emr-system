// src/components/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');

  // --- GROUPED NAVIGATION CONFIGURATION ---
  const allGroups = {
    Clinical: [
      { path: '/appointments', label: '📅 Appointments' },
      { path: '/prescriptions', label: '💊 Prescriptions' },
      { path: '/lab-orders', label: '🔬 Lab Orders' },
      { path: '/pharmacy', label: '🏥 Pharmacy' },
    ],
    Finance: [
      { path: '/billing', label: '💰 Billing' },
      { path: '/billing-officer', label: '💵 Billing Desk' },
    ],
    Admin: [
      { path: '/staff', label: '👨‍⚕️ Staff' },
      { path: '/clinics', label: '🏥 Manage Clinics' },
      { path: '/wards', label: '🛏️ Manage Wards' },
      { path: '/pricing', label: '💲 Service Pricing' },
      { path: '/nurse-dashboard', label: '🩺 Nurse Dashboard' }, // <-- Added for Admin
    ],
    Records: [
      { path: '/patient-intake', label: '🔄 Patient Intake' },
      { path: '/admissions', label: '🏥 ADT' },
      { path: '/patient-history', label: '📂 Patient History' },
      { path: '/roi-requests', label: '📄 ROI Requests' },
    ],

    'Doctor': [
  { path: '/doctor-dashboard', label: '🩺 Doctor Dashboard' },
  { path: '/appointments', label: '📅 Appointments' },
  { path: '/prescriptions', label: '💊 Prescriptions' },
  { path: '/lab-orders', label: '🔬 Lab Orders' },
  { path: '/patients', label: '👤 Patients' },
],
  };

  // Helper to check if the current user has permission for a specific path
  const canAccess = (path) => {
    const baseItems = ['/', '/patients'];
    const role = user?.role || '';
    
    // Everyone can see Dashboard and Patients
    if (baseItems.includes(path)) return true;

    // Role-based access (updated with all modules)
    const roleItems = {
      'Admin': [
        '/staff', '/appointments', '/prescriptions', '/lab-orders', '/billing', '/pharmacy',
        '/clinics', '/wards', '/pricing', '/billing-officer', '/patient-intake', '/admissions',
        '/patient-history', '/roi-requests', '/nurse-dashboard' // <-- Added nurse dashboard
      ],
      'ITAdmin': ['/staff','/appointments','/billing','/pharmacy','/system/status','/system/logs'],
      'ITSupport': ['/system/status','/system/logs'],
      'Doctor': ['/appointments','/prescriptions','/lab-orders'],
      'Nurse': ['/nurse-dashboard', '/appointments', '/prescriptions', '/lab-orders'],
      'Pharmacist': ['/pharmacy','/prescriptions'],
      'Accountant': ['/billing'],
      'Records': ['/patient-intake','/admissions','/patient-history','/roi-requests','/appointments'],
      'LabTechnician': ['/lab-orders'],
      'BillingOfficer': ['/billing-officer'],
    };
    return (roleItems[role] || []).includes(path);
  };

  // --- AUTO-REDIRECT NURSES TO THEIR DASHBOARD ---
  useEffect(() => {
  if (user?.role === 'Nurse' && location.pathname === '/') {
    navigate('/nurse-dashboard');
  } else if (user?.role === 'Doctor' && location.pathname === '/') {
    navigate('/doctor-dashboard');
  }
}, [user, location.pathname, navigate]);

  // Generate the Navbar dynamically with Dropdowns
  const renderNav = () => {
    return (
      <>
        {/* Dashboard – always visible */}
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📊 Dashboard
        </NavLink>

        {/* Nurse Dashboard – for both Admin and Nurse */}
        {(user?.role === 'Nurse' || user?.role === 'Admin') && (
          <NavLink to="/nurse-dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            🩺 Nurse Dashboard
          </NavLink>
        )}

        {/* Patients – always visible */}
        <NavLink to="/patients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          👤 Patients
        </NavLink>

        {/* Generate Dropdown Groups */}
        {Object.entries(allGroups).map(([groupName, items]) => {
          const visibleItems = items.filter(item => canAccess(item.path));
          if (visibleItems.length === 0) return null; // Skip empty groups

          return (
            <div key={groupName} className="nav-dropdown">
              <button className="nav-dropdown-header">
                {groupName} ▼
              </button>
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
          {/* Unique Logo SVG */}
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

        <div className="nav-menu">
          {renderNav()}
        </div>

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
        {/* Pass searchTerm to all child routes */}
        <Outlet context={{ searchTerm }} />
      </main>
    </div>
  );
};

export default Layout;
// Export this hook so child pages can easily grab the searchTerm
export const useSearch = () => useOutletContext();