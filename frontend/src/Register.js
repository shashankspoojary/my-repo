import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Register() {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [phone,    setPhone]    = useState('');
  const [role,          setRole]          = useState('rider');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType,   setVehicleType]   = useState('Car');
  const [message,       setMessage]       = useState('');

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    // Client-side username guard (mirrors server rule)
    if (!/^[A-Za-z]+$/.test(username)) {
      return setMessage('❌ Username must contain only alphabetic characters (A-Z, a-z). No numbers, spaces, or special characters.');
    }

    try {
      const payload = { username, email, password, phone, role };
      if (role === 'driver') {
        payload.vehicleNumber = vehicleNumber;
        payload.vehicleType   = vehicleType;
      }

      await axios.post(`${process.env.REACT_APP_API_URL}/auth/register`, payload);

      setMessage('✅ Account Created! Sending you to Login...');
      setTimeout(() => navigate('/login'), 1500);

    } catch (error) {
      setMessage('❌ ' + (error.response?.data?.message || 'Registration failed'));
    }
  };

  return (
    <div style={{ padding: '50px 20px', maxWidth: '400px', margin: '0 auto' }}>
      <div className="glass-card">
        <h2 style={{ textAlign: 'center', marginBottom: '25px' }}>Create an Account</h2>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Username — alphabetic only */}
          <input
            type="text"
            placeholder="Username (letters only, e.g. JohnDoe)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="tel"
            placeholder="Phone Number (10 digits)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <select value={role} onChange={(e) => { setRole(e.target.value); setVehicleNumber(''); setVehicleType('Car'); }}>
            <option value="rider">I am a Rider 🚕</option>
            <option value="driver">I am a Driver 🚗</option>
          </select>

          {role === 'driver' && (
            <>
              <input
                type="text"
                placeholder="Vehicle Registration Number (e.g. MH12AB1234)"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                required
              />

              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                required
              >
                <option value="Car">Car 🚗</option>
                <option value="Auto">Auto 🛺</option>
                <option value="Bike">Bike 🏍️</option>
                <option value="Other">Other 🚐</option>
              </select>
            </>
          )}

          <button type="submit" className="btn btn-green">
            Sign Up
          </button>
        </form>

        <h4 style={{ textAlign: 'center', color: '#ef4444', marginTop: '15px' }}>{message}</h4>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#3b82f6', fontWeight: 'bold', textDecoration: 'none' }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;