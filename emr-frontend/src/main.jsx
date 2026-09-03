// src/main.jsx or src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // ✅ IMPORT THIS
import App from './App';
import './index.css';

// ✅ Ignore browser extension errors
window.addEventListener('error', function(e) {
  if (e.message && e.message.includes('startTime')) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  if (e.filename && e.filename.includes('chrome-extension')) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  return true;
});

window.addEventListener('unhandledrejection', function(e) {
  if (e.reason && e.reason.message && e.reason.message.includes('startTime')) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  return true;
});

// Suppress console errors from extensions
const originalConsoleError = console.error;
console.error = function(...args) {
  const message = args[0] || '';
  if (typeof message === 'string' && 
      (message.includes('startTime') || 
       message.includes('chrome-extension') ||
       message.includes('content script'))) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// ✅ WRAP APP WITH BrowserRouter
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>  {/* ✅ THIS IS THE FIX */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);