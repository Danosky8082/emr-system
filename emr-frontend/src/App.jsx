// src/App.jsx
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
import NurseDashboard from "./pages/NurseDashboard";
import PatientProfile from "./pages/PatientProfile";
import ManageWards from "./pages/ManageWards";
import DoctorDashboard from './pages/DoctorDashboard';
import ManagePermissions from './pages/ManagePermissions';
import AntenatalDashboard from './pages/AntenatalDashboard';
import PregnancyProfile from './pages/PregnancyProfile';
import ArchivedPatients from './pages/ArchivedPatients';
// ✅ NEW IMPORTS
import NHISDrugManagement from './pages/NHISDrugManagement';
import PharmacyDashboard from './pages/PharmacyDashboard';
import ArchivedPatientsView from './pages/ArchivedPatientsView';
import QueueDashboard from './pages/QueueDashboard';
import KioskMode from './components/KioskMode';
import DoctorQueue from './pages/DoctorQueue';
// --------------------------------------------
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

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
        <Route path="/login" element={<Login />} />
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
          {/* ✅ NEW ROUTES */}
          <Route path="nhis-drugs" element={<NHISDrugManagement />} />
          <Route path="pharmacy-dashboard" element={<PharmacyDashboard />} />
          <Route path="/archived-patients-view" element={<ArchivedPatientsView />} />
          <Route path="/queue" element={<QueueDashboard />} />
          <Route path="/kiosk" element={<KioskMode />} />
          <Route path="/doctor-queue" element={<DoctorQueue />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;