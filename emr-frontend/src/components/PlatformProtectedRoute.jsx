// src/components/PlatformProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePlatformAuth } from '../context/PlatformAuthContext';

const PlatformProtectedRoute = ({ children }) => {
  const { token } = usePlatformAuth();

  if (!token) {
    return <Navigate to="/platform/login" replace />;
  }

  return children;
};

export default PlatformProtectedRoute;