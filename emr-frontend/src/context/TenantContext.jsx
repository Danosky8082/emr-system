// src/context/TenantContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const TenantContext = createContext(null);

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return ctx;
};

export const TenantProvider = ({ children }) => {
  const [tenantId, setTenantId] = useState(null);
  const [hospital, setHospital] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Load tenant from localStorage on mount
  useEffect(() => {
    const savedTenantId = localStorage.getItem('emr_tenant_id');
    const savedHospital = localStorage.getItem('emr_hospital');
    const savedSettings = localStorage.getItem('emr_hospital_settings');

    if (savedTenantId) setTenantId(savedTenantId);
    if (savedHospital) {
      try { setHospital(JSON.parse(savedHospital)); } catch (e) {}
    }
    if (savedSettings) {
      try { setSettings(JSON.parse(savedSettings)); } catch (e) {}
    }
    setLoading(false);
  }, []);

  // ✅ Set tenant (called on login)
  const setTenant = (id, hospitalData = null, settingsData = null) => {
    setTenantId(id);
    setHospital(hospitalData);
    setSettings(settingsData);

    if (id) {
      localStorage.setItem('emr_tenant_id', id);
    } else {
      localStorage.removeItem('emr_tenant_id');
    }

    if (hospitalData) {
      localStorage.setItem('emr_hospital', JSON.stringify(hospitalData));
    } else {
      localStorage.removeItem('emr_hospital');
    }

    if (settingsData) {
      localStorage.setItem('emr_hospital_settings', JSON.stringify(settingsData));
    } else {
      localStorage.removeItem('emr_hospital_settings');
    }
  };

  // ✅ Clear tenant (called on logout)
  const clearTenant = () => {
    setTenantId(null);
    setHospital(null);
    setSettings(null);
    localStorage.removeItem('emr_tenant_id');
    localStorage.removeItem('emr_hospital');
    localStorage.removeItem('emr_hospital_settings');
  };

  // ✅ Refresh hospital data from server
  const refreshHospital = async (token) => {
    if (!tenantId) return;
    try {
      const axios = (await import('axios')).default;
      const res = await axios.get(
        `http://localhost:3000/api/hospitals/${tenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTenant(tenantId, res.data, res.data.settings);
    } catch (error) {
      console.error('Failed to refresh hospital data:', error);
    }
  };

  const value = {
    tenantId,
    hospital,
    settings,
    loading,
    setTenant,
    clearTenant,
    refreshHospital,
    // Convenience getters
    hospitalName: hospital?.name || 'NexGen EMR',
    hospitalLogo: hospital?.logoUrl || null,
    primaryColor: hospital?.primaryColor || '#0f3460',
    secondaryColor: hospital?.secondaryColor || '#1a4a7a',
    currencySymbol: settings?.currencySymbol || '₦',
    timezone: settings?.timezone || 'Africa/Lagos',
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};