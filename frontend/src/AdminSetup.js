import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function AdminSetup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const navigate = useNavigate();

  const handleSetup = async (e) => {
    e.preventDefault();
    try {
      // AdminSetup.js - Line 14
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/admin/setup`, { email, password });
      setMessage('✅ ' + res.data.message);
      setTimeout(() => navigate('/login'), 3000); // Send them to login after 3 seconds
    } catch (error) {
      setMessage('❌ ' + (error.response?.data?.message || 'Setup failed'));
      if (error.response?.status === 403) {
        setIsLocked(true); // The system is locked!
      }
    }
  };

  return (
    <div style={{ padding: '60px 20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <div className="glass-card animate-slide-up">
        <h2 style={{ color: '#8b5cf6', marginBottom: '10px' }}>👑 System Initialization</h2>
        <p style={{ color: '#6b7280', marginBottom: '30px' }}>Create the Founding Administrator account. This action can only be performed once.</p>

        {message && (
          <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '8px', backgroundColor: isLocked ? '#fee2e2' : '#dcfce3', color: isLocked ? '#b91c1c' : '#166534', fontWeight: 'bold' }}>
            {message}
          </div>
        )}

        {!isLocked && (
          <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="email" 
              placeholder="Admin Email Address" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ padding: '12px', borderRadius: '8px', border: '2px solid #e5e7eb' }}
            />
            <input 
              type="password" 
              placeholder="Secure Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ padding: '12px', borderRadius: '8px', border: '2px solid #e5e7eb' }}
            />
            <button type="submit" className="btn" style={{ backgroundColor: '#8b5cf6', color: 'white', fontSize: '16px', padding: '12px' }}>
              Initialize System & Create Admin
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AdminSetup;