import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdminDashboard() {
  const [stats, setStats] = useState({
    rides: [],
    totalUsers:    0,
    totalRiders:   0,
    totalDrivers:  0,
    totalRevenue:  0,
    platformProfit: 0,
    activeRides:   0,
    totalRides:    0
  });
  const [message, setMessage] = useState('');

  // ── Separate state for riders and drivers ──────────────────────────────────
  const [riders,  setRiders]  = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Active tab: 'rides' | 'riders' | 'drivers'
  const [activeTab, setActiveTab] = useState('rides');

  // Pagination
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch ride stats whenever the page changes
  useEffect(() => {
    fetchSystemData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Fetch riders + drivers once on mount
  useEffect(() => {
    fetchRiders();
    fetchDrivers();
  }, []);

  const fetchSystemData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return setMessage('❌ Access Denied.');
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/admin/dashboard?page=${page}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(res.data);
      setTotalPages(res.data.totalPages === 0 ? 1 : res.data.totalPages);
    } catch {
      setMessage('❌ You do not have Admin privileges!');
    }
  };

  const fetchRiders = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/admin/riders`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRiders(res.data);
    } catch (error) {
      console.error('Failed to load riders', error);
    }
  };

  const fetchDrivers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/admin/drivers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDrivers(res.data);
    } catch (error) {
      console.error('Failed to load drivers', error);
    }
  };

  const handleRefresh = () => {
    fetchSystemData();
    fetchRiders();
    fetchDrivers();
  };

  // ── Toggle driver approval ─────────────────────────────────────────────────
  const handleToggleApproval = async (driverId) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.put(
        `${process.env.REACT_APP_API_URL}/admin/drivers/${driverId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update the driver in local state so the UI responds instantly
      setDrivers(prev =>
        prev.map(d => d._id === driverId ? { ...d, isApproved: res.data.driver.isApproved } : d)
      );
    } catch (error) {
      console.error('Failed to toggle driver approval', error);
      alert('❌ Could not update approval status. Please try again.');
    }
  };

  const renderUserCard = (user, role) => (
    <div
      key={user._id}
      className="glass-card"
      style={{
        padding:   '20px',
        borderTop: role === 'driver' ? '5px solid #f59e0b' : '5px solid #3b82f6'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
        <img
          src={user.profilePicture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
          alt="avatar"
          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#f3f4f6' }}
        />
        <div>
          <h3 style={{ margin: '0 0 5px 0' }}>{user.username}</h3>
          <span style={{
            fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold',
            padding: '3px 8px', borderRadius: '12px',
            backgroundColor: role === 'driver' ? '#fef3c7' : '#dbeafe',
            color:           role === 'driver' ? '#d97706' : '#2563eb'
          }}>
            {role}
          </span>
        </div>
      </div>
      <p style={{ margin: '0 0 5px 0',  fontSize: '13px', color: '#4b5563' }}>✉️ {user.email}</p>
      <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#4b5563' }}>📱 +91 {user.phone}</p>
      {role === 'driver' && (
        <>
          {/* ── Vehicle Reg Number ───────────────────────────────────── */}
          {user.vehicleNumber && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#1c1917', color: '#fbbf24',
              padding: '6px 14px', borderRadius: '8px',
              fontWeight: '800', fontSize: '15px', letterSpacing: '2px',
              marginBottom: '8px', border: '2px solid #fbbf24'
            }}>
              🔢 {user.vehicleNumber}
            </div>
          )}

          {/* ── Vehicle Type ─────────────────────────────────────────── */}
          {user.vehicleType && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#ede9fe', color: '#6d28d9',
              padding: '4px 12px', borderRadius: '20px',
              fontWeight: '700', fontSize: '13px',
              marginBottom: '12px', marginLeft: '8px',
              border: '1.5px solid #c4b5fd'
            }}>
              🚗 {user.vehicleType}
            </div>
          )}

          {/* ── Rating row ───────────────────────────────────────────── */}
          <div style={{
            backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px',
            border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>Global Rating:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: '#f59e0b', fontSize: '18px' }}>⭐</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                {user.averageRating ? user.averageRating.toFixed(1) : '5.0'}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>({user.totalRatings || 0})</span>
            </div>
          </div>

          {/* ── Approval toggle button ───────────────────────────────── */}
          <button
            id={`approve-driver-${user._id}`}
            onClick={() => handleToggleApproval(user._id)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '14px',
              transition: 'all 0.2s',
              backgroundColor: user.isApproved ? '#d1fae5' : '#fef3c7',
              color:           user.isApproved ? '#065f46' : '#92400e',
              boxShadow:       user.isApproved
                ? '0 0 0 2px #10b981 inset'
                : '0 0 0 2px #f59e0b inset',
            }}
          >
            {user.isApproved ? '✅ Approved — Click to Revoke' : '⏳ Pending — Click to Approve'}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="animate-slide-up delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>👑 Admin Headquarters</h2>
        <button onClick={handleRefresh} className="btn btn-black" style={{ margin: 0 }}>🔄 Refresh Data</button>
      </div>

      {message && (
        <div className="glass-card animate-pop" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', textAlign: 'center' }}>
          {message}
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="animate-slide-up delay-2" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>

        <div className="glass-card" style={{ flex: 1, minWidth: '180px', borderTop: '5px solid #8b5cf6', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', color: '#6b7280', fontWeight: 'bold' }}>TOTAL REVENUE</p>
          <h2 style={{ margin: 0, fontSize: '36px', color: '#4f46e5' }}>₹{stats.totalRevenue.toFixed(2)}</h2>
        </div>

        <div className="glass-card" style={{ flex: 1, minWidth: '180px', borderTop: '5px solid #ec4899', textAlign: 'center', backgroundColor: '#fdf2f8' }}>
          <p style={{ margin: '0 0 10px 0', color: '#be185d', fontWeight: 'bold', fontSize: '12px' }}>YOUR PROFIT (20%)</p>
          <h2 style={{ margin: 0, fontSize: '32px', color: '#be185d' }}>₹{(stats.platformProfit || 0).toFixed(2)}</h2>
        </div>

        <div className="glass-card" style={{ flex: 1, minWidth: '180px', borderTop: '5px solid #10b981', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', color: '#6b7280', fontWeight: 'bold' }}>TOTAL RIDES</p>
          <h2 style={{ margin: 0, fontSize: '36px', color: '#059669' }}>{stats.totalRides}</h2>
        </div>

        <div className="glass-card" style={{ flex: 1, minWidth: '180px', borderTop: '5px solid #f59e0b', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', color: '#6b7280', fontWeight: 'bold' }}>ACTIVE RIDES</p>
          <h2 style={{ margin: 0, fontSize: '36px', color: '#d97706' }}>{stats.activeRides}</h2>
        </div>

        {/* ── Two separate counters instead of one ── */}
        <div className="glass-card" style={{ flex: 1, minWidth: '180px', borderTop: '5px solid #3b82f6', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', color: '#6b7280', fontWeight: 'bold' }}>RIDERS</p>
          <h2 style={{ margin: 0, fontSize: '36px', color: '#2563eb' }}>{stats.totalRiders ?? riders.length}</h2>
        </div>

        <div className="glass-card" style={{ flex: 1, minWidth: '180px', borderTop: '5px solid #f59e0b', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', color: '#6b7280', fontWeight: 'bold' }}>DRIVERS</p>
          <h2 style={{ margin: 0, fontSize: '36px', color: '#d97706' }}>{stats.totalDrivers ?? drivers.length}</h2>
        </div>

      </div>

      {/* ── Tab Navigation (now three tabs) ── */}
      <div className="animate-slide-up delay-2" style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        {[
          { key: 'rides',   label: '🚕 Global Ride History'  },
          { key: 'riders',  label: '🧍 Rider Profiles'       },
          { key: 'drivers', label: '🚗 Driver Profiles'      }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="btn"
            style={{
              margin: 0, flex: 1,
              backgroundColor: activeTab === key ? '#111827' : '#e5e7eb',
              color:           activeTab === key ? 'white'   : '#4b5563',
              border: 'none'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: All Rides ── */}
      {activeTab === 'rides' && (
        <div className="glass-card animate-slide-up delay-3" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '15px', color: '#4b5563' }}>Route</th>
                <th style={{ padding: '15px', color: '#4b5563' }}>Distance</th>
                <th style={{ padding: '15px', color: '#4b5563' }}>Payment</th>
                <th style={{ padding: '15px', color: '#4b5563' }}>Fare</th>
                <th style={{ padding: '15px', color: '#4b5563' }}>Status</th>
                <th style={{ padding: '15px', color: '#4b5563' }}>Security PIN</th>
                <th style={{ padding: '15px', color: '#4b5563' }}>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {stats.rides.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No rides in the system yet.</td></tr>
              ) : (
                stats.rides.map((ride) => (
                  <tr key={ride._id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '15px' }}>
                      <strong>{ride.pickupLocation}</strong> <br/>
                      <span style={{ color: '#9ca3af' }}>➔</span> <strong>{ride.dropoffLocation}</strong>
                    </td>
                    <td style={{ padding: '15px' }}>{ride.distanceInKm} km</td>
                    <td style={{ padding: '15px' }}>
                      {/* Case-insensitive match covers both legacy 'cash'/'online'
                          and Phase-2 'Cash'/'Online' enum values */}
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                        backgroundColor: ride.paymentMethod?.toLowerCase() === 'online' ? '#eff6ff' : '#f0fdf4',
                        color:           ride.paymentMethod?.toLowerCase() === 'online' ? '#1d4ed8' : '#065f46'
                      }}>
                        {ride.paymentMethod?.toLowerCase() === 'online' ? '💳 Online' : '💵 Cash'}
                      </span>
                      <br />
                      <span style={{
                        display: 'inline-block', marginTop: '4px',
                        padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600',
                        backgroundColor: ride.paymentStatus === 'Completed' ? '#d1fae5' : '#fef3c7',
                        color:           ride.paymentStatus === 'Completed' ? '#065f46' : '#92400e'
                      }}>
                        {ride.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>₹{ride.totalFare || ride.baseFare || '0'}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{
                        padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                        backgroundColor: ride.status === 'completed' ? '#d1fae5' : ride.status === 'cancelled' ? '#fee2e2' : '#dbeafe',
                        color:           ride.status === 'completed' ? '#065f46' : ride.status === 'cancelled' ? '#991b1b' : '#1e40af'
                      }}>
                        {ride.status}
                      </span>
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '2px' }}>
                      {ride.otp ? ride.otp : '---'}
                    </td>
                    <td style={{ padding: '15px' }}>
                      {ride.rating ? (
                        <div>
                          <div style={{ color: '#f59e0b', fontSize: '14px', letterSpacing: '1px' }}>
                            {'★'.repeat(ride.rating)}{'☆'.repeat(5 - ride.rating)}
                          </div>
                          {ride.feedback && (
                            <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', marginTop: '4px', maxWidth: '150px' }}>
                              "{ride.feedback}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>No rating</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '10px 15px', borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', backgroundColor: page === 1 ? '#e5e7eb' : '#8b5cf6', color: page === 1 ? '#9ca3af' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                ← Previous
              </button>
              <span style={{ fontWeight: 'bold', color: '#4b5563' }}>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', backgroundColor: page === totalPages ? '#e5e7eb' : '#8b5cf6', color: page === totalPages ? '#9ca3af' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Riders (from Rider collection) ── */}
      {activeTab === 'riders' && (
        <div className="animate-slide-up delay-3">
          {riders.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', color: '#6b7280' }}>No riders registered yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {riders.map(r => renderUserCard(r, 'rider'))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Drivers (from Driver collection) ── */}
      {activeTab === 'drivers' && (
        <div className="animate-slide-up delay-3">
          {drivers.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', color: '#6b7280' }}>No drivers registered yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {drivers.map(d => renderUserCard(d, 'driver'))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default AdminDashboard;