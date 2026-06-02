import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // 1. If they have NO pass at all, kick them to Login
  if (!token) {
    return <Navigate to="/login" />;
  }

  // 2. If the page requires a specific role, and they don't have it, kick them back to their own dashboard!
  if (allowedRole && role !== allowedRole) {
    if (role === 'driver') return <Navigate to="/driver" />;
    return <Navigate to="/dashboard" />;
  }

  // 3. If everything is good, let them in!
  return children;
}

export default ProtectedRoute;