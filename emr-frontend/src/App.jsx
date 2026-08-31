// src/App.jsx - Complete with Kiosk independent

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { AuthContext } from './context/AuthContext';
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

// ============ PATIENT PORTAL IMPORTS (INDEPENDENT) ============
import PatientLogin from './pages/PatientLogin';
import PatientDashboard from './pages/PatientDashboard';
import PatientChangeCredentials from './pages/PatientChangeCredentials';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ServiceConfig from './pages/ServiceConfig';


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
    toast.success('Logged out successfully');
  };

  const authValue = { token, user, login, logout };

  return (
    <AuthContext.Provider value={authValue}>
      <Routes>
        {/* ============================================================
                PATIENT PORTAL ROUTES - COMPLETELY INDEPENDENT
                No staff authentication required!
                ============================================================ */}
        <Route path="/patient-login" element={<PatientLogin />} />
        <Route path="/patient-dashboard" element={<PatientDashboard />} />
        <Route path="/patient-wallet" element={<PatientWallet />} />
        <Route path="/patient-change-credentials" element={<PatientChangeCredentials />} />
        
        {/* ============================================================
                PUBLIC ROUTES - COMPLETELY INDEPENDENT
                ============================================================ */}
        <Route path="/kiosk" element={<KioskMode />} />   {/* ✅ Kiosk is independent */}
        <Route path="/login" element={<Login />} />
        
        {/* ============================================================
                STAFF ROUTES - Requires Authentication
                ============================================================ */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="prescriptions" element={<Prescriptions />} />
          <Route path="lab-orders" element={<LabOrders />} />
          <Route path="billing" element={<Billing />} />
          <Route path="pharmacy" element={<Pharmacy />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="admissions" element={<Admissions />} />
          <Route path="patient-history" element={<PatientHistory />} />
          <Route path="roi-requests" element={<ROIRequests />} />
          <Route path="clinics" element={<ManageClinics />} />
          <Route path="patient-intake" element={<PatientIntake />} />
          <Route path="billing-officer" element={<BillingOfficer />} />
          <Route path="pricing" element={<ManagePricing />} />
          <Route path="nurse-dashboard" element={<NurseDashboard />} />
          <Route path="patient-profile/:id" element={<PatientProfile />} />
          <Route path="wards" element={<ManageWards />} />
          <Route path="doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="permissions" element={<ManagePermissions />} />
          <Route path="antenatal" element={<AntenatalDashboard />} />
          <Route path="pregnancy/new" element={<PregnancyProfile />} />
          <Route path="pregnancy/:id" element={<PregnancyProfile />} />
          <Route path="archived-patients" element={<ArchivedPatients />} />
          <Route path="nhis-drugs" element={<NHISDrugManagement />} />
          <Route path="pharmacy-dashboard" element={<PharmacyDashboard />} />
          <Route path="archived-patients-view" element={<ArchivedPatientsView />} />
          <Route path="queue" element={<QueueDashboard />} />
          <Route path="doctor-queue" element={<DoctorQueue />} />
          <Route path="radiology-dashboard" element={<RadiologyDashboard />} />
          <Route path="hr/dashboard" element={<HRDashboard />} />
          <Route path="hr/employees" element={<HREmployees />} />
          <Route path="hr/departments" element={<HRDepartments />} />
          <Route path="hr/leaves" element={<HRLeaveManagement />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="system-status" element={<SystemStatus />} />
          <Route path="wallet" element={<WalletDashboard />} />
          <Route path="service-config" element={<ServiceConfig />} />
        </Route>
        
        {/* ============================================================
                CATCH-ALL
                ============================================================ */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;