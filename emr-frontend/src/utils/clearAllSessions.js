// src/utils/clearAllSessions.js
export const clearAllSessions = () => {
  // Platform keys
  localStorage.removeItem('platform_token');
  localStorage.removeItem('platform_user');
  
  // Tenant keys
  localStorage.removeItem('emr_token');
  localStorage.removeItem('emr_user');
  localStorage.removeItem('emr_tenant_id');
  localStorage.removeItem('emr_hospital');
  localStorage.removeItem('emr_hospital_settings');
  
  // Other tenant-scoped data
  localStorage.removeItem('staffData');
  localStorage.removeItem('must_change_password');
  
  // Session-scoped flags (used for redirect logic)
  sessionStorage.removeItem('hasRedirected');
};