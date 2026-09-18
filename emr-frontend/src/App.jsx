// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { AuthContext } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';  
import { PlatformAuthProvider } from './context/PlatformAuthContext';
import PlatformProtectedRoute from './components/PlatformProtectedRoute';
import PlatformLogin from './pages/PlatformLogin';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import Prescriptions from './pages/Prescriptions';
import LabOrders from './pages/LabOrders';
import Billing from './pages/Billing';
import Pharmacy from './pages/Pharmacy';
import StaffManagement from './pages/StaffManagement';
import Admissions from './pages/Admissions';
import PatientHistory from './pages/PatientHistory';
import ROIRequests from './pages/ROIRequests';
import ManageClinics from './pages/ManageClinics';
import PatientIntake from './pages/PatientIntake';
import BillingOfficer from './pages/BillingOfficer';
import ManagePricing from './pages/ManagePricing';
import NurseDashboard from './pages/NurseDashboard';
import PatientProfile from './pages/PatientProfile';
import ManageWards from './pages/ManageWards';
import DoctorDashboard from './pages/DoctorDashboard';
import ManagePermissions from './pages/ManagePermissions';
import AntenatalDashboard from './pages/AntenatalDashboard';
import PregnancyProfile from './pages/PregnancyProfile';
import ArchivedPatients from './pages/ArchivedPatients';
import NHISDrugManagement from './pages/NHISDrugManagement';
import PharmacyDashboard from './pages/PharmacyDashboard';
import ArchivedPatientsView from './pages/ArchivedPatientsView';
import QueueDashboard from './pages/QueueDashboard';
import KioskMode from './components/KioskMode';
import DoctorQueue from './pages/DoctorQueue';
import RadiologyDashboard from './pages/RadiologyDashboard';
import HRDashboard from './pages/HRDashboard';
import HREmployees from './pages/HREmployees';
import HRDepartments from './pages/HRDepartments';
import HRLeaveManagement from './pages/HRLeaveManagement';
import AuditLogs from './pages/AuditLogs';
import SystemStatus from './pages/SystemStatus';
import WalletDashboard from './pages/WalletDashboard';
import PatientWallet from './pages/PatientWallet';
import LaborDeliveryPage from './pages/LaborDeliveryPage';
import DentalDashboard from './pages/DentalDashboard';
import OptometryDashboard from './pages/OptometryDashboard';
import PaediatricDashboard from './pages/PaediatricDashboard';
import SurgeryDashboard from './pages/SurgeryDashboard';
import PsychiatryDashboard from './pages/PsychiatryDashboard';
import ModulePatientList from './pages/ModulePatientList';
import ServiceConfig from './pages/ServiceConfig';
import HospitalLogin from './pages/HospitalLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import RegisterHospital from './pages/RegisterHospital';

