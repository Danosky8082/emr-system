// emr-frontend/src/api/client.js
//
// Central API client. ALL frontend HTTP calls should go through this.
// Handles:
//   1. Base URL from VITE_API_URL (falls back to localhost in dev)
//   2. Auto-attaching the right auth token based on the request path
//   3. Friendly error shape so callers don't need to dig into .response.data.error
//   4. Auto-redirect on 401 so pages don't need to handle "session expired"
//
// Usage:
//   import api from '../api/client';
//   const res = await api.get('/patients');
//   const res = await api.post('/patients', payload);

import axios from 'axios';

// The backend mounts all routes under `/api`, so BASE_URL must include it.
// Examples:
//   Dev:      VITE_API_URL=http://localhost:3000/api
//   Render:   VITE_API_URL=https://your-backend.onrender.com/api
const BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
  'http://localhost:3000/api';

const api = axios.create({
  baseURL: BASE_URL,
  // 120s — uploads of large images can take a while, especially on
  // slower connections. Non-upload requests return fast, so this only
  // matters for the imaging upload flow.
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// REQUEST INTERCEPTOR — attach the right token
// ============================================================
//
// The app has THREE separate token namespaces:
//   emr_token       — staff (main EMR)
//   patient_token   — patient portal
//   platform_token  — platform / super-admin
//
// We pick which one to send based on the URL path. This means
// PatientDashboard.jsx and Layout.jsx can coexist without one
// overwriting the other's localStorage key.

api.interceptors.request.use(
  (config) => {
    const url = config.url || '';
    let token = null;

    if (url.startsWith('/patient/')) {
      token = localStorage.getItem('patient_token');
    } else if (url.startsWith('/platform/')) {
      token = localStorage.getItem('platform_token');
    } else {
      token = localStorage.getItem('emr_token');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// RESPONSE INTERCEPTOR — normalize errors + handle 401
// ============================================================
//
//   - 401 on staff routes     → clear staff session, bounce to /login
//   - 401 on patient routes   → clear patient session, bounce to /patient-login
//   - 401 on platform routes  → clear platform session, bounce to /platform/login
//   - Anything else           → reject with a normalized error object
//
// We DON'T redirect from /login itself (that would loop).

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const onLoginPage = window.location.pathname.endsWith('/login');

    if (status === 401 && !onLoginPage) {
      if (url.startsWith('/patient/')) {
        localStorage.removeItem('patient_token');
        localStorage.removeItem('patient_data');
        localStorage.removeItem('must_change_password');
        window.location.href = '/patient-login';
      } else if (url.startsWith('/platform/')) {
        localStorage.removeItem('platform_token');
        localStorage.removeItem('platform_user');
        window.location.href = '/platform/login';
      } else {
        localStorage.removeItem('emr_token');
        localStorage.removeItem('emr_user');
        window.location.href = '/login';
      }
    }

    // Normalize error: always expose `error.message` as the server's error string
    // if the backend sent one. Callers can just read `err.message`.
    const serverMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;

    return Promise.reject(
      Object.assign(error, {
        message: serverMessage,
      })
    );
  }
);

export default api;