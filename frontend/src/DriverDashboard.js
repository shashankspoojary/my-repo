import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

const mapPinIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', 
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
});

function DriverDashboard() {
  const [rides, setRides] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [message, setMessage] = useState('');
  
  // State to hold the driver's earnings and stats
  const [stats, setStats] = useState({ totalRides: 0, activeRides: 0, totalEarnings: 0 });

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [rideToCancel, setRideToCancel] = useState(null);
  const [liveAlert, setLiveAlert] = useState(null);

  // State for the OTP Keypad
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [rideToStart, setRideToStart] = useState(null);
  const [otpError, setOtpError] = useState(''); 

  const navigate = useNavigate();

  useEffect(() => {
    fetchAvailableRides();
    fetchMyJobs();
    fetchDriverStats(); 
    
    const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''));
    
    socket.on('newRideAlert', () => {
      fetchAvailableRides();
      setLiveAlert("📡 New passenger request available!");
      setTimeout(() => setLiveAlert(null), 5000);
    });

    socket.on('rideUpdated', () => {
      fetchAvailableRides();
      fetchMyJobs();
      fetchDriverStats(); 
    });

    socket.on('rideCancelledByRider', () => {
      fetchAvailableRides();
      fetchMyJobs();
      fetchDriverStats();
      setLiveAlert("🚫 Alert: A passenger cancelled their trip.");
      setTimeout(() => setLiveAlert(null), 7000);
    });

    return () => socket.disconnect();
  }, []);

  const fetchAvailableRides = async () => {
  const token = localStorage.getItem('token');
  try {
    // 💡 FIXED: Use local variable and add /api prefix
    const res = await axios.get(`${process.env.REACT_APP_API_URL}/rides/available`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    setRides(res.data.rides);
  } catch (error) { console.error(error); }
};

  const fetchMyJobs = async () => {
  const token = localStorage.getItem('token');
  try {
    // 💡 FIXED: Added local variable
    const res = await axios.get(`${process.env.REACT_APP_API_URL}/rides/my-jobs`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    setActiveJobs(res.data.rides);
  } catch (error) { console.error(error); }
};

  const fetchDriverStats = async () => {
  const token = localStorage.getItem('token');
  try {
    // 💡 FIXED: Added local variable
    const res = await axios.get(`${process.env.REACT_APP_API_URL}/rides/driver-dashboard`, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    setStats({
      totalRides: res.data.totalRides,
      activeRides: res.data.activeRides,
      totalEarnings: res.data.totalEarnings
    });
  } catch (error) { console.error(error); }
};

  const handleAction = async (rideId, action) => {
  const token = localStorage.getItem('token');
  try {
    // 💡 FIXED: Added local variable
    const res = await axios.put(`${process.env.REACT_APP_API_URL}/rides/${rideId}/${action}`, {}, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
      if (action === 'complete') { 
        setMessage(`🎉 Trip Completed! You earned ₹${res.data.driverEarnings.toFixed(2)} for this ${res.data.distance}km ride.`); 
      } else { 
        setMessage('✅ ' + res.data.message); 
      }
      fetchDriverStats(); 
    } catch (error) { setMessage('❌ Error updating ride'); }
  };

  const triggerCancelModal = (rideId) => { setRideToCancel(rideId); setIsCancelModalOpen(true); };
  const closeCancelModal = () => { setIsCancelModalOpen(false); setRideToCancel(null); };
  
  const confirmCancelRide = async () => { 
    if (!rideToCancel) return; 
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/rides/${rideToCancel}/cancel-by-driver`, {}, { 
          headers: { Authorization: `Bearer ${token}` } 
      });
      setActiveJobs(activeJobs.filter(job => job._id !== rideToCancel));
      fetchDriverStats(); 
      closeCancelModal(); 
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to cancel! Check if your Node server is running the latest code.");
      closeCancelModal();
    }
  };

  const triggerOtpModal = (rideId) => { 
    setRideToStart(rideId); 
    setOtpInput(''); 
    setOtpError('');
    setIsOtpModalOpen(true); 
  };
  
  const closeOtpModal = () => { 
    setIsOtpModalOpen(false); 
    setRideToStart(null); 
    setOtpInput('');
    setOtpError('');
  };

  const confirmStartRide = async () => {
    setOtpError(''); 

    if (!otpInput || otpInput.length !== 4) {
      setOtpError("❌ Please enter a 4-digit PIN.");
      return; 
    }

    const token = localStorage.getItem('token');
    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/rides/${rideToStart}/start`, 
          { otp: otpInput }, 
          { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('✅ ' + res.data.message);
      fetchMyJobs();
      closeOtpModal(); 
    } catch (error) {
      setOtpError(error.response?.data?.message || '❌ Error starting ride');
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      
      {liveAlert && (
        <div className="animate-slide-up" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#111827', color: 'white', padding: '15px 30px', borderRadius: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 10000, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🔔 {liveAlert}
        </div>
      )}

      {isCancelModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-pop" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px 0' }}>Cancel Trip?</h3>
            <p style={{ color: '#4b5563', marginBottom: '25px' }}>Are you sure you need to cancel this trip? The passenger will be notified immediately.</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={closeCancelModal} className="btn" style={{ backgroundColor: '#e5e7eb', color: '#111827', margin: 0, flex: 1 }}>Nevermind</button>
              <button onClick={confirmCancelRide} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', margin: 0, flex: 1 }}>Yes, Cancel Trip</button>
            </div>
          </div>
        </div>
      )}

      {isOtpModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, backdropFilter: 'blur(5px)' }}>
          <div className="glass-card animate-pop" style={{ maxWidth: '350px', width: '90%', textAlign: 'center', padding: '40px', backgroundColor: '#111827', border: '1px solid #374151' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
            <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>Enter Rider PIN</h3>
            <p style={{ color: '#9ca3af', marginBottom: '15px', fontSize: '14px' }}>Ask the passenger for their 4-digit code to verify the trip.</p>
            
            {otpError && (
              <div className="animate-pop" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #f87171' }}>
                {otpError}
              </div>
            )}

            <input 
              type="number" 
              maxLength="4"
              placeholder="0000"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.slice(0, 4))} 
              style={{ width: '100%', padding: '15px', fontSize: '32px', textAlign: 'center', letterSpacing: '10px', borderRadius: '10px', border: '2px solid #3b82f6', backgroundColor: '#1f2937', color: 'white', marginBottom: '20px', outline: 'none' }}
            />

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={closeOtpModal} className="btn" style={{ backgroundColor: '#374151', color: 'white', margin: 0, flex: 1 }}>Cancel</button>
              <button onClick={confirmStartRide} className="btn" style={{ backgroundColor: '#3b82f6', color: 'white', margin: 0, flex: 1 }}>Verify & Start</button>
            </div>
          </div>
        </div>
      )}

      <div className="animate-slide-up delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>Driver Dashboard <span style={{ color: '#ef4444', fontSize: '18px' }}>🔴 LIVE</span></h2>
        
        <button onClick={() => navigate('/profile')} className="btn" style={{ backgroundColor: '#f3f4f6', color: '#111827', border: '2px solid #e5e7eb', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          👤 My Profile
        </button>
      </div>

      {message && (
        <div className="glass-card animate-pop" style={{ backgroundColor: '#fee2e2', borderColor: '#ef4444', padding: '15px', marginBottom: '20px' }}>
          <h4 style={{ color: '#b91c1c', margin: 0, textAlign: 'center' }}>{message}</h4>
        </div>
      )}

      <div className="animate-slide-up delay-1" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
        <div className="glass-card" style={{ flex: 1, minWidth: '150px', borderTop: '5px solid #10b981', textAlign: 'center', backgroundColor: '#ecfdf5' }}>
          <p style={{ margin: '0 0 5px 0', color: '#047857', fontWeight: 'bold', fontSize: '12px' }}>TOTAL EARNINGS</p>
          <h2 style={{ margin: 0, fontSize: '32px', color: '#059669' }}>₹{(stats.totalEarnings || 0).toFixed(2)}</h2>
        </div>

        <div className="glass-card" style={{ flex: 1, minWidth: '150px', borderTop: '5px solid #3b82f6', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', color: '#6b7280', fontWeight: 'bold', fontSize: '12px' }}>TOTAL LIFETIME RIDES</p>
          <h2 style={{ margin: 0, fontSize: '32px', color: '#2563eb' }}>{stats.totalRides}</h2>
        </div>
      </div>

      <h3 className="animate-slide-up delay-2" style={{ marginBottom: '15px', color: '#059669' }}>🚗 My Active Passenger</h3>
      <div className="glass-card animate-slide-up delay-2" style={{ borderTop: '5px solid #10b981', backgroundColor: '#f0fdf4' }}>
        {activeJobs.length === 0 ? <p style={{ color: '#6b7280', margin: 0 }}>You have no active rides right now.</p> : (
          activeJobs.map((job) => (
            <div key={job._id} style={{ backgroundColor: 'white', border: '1px solid #d1fae5', padding: '20px', borderRadius: '12px', marginBottom: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              
              {job.status === 'cancelled' ? (
                <div style={{ padding: '20px', backgroundColor: '#fee2e2', borderRadius: '10px', textAlign: 'center', border: '2px dashed #ef4444' }}>
                  <h3 style={{ color: '#b91c1c', margin: '0 0 10px 0' }}>🚫 RIDE CANCELLED</h3>
                  <p style={{ color: '#991b1b', marginBottom: '15px', fontSize: '15px' }}>The passenger has cancelled this trip. You are free to accept a new ride.</p>
                  <button onClick={() => setActiveJobs(activeJobs.filter(j => j._id !== job._id))} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', maxWidth: '200px', margin: '0 auto' }}>Dismiss Notification</button>
                </div>
              ) : (
                <>
                  {job.pickupCoords && job.pickupCoords.length === 2 && (
                    <div style={{ height: '300px', width: '100%', marginBottom: '20px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
                      <MapContainer center={job.pickupCoords} zoom={9} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={job.pickupCoords} icon={mapPinIcon}><Popup>Pickup: {job.pickupLocation}</Popup></Marker>
                        <Marker position={job.dropoffCoords} icon={mapPinIcon}><Popup>Dropoff: {job.dropoffLocation}</Popup></Marker>
                        {job.stopCoords && job.stopCoords.map((coords, i) => <Marker key={i} position={coords} icon={mapPinIcon}><Popup>Stop {i + 1}</Popup></Marker>)}
                        <Polyline positions={[job.pickupCoords, ...(job.stopCoords || []), job.dropoffCoords]} color="#3b82f6" weight={5} />
                      </MapContainer>
                    </div>
                  )}

                  <p style={{ margin: '0 0 10px 0' }}><strong>🟢 Pickup:</strong> {job.pickupLocation}</p>
                  {job.stops && job.stops.length > 0 && <p style={{ margin: '0 0 10px 0', color: '#d97706' }}><strong>📍 Stops:</strong> {job.stops.join(' ➔ ')}</p>}
                  <p style={{ margin: '0 0 10px 0' }}><strong>🔴 Dropoff:</strong> {job.dropoffLocation}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#4f46e5' }}><strong>📏 Distance:</strong> {job.distanceInKm} km</p>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563', backgroundColor: '#e5e7eb', padding: '4px 8px', borderRadius: '4px' }}>{job.paymentMethod?.toLowerCase() === 'online' ? '💳 Online' : '💵 Cash'}</span>
                  </div>
                  
                  {job.status === 'accepted' && <button onClick={() => handleAction(job._id, 'arrive')} className="btn" style={{ backgroundColor: '#8b5cf6', color: 'white' }}>📍 Arrived at Pickup</button>}
                  
                  {job.status === 'arrived' && <button onClick={() => triggerOtpModal(job._id)} className="btn" style={{ backgroundColor: '#f97316', color: 'white' }}>🚪 Passenger In! Start Ride</button>}
                  
                  {job.status === 'in-progress' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {job.stops && job.stops.length > (job.completedStopsCount || 0) && <button onClick={() => handleAction(job._id, 'pause')} className="btn" style={{ backgroundColor: '#eab308', color: 'black' }}>⏳ Stop & Wait</button>}
                      <button onClick={() => handleAction(job._id, 'complete')} className="btn btn-green" style={{ flex: 2 }}>🏁 Complete Ride</button>
                    </div>
                  )}
                  {job.status === 'waiting-at-stop' && <button onClick={() => handleAction(job._id, 'resume')} className="btn btn-blue">🚗 Passenger Back! Resume Ride</button>}
                  <button onClick={() => triggerCancelModal(job._id)} className="btn" style={{ backgroundColor: 'transparent', border: '2px solid #ef4444', color: '#ef4444', marginTop: '10px' }}>🚫 Cancel Trip</button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <h3 className="animate-slide-up delay-3" style={{ marginTop: '40px', marginBottom: '15px' }}>📡 Available Pickups</h3>
      <div className="glass-card animate-slide-up delay-3" style={{ borderTop: '5px solid #3b82f6' }}>
        {rides.length === 0 ? <p style={{ color: '#6b7280', margin: 0 }}>No rides available right now.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {rides.map((ride) => (
              <div key={ride._id} style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '20px', borderRadius: '12px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}><strong>From:</strong> {ride.pickupLocation}</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}><strong>To:</strong> {ride.dropoffLocation}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <span style={{ fontSize: '14px', color: '#4f46e5', fontWeight: 'bold' }}>{ride.distanceInKm} km</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#059669', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>{ride.paymentMethod?.toLowerCase() === 'online' ? '💳 Online' : '💵 Cash'}</span>
                </div>
                <button onClick={() => handleAction(ride._id, 'accept')} className="btn btn-black" style={{ margin: '0 auto' }}>Accept Trip</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverDashboard;