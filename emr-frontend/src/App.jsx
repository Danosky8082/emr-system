// src/App.jsx - Complete with all module routes

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
import LaborDeliveryPage from './pages/LaborDeliveryPage';
import DentalDashboard from './pages/DentalDashboard';
import OptometryDashboard from './pages/OptometryDashboard';
import PaediatricDashboard from './pages/PaediatricDashboard';
import SurgeryDashboard from './pages/SurgeryDashboard';
import PsychiatryDashboard from './pages/PsychiatryDashboard';
import ModulePatientList from './pages/ModulePatientList'; // ✅ ADD THIS IMPORT

// ============ PATIENT PORTAL IMPORTS ============
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
        
        {/* ============================================================
            STAFF ROUTES
            ============================================================ */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
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
          
          {/* ✅ MODULE PATIENT LISTS - ADD THESE */}
          <Route path="pharmacy-patients" element={<ModulePatientList moduleType="pharmacy" />} />
          <Route path="lab-patients" element={<ModulePatientList moduleType="lab" />} />
          <Route path="radiology-patients" element={<ModulePatientList moduleType="radiology" />} />
          
          {/* Pharmacy */}
          <Route path="pharmacy" element={<Pharmacy />} />
          <Route path="pharmacy-dashboard" element={<PharmacyDashboard />} />
          <Route path="nhis-drugs" element={<NHISDrugManagement />} />
          
          {/* Radiology */}
          <Route path="radiology-dashboard" element={<RadiologyDashboard />} />
          
          {/* Dental */}
          <Route path="dental" element={<DentalDashboard />} />
          
          {/* Optometry */}
          <Route path="optometry" element={<OptometryDashboard />} />
          
          {/* Paediatrics */}
          <Route path="paediatric" element={<PaediatricDashboard />} />
          
          {/* Surgery */}
          <Route path="surgery" element={<SurgeryDashboard />} />
          
          {/* Psychiatry */}
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
    </AuthContext.Provider>
  );
}

export default App;