import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('rider'); // 'rider' | 'driver' | 'admin'
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      console.log('🕵️ Attempting login — submitted toggle:', role, '| email:', email);

      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/login`,
        { email, password, role }
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

  // ── Role options config ────────────────────────────────────────────────────
  // Admin is intentionally omitted from the public toggle.
  // Admins authenticate via the same form; the backend handles role resolution.
  const roles = [
    { value: 'rider',  label: '🚕 Rider'  },
    { value: 'driver', label: '🚗 Driver' },
  ];

  // ── Colour accent per role ─────────────────────────────────────────────────
  const accentColor = role === 'driver' ? '#f59e0b' : '#3b82f6';

  return (
    <div style={{ padding: '50px 20px', maxWidth: '420px', margin: '0 auto' }}>
      <div className="glass-card">

        <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Welcome Back</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginBottom: '28px' }}>
          Log in to continue your journey
        </p>

        {/* ── Role Toggle ── */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          padding: '5px',
          gap: '4px',
          marginBottom: '22px'
        }}>
          {roles.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 'none',
                borderRadius: '9px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                backgroundColor: role === value ? accentColor : 'transparent',
                color:           role === value ? '#ffffff'    : '#6b7280',
                boxShadow:       role === value ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Accent bar that shifts colour with the role ── */}
        <div style={{
          height: '3px',
          borderRadius: '2px',
          backgroundColor: accentColor,
          marginBottom: '24px',
          transition: 'background-color 0.3s ease'
        }} />

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
              backgroundColor: loading ? '#9ca3af' : accentColor,
              color: '#fff',
              fontWeight: '700',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s ease',
              letterSpacing: '0.5px'
            }}
          >
            {loading ? 'Signing in…' : `Sign in as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
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
          <Link to="/register" style={{ color: accentColor, fontWeight: 'bold', textDecoration: 'none' }}>
            Sign Up
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;