// ============ PATIENT PORTAL IMPORTS ============
import PatientLogin from './pages/PatientLogin';
import PatientDashboard from './pages/PatientDashboard';
import PatientChangeCredentials from './pages/PatientChangeCredentials';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// ============================================================
// APP CONTENT — consumes tenant theme & renders all routes
// ============================================================
const AppContent = () => {
  const { primaryColor, secondaryColor } = useTenant();  // ✅ NEW

  return (
    <div
      className="app-container"
      style={{
        '--primary-color': primaryColor || '#00f2fe',
        '--secondary-color': secondaryColor || '#4facfe',
      }}
    >
      <Routes>
        {/* ============================================================
            PATIENT PORTAL ROUTES
            ============================================================ */}
        <Route path="/patient-login" element={<PatientLogin />} />
        <Route path="/patient-dashboard" element={<PatientDashboard />} />
        <Route path="/patient-wallet" element={<PatientWallet />} />
        <Route path="/patient-change-credentials" element={<PatientChangeCredentials />} />

        {/* ============================================================
            PUBLIC ROUTES
            ============================================================ */}
        <Route path="/kiosk" element={<KioskMode />} />
        <Route path="/login" element={<Login />} />
        <Route path="/h/:hospitalSlug" element={<HospitalLogin />} />
        <Route path="/h/:hospitalSlug/login" element={<HospitalLogin />} />

        {/* ✅ Standalone / public routes (NOT wrapped in Layout) */}
        {/* ✅ Platform-only */}
<Route
  path="/register-hospital"
  element={
    <PlatformProtectedRoute>
      <RegisterHospital />
    </PlatformProtectedRoute>
  }
/>
        {/* ✅ Platform login — public, no guard */}
<Route path="/platform/login" element={<PlatformLogin />} />

{/* ✅ Platform dashboard — requires platform auth */}
<Route
  path="/super-admin"
  element={
    <PlatformProtectedRoute>
      <SuperAdminDashboard />
    </PlatformProtectedRoute>
  }
/>

        {/* ============================================================
            STAFF ROUTES (wrapped in Layout)
            ============================================================ */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          {/* Patients */}
          <Route path="patients" element={<Patients />} />
          <Route path="patient-intake" element={<PatientIntake />} />
          <Route path="admissions" element={<Admissions />} />
          <Route path="patient-history" element={<PatientHistory />} />
          <Route path="archived-patients" element={<ArchivedPatients />} />
          <Route path="archived-patients-view" element={<ArchivedPatientsView />} />

          {/* Maternity */}
          <Route path="antenatal" element={<AntenatalDashboard />} />
          <Route path="pregnancy/new" element={<PregnancyProfile />} />
          <Route path="pregnancy/:id" element={<PregnancyProfile />} />
          <Route path="labor-delivery" element={<LaborDeliveryPage />} />

          {/* Clinical */}
          <Route path="appointments" element={<Appointments />} />
          <Route path="prescriptions" element={<Prescriptions />} />
          <Route path="lab-orders" element={<LabOrders />} />
          <Route path="doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="nurse-dashboard" element={<NurseDashboard />} />
          <Route path="doctor-queue" element={<DoctorQueue />} />
          <Route path="queue" element={<QueueDashboard />} />

          {/* Module Patient Lists */}
          <Route path="pharmacy-patients" element={<ModulePatientList moduleType="pharmacy" />} />
          <Route path="lab-patients" element={<ModulePatientList moduleType="lab" />} />
          <Route path="radiology-patients" element={<ModulePatientList moduleType="radiology" />} />

          {/* Pharmacy */}
          <Route path="pharmacy" element={<Pharmacy />} />
          <Route path="pharmacy-dashboard" element={<PharmacyDashboard />} />
          <Route path="nhis-drugs" element={<NHISDrugManagement />} />

          {/* Radiology */}
          <Route path="radiology-dashboard" element={<RadiologyDashboard />} />

          {/* Specialist Modules */}
          <Route path="dental" element={<DentalDashboard />} />
          <Route path="optometry" element={<OptometryDashboard />} />
          <Route path="paediatric" element={<PaediatricDashboard />} />
          <Route path="surgery" element={<SurgeryDashboard />} />
          <Route path="psychiatry" element={<PsychiatryDashboard />} />

          {/* Finance */}
          <Route path="billing" element={<Billing />} />
          <Route path="billing-officer" element={<BillingOfficer />} />
          <Route path="pricing" element={<ManagePricing />} />
          <Route path="wallet" element={<WalletDashboard />} />
          <Route path="service-config" element={<ServiceConfig />} />

          {/* HR */}
          <Route path="hr/dashboard" element={<HRDashboard />} />
          <Route path="hr/employees" element={<HREmployees />} />
          <Route path="hr/departments" element={<HRDepartments />} />
          <Route path="hr/leaves" element={<HRLeaveManagement />} />

          {/* Admin */}
          <Route path="staff" element={<StaffManagement />} />
          <Route path="clinics" element={<ManageClinics />} />
          <Route path="wards" element={<ManageWards />} />
          <Route path="permissions" element={<ManagePermissions />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="system-status" element={<SystemStatus />} />

          {/* Patient Profile */}
          <Route path="patient-profile/:id" element={<PatientProfile />} />

          {/* ROI */}
          <Route path="roi-requests" element={<ROIRequests />} />
        </Route>

        {/* ============================================================
            CATCH-ALL
            ============================================================ */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

// ============================================================
// APP — providers + auth state
// ============================================================
function App() {
  const [token, setToken] = useState(localStorage.getItem('emr_token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      const savedUser = localStorage.getItem('emr_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    }
  }, [token]);

  const login = (token, user) => {
    setToken(token);
    setUser(user);
    localStorage.setItem('emr_token', token);
    localStorage.setItem('emr_user', JSON.stringify(user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('emr_token');
    localStorage.removeItem('emr_user');
    // ✅ TenantProvider's clearTenant will be called by the consumer
    toast.success('Logged out successfully');
  };

  const authValue = { token, user, login, logout };

  return (
  <TenantProvider>
    <AuthContext.Provider value={authValue}>
      <PlatformAuthProvider>
        <AppContent />
      </PlatformAuthProvider>
    </AuthContext.Provider>
  </TenantProvider>
);
}

export default App;