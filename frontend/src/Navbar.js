import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import brandLogo from './navbar-logo.png'; // 💡 1. WE IMPORTED THE IMAGE HERE

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <nav style={{ 
      backgroundColor: '#000000', 
      padding: '15px 30px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
      position: 'sticky', 
      top: 0,
      zIndex: 9999
    }}>
      
      {/* BRAND LOGO */}
      <div>
        {/* 💡 2. WE REPLACED THE TEXT WITH THE IMAGE HERE */}
        <Link to="/">
          <img 
            src={brandLogo} 
            alt="Smart Ride Logo" 
            style={{ 
              height: '50px', 
              display: 'block', 
              transform: 'scale(2.4)', 
              transformOrigin: 'left center' 
            }} 
          />
        </Link>
      </div>

      {/* NAVIGATION LINKS */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        
        {/* If NOBODY is logged in */}
        {!token ? (
          <>
            <Link to="/login" style={{ color: 'white', textDecoration: 'none', fontSize: '16px', fontWeight: 'bold' }}>Login</Link>
            <Link to="/register" style={{ backgroundColor: 'white', color: 'black', textDecoration: 'none', fontSize: '16px', fontWeight: 'bold', padding: '8px 16px', borderRadius: '20px' }}>Sign Up</Link>
          </>
        ) : (
          
          /* If SOMEONE is logged in */
          <>
            {role === 'rider' && (
              <Link to="/dashboard" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 'bold' }}>Rider Dashboard</Link>
            )}
            
            {role === 'driver' && (
              <Link to="/driver" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>Driver Dashboard</Link>
            )}

            {role === 'admin' && (
              <Link to="/admin" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: 'bold', letterSpacing: '0.5px' }}>👑 Admin Headquarters</Link>
            )}

            <button 
              onClick={handleLogout} 
              style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '10px' }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;