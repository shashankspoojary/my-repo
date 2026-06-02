import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import DriverDashboard from './DriverDashboard';
import AdminDashboard from './AdminDashboard';
import AdminSetup from './AdminSetup';
import Profile from './Profile';

function App() {
  
  // 💡 THE AUTO-REDIRECT LOGIC
  useEffect(() => {
    const checkSystemState = async () => {
      try {
        // App.js - Line 14
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/check-setup`);
        
        // If the database is empty, and we aren't already on the setup page, force them there!
        if (res.data.isSetupComplete === false && window.location.pathname !== '/setup') {
          window.location.href = '/setup';
        }
        
        // If the database is full, but someone tries to sneak into the setup page, kick them out!
        if (res.data.isSetupComplete === true && window.location.pathname === '/setup') {
          window.location.href = '/login';
        }

      } catch (error) {
        console.error("System Check Failed");
      }
    };

    checkSystemState();
  }, []);

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/driver" element={<DriverDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/setup" element={<AdminSetup />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  );
}

export default App;