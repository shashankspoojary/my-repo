import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      console.log('🕵️ Attempting login — email:', email);

      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/login`,
        { email, password }
      );

      console.log('✅ Login response:', res.data);

      // Persist auth token
      localStorage.setItem('token', res.data.token);

      // ── Read the role strictly from the SERVER response, never from local state ──
      // The backend may resolve a different role (e.g., admin via fallback), so we
      // must always trust res.data.user.role over the frontend toggle value.
      const serverUser = res.data.user;
      if (!serverUser || !serverUser.role) {
        console.error('🚨 Backend did not return user.role:', res.data);
        setMessage('❌ Server error: missing role in response. Please contact support.');
        return;
      }

      const serverRole = serverUser.role; // e.g. 'admin', 'rider', 'driver'

      // Persist user data for downstream components
      localStorage.setItem('role', serverRole);
      localStorage.setItem('user', JSON.stringify(serverUser));

      console.log(`🔐 Authenticated as: ${serverRole} — navigating…`);

      // Route based solely on the server-confirmed role
      if (serverRole === 'admin') {
        navigate('/admin');
      } else if (serverRole === 'driver') {
        navigate('/driver');
      } else {
        navigate('/dashboard'); // rider
      }

    } catch (error) {
      console.error('🚨 Login failed:', error.response?.data || error.message);
      setMessage('❌ ' + (error.response?.data?.message || 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '50px 20px', maxWidth: '420px', margin: '0 auto' }}>
      <div className="glass-card">

        <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Welcome Back</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginBottom: '28px' }}>
          Log in to continue your journey
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
          <input
            id="login-email"
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            id="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              fontWeight: '700',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s ease',
              letterSpacing: '0.5px'
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {message && (
          <h4 style={{
            textAlign: 'center',
            color: message.startsWith('✅') ? '#059669' : '#ef4444',
            marginTop: '15px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            {message}
          </h4>
        )}

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#3b82f6', fontWeight: 'bold', textDecoration: 'none' }}>
            Sign Up
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;