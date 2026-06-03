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

function Dashboard() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [stops, setStops] = useState([]); 
  const [message, setMessage] = useState('');
  const [myRides, setMyRides] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [vehicleType, setVehicleType] = useState('Car');
  const [timeError, setTimeError] = useState('');   // ← 5-min buffer validation
  const navigate = useNavigate();

  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [stopCoords, setStopCoords] = useState([]); 
  const [tripDistance, setTripDistance] = useState(0);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [rideToCancel, setRideToCancel] = useState(null);
  const [liveAlert, setLiveAlert] = useState(null);

  // Rating Modal State
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [rideToRate, setRideToRate] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');

  // Full-Screen Detail Modal State
  const [detailModalRideId, setDetailModalRideId] = useState(null);
  const activeRideDetail = myRides.find(r => r._id === detailModalRideId);

  // ── DEBUG LOGGING FOR DATA FLOW ──
  useEffect(() => {
    if (activeRideDetail) {
      console.log('🐞 DEBUG [activeRideDetail Update]:', activeRideDetail);
      if (activeRideDetail.status === 'accepted' && !activeRideDetail.driver) {
        console.warn('⚠️ DEBUG: Ride is "accepted" but driver object is missing!', activeRideDetail);
      }
    }
  }, [activeRideDetail]);

  // Phase 3: Payment success toast state
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  useEffect(() => {
    fetchMyRides();
    const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''));
    
    socket.on('rideUpdated', (updatedRide) => {
      console.log('🐞 DEBUG [Socket Event - rideUpdated]:', updatedRide);
      fetchMyRides();
      if (updatedRide) {
        if (updatedRide.status === 'accepted') {
          setLiveAlert("🚕 A Driver accepted your request!");
          setTimeout(() => setLiveAlert(null), 5000);
        } else if (updatedRide.status === 'arrived') {
          setLiveAlert("📍 Your Driver has arrived outside!");
          setTimeout(() => setLiveAlert(null), 5000);
        } else if (updatedRide.status === 'completed' && !updatedRide.rating) {
          setLiveAlert("🏁 You have arrived! Please rate your driver.");
          setTimeout(() => setLiveAlert(null), 4000);
          setDetailModalRideId(null); 
          openRatingModal(updatedRide._id);
        }
      }
    });

    socket.on('rideCancelledByDriver', () => {
      fetchMyRides();
      setLiveAlert("⚠️ The Driver had to cancel the trip. Please request a new ride.");
      setTimeout(() => setLiveAlert(null), 7000);
    });

    return () => socket.disconnect();
  }, []);

  const fetchMyRides = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/rides/my-rides`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setMyRides(response.data.rides);
    } catch (error) { 
      console.error("❌ Error fetching ride history:", error); 
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      return setMessage("❌ Geolocation is not supported by your browser.");
    }
    setMessage("🛰️ Pinpointing your location...");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      setPickupCoords([latitude, longitude]);
      try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        if (res.data && res.data.display_name) {
          const shortAddress = res.data.display_name.split(',').slice(0, 3).join(',');
          setPickup(shortAddress);
          setMessage("📍 Location found!");
        }
      } catch (error) {
        setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setMessage("📍 Coordinates set!");
      }
    }, () => {
      setMessage("❌ Permission denied. Please enable location.");
    });
  };

  // ── 5-Minute Booking Buffer Helpers ──────────────────────────────────────────

  /**
   * Returns the datetime-local string for (now + 5 minutes).
   * Used as both the `min` attribute and the validation threshold.
   */
  const getMinDateTime = () => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    // Format: YYYY-MM-DDTHH:MM  (no seconds — matches datetime-local value)
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /**
   * Validates the selected datetime whenever the user changes the picker.
   * Sets timeError if the chosen time is < now + 5 minutes.
   */
  const handleTimeChange = (e) => {
    const selected = e.target.value;
    setScheduledFor(selected);

    if (!selected) { setTimeError(''); return; }

    const selectedMs  = new Date(selected).getTime();
    const minAllowed  = Date.now() + 5 * 60 * 1000;
    if (selectedMs < minAllowed) {
      setTimeError('❌ Bookings must be scheduled at least 5 minutes in advance.');
    } else {
      setTimeError('');
    }
  };

  const handleAddStop = () => setStops([...stops, '']);
  const handleStopChange = (index, value) => { const newStops = [...stops]; newStops[index] = value; setStops(newStops); };
  const handleRemoveStop = (index) => setStops(stops.filter((_, i) => i !== index));

  const getCoordinates = async (address) => {
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${address}, India`);
      if (res.data && res.data.length > 0) return [parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)];
      return null;
    } catch (error) { return null; }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1)); 
  };

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      let totalDist = 0;
      const allPoints = [pickupCoords, ...stopCoords, dropoffCoords];
      for (let i = 0; i < allPoints.length - 1; i++) totalDist += calculateDistance(allPoints[i][0], allPoints[i][1], allPoints[i+1][0], allPoints[i+1][1]);
      setTripDistance(totalDist.toFixed(1));
      setMessage(`📍 Route adjusted! Total Distance: ${totalDist.toFixed(1)} km`);
    }
  }, [pickupCoords, dropoffCoords, stopCoords]);

  // ============================================================
  // Phase 3: Razorpay Helpers
  // ============================================================

  // Dynamically injects the Razorpay checkout.js SDK once per session.
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById('razorpay-checkout-js')) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.id  = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload  = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Orchestrates the full Online payment flow:
  //  1. Creates a Razorpay order on our backend
  //  2. Opens the Razorpay modal
  //  3. On success → calls /verify, updates ride, shows toast
  //  Returns { success: true, rideId } on completion, or throws on failure.
  const handleRazorpayPayment = (rideId, amountInRupees) => {
    return new Promise(async (resolve, reject) => {
      const token = localStorage.getItem('token');

      // Load SDK
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        return reject(new Error('❌ Failed to load Razorpay SDK. Check your internet connection.'));
      }

      // Create order on backend (amount in paise)
      let orderData;
      try {
        const orderRes = await axios.post(
          `${process.env.REACT_APP_API_URL}/payments/create-order`,
          { amount: Math.round(amountInRupees * 100), rideId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        orderData = orderRes.data;
      } catch (err) {
        return reject(new Error(err.response?.data?.message || '❌ Could not create payment order.'));
      }

      // Open Razorpay modal
      const options = {
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'SmartRide',
        description: 'Ride Booking Payment',
        order_id:    orderData.orderId,
        // Handler called by Razorpay on successful payment
        handler: async (paymentResponse) => {
          try {
            const verifyRes = await axios.post(
              `${process.env.REACT_APP_API_URL}/payments/verify`,
              {
                razorpay_order_id:   paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature:  paymentResponse.razorpay_signature,
                rideId,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (verifyRes.data.success) {
              // Show payment success toast for 5 s
              setPaymentSuccess(`💳 Payment of ₹${amountInRupees} confirmed! ID: ${paymentResponse.razorpay_payment_id.slice(-8).toUpperCase()}`);
              setTimeout(() => setPaymentSuccess(null), 6000);
              resolve({ success: true, rideId });
            } else {
              reject(new Error('❌ Payment verification failed. Contact support.'));
            }
          } catch (verifyErr) {
            reject(new Error(verifyErr.response?.data?.message || '❌ Verification error.'));
          }
        },
        prefill: {
          name:  localStorage.getItem('userName') || '',
          email: localStorage.getItem('userEmail') || '',
        },
        theme: { color: '#3b82f6' },
        modal: {
          ondismiss: () => reject(new Error('⚠️ Payment cancelled by user.')),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        reject(new Error(`❌ Payment failed: ${response.error.description}`));
      });
      rzp.open();
    });
  };


  const handlePreviewRoute = async (e) => {
    e.preventDefault();
    setMessage('🌍 Finding coordinates...');
    const pCoords = await getCoordinates(pickup);
    const dCoords = await getCoordinates(dropoff);
    const sCoords = [];
    for (let stop of stops) {
      if (stop.trim() !== '') { const coords = await getCoordinates(stop); if (coords) sCoords.push(coords); }
    }
    if (pCoords && dCoords) { setPickupCoords(pCoords); setDropoffCoords(dCoords); setStopCoords(sCoords); } 
    else { setMessage('❌ City not found. Try a nearby city, then drag the pins!'); }
  };


  const handleBookRide = async () => {
    const token = localStorage.getItem('token');
    if (!token) return setMessage('❌ Access Denied.');

    if (!scheduledFor) {
      return setMessage('⚠️ Please select a Date and Time for your pickup before booking.');
    }

    // ── 5-Minute Buffer Check (guard against keyboard/programmatic submission) ──
    const selectedMs = new Date(scheduledFor).getTime();
    const minAllowed = Date.now() + 5 * 60 * 1000;
    if (selectedMs < minAllowed) {
      setTimeError('❌ Bookings must be scheduled at least 5 minutes in advance.');
      return;
    }

    // ── ONLINE PAYMENT: run Razorpay checkout BEFORE creating the ride ──
    // We estimate fare at ₹15/km as a booking deposit.
    // The final authoritative fare is computed server-side on ride completion.
    if (paymentMethod === 'Online') {
      const estimatedFare = Math.max(Math.round(tripDistance * 15), 50); // minimum ₹50
      setMessage('⏳ Opening payment gateway…');
      try {
        // Step 1: create a temporary placeholder ride to get a rideId
        const validStops = stops.filter(s => s.trim() !== '');
        const bookRes = await axios.post(
          `${process.env.REACT_APP_API_URL}/rides/book`,
          {
            pickupLocation:   pickup,
            dropoffLocation:  dropoff,
            scheduledFor,
            stops:            validStops,
            distance:         tripDistance,
            pickupCoords,
            dropoffCoords,
            stopCoords,
            paymentMethod,
            numberOfTravelers,
            vehicleType,
            paymentStatus:    'Pending', // will be updated to Completed after verify
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const newRideId = bookRes.data.ride._id;

        // Step 2: open Razorpay modal; verify on success
        await handleRazorpayPayment(newRideId, estimatedFare);

        setMessage('🚕 Ride booked and payment confirmed!');
      } catch (err) {
        // If payment was cancelled or failed, show the error message
        setMessage(err.message || '❌ Payment was not completed.');
        fetchMyRides(); // refresh in case ride was partially created
        return;
      }
    } else {
      // ── CASH PAYMENT: book ride directly ─────────────────────────────
      try {
        const validStops = stops.filter(s => s.trim() !== '');
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/rides/book`,
          {
            pickupLocation:   pickup,
            dropoffLocation:  dropoff,
            scheduledFor,
            stops:            validStops,
            distance:         tripDistance,
            pickupCoords,
            dropoffCoords,
            stopCoords,
            paymentMethod,
            numberOfTravelers,
            vehicleType,
            paymentStatus:    'Pending',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage('🚕 ' + response.data.message);
      } catch (error) {
        setMessage('❌ Failed to book ride');
        return;
      }
    }

    // ── Reset form state on success ───────────────────────────────────
    setPickup(''); setDropoff(''); setScheduledFor(''); setStops([]);
    setPickupCoords(null); setDropoffCoords(null); setStopCoords([]); setTripDistance(0);
    setPaymentMethod('Cash'); setNumberOfTravelers(1); setVehicleType('Car');
    fetchMyRides();
  };

  const triggerCancelModal = (rideId) => { setDetailModalRideId(null); setRideToCancel(rideId); setIsCancelModalOpen(true); };
  const closeCancelModal = () => { setIsCancelModalOpen(false); setRideToCancel(null); };
  
  const confirmCancelRide = async () => {
    if (!rideToCancel) return;
    const token = localStorage.getItem('token');
    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/rides/${rideToCancel}/cancel-by-rider`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('✅ ' + res.data.message);
      fetchMyRides(); closeCancelModal();
    } catch (error) { setMessage('❌ Failed to cancel'); closeCancelModal(); }
  };

  const triggerDeleteModal = (rideId) => { setDetailModalRideId(null); setRideToDelete(rideId); setIsDeleteModalOpen(true); };
  const cancelDelete = () => { setIsDeleteModalOpen(false); setRideToDelete(null); };
  const confirmDelete = async () => {
    if (!rideToDelete) return;
    const token = localStorage.getItem('token');
    try { 
      await axios.delete(`${process.env.REACT_APP_API_URL}/rides/${rideToDelete}`, { headers: { Authorization: `Bearer ${token}` } }); 
      fetchMyRides(); 
      setIsDeleteModalOpen(false); 
      setRideToDelete(null); 
    } 
    catch (error) { console.error('Failed to delete ride'); }
  };
  
  const openRatingModal = (rideId) => { 
    setDetailModalRideId(null); 
    setRideToRate(rideId); 
    setRatingValue(0); 
    setRatingFeedback(''); 
    setIsRatingModalOpen(true); 
  };
  const closeRatingModal = () => { setIsRatingModalOpen(false); setRideToRate(null); };

  const submitRating = async () => {
    if (ratingValue === 0) return setMessage('⚠️ Please select a star rating.');
    
    const token = localStorage.getItem('token');
    const apiBase = process.env.REACT_APP_API_URL;

    console.log("⭐ Attempting to rate ride:", rideToRate);

    try {
      const res = await axios.post(
        `${apiBase}/rides/${rideToRate}/rate`, 
        { 
          rating: ratingValue, 
          feedback: ratingFeedback 
        }, 
        { 
          headers: { Authorization: `Bearer ${token}` } 
        }
      );

      console.log("✅ Server Response:", res.data);
      setMessage('🌟 ' + res.data.message);
      
      fetchMyRides(); 
      closeRatingModal();
    } catch (error) { 
      console.error("❌ RATING ERROR:", error.response?.data || error.message);
      setMessage('❌ ' + (error.response?.data?.message || 'Failed to save rating')); 
    }
  };

  console.log("RIDE DATA RECEIVED:", myRides, activeRideDetail);
  return (
    <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>

      {/* ── PAYMENT SUCCESS TOAST (Phase 3) ─────────────────────────────── */}
      {paymentSuccess && (
        <div
          className="animate-slide-up"
          style={{
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white', padding: '16px 32px', borderRadius: '30px',
            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.45)',
            zIndex: 11000, fontWeight: 'bold', fontSize: '15px',
            display: 'flex', alignItems: 'center', gap: '10px',
            whiteSpace: 'nowrap',
          }}
        >
          ✅ {paymentSuccess}
        </div>
      )}

      {/* ── LIVE ALERT TOAST ────────────────────────────────────────────── */}
      {liveAlert && (
        <div className="animate-slide-up" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#111827', color: 'white', padding: '15px 30px', borderRadius: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 10000, fontWeight: 'bold' }}>
          🔔 {liveAlert}
        </div>
      )}

      {/* RATING MODAL */}
      {isRatingModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-pop" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '40px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Rate Your Driver</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>How was your trip?</p>
            
            <div style={{ fontSize: '40px', marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span 
                  key={star}
                  onClick={() => setRatingValue(star)}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  style={{ cursor: 'pointer', color: (ratingHover || ratingValue) >= star ? '#f59e0b' : '#e5e7eb', transition: 'color 0.2s' }}
                >
                  ★
                </span>
              ))}
            </div>
            
            <textarea 
              placeholder="Leave some feedback (optional)..." 
              value={ratingFeedback}
              onChange={(e) => setRatingFeedback(e.target.value)}
              style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #e5e7eb', marginBottom: '20px', minHeight: '80px', fontFamily: 'inherit', resize: 'none' }}
            />
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={closeRatingModal} className="btn" style={{ backgroundColor: '#e5e7eb', color: '#111827', flex: 1, margin: 0 }}>Cancel</button>
              <button onClick={submitRating} className="btn btn-blue" style={{ flex: 1, margin: 0 }}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {isCancelModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-pop" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '40px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Cancel Trip?</h3>
            <p style={{ color: '#4b5563', marginBottom: '25px' }}>Are you sure you want to cancel this ride?</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={closeCancelModal} className="btn" style={{ backgroundColor: '#e5e7eb', color: '#111827', flex: 1, margin: 0 }}>Nevermind</button>
              <button onClick={confirmCancelRide} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', flex: 1, margin: 0 }}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-pop" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '40px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Delete Record?</h3>
            <p style={{ color: '#4b5563', marginBottom: '25px' }}>This will permanently hide the ride from your history.</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={cancelDelete} className="btn" style={{ backgroundColor: '#e5e7eb', color: '#111827', flex: 1, margin: 0 }}>Nevermind</button>
              <button onClick={confirmDelete} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', flex: 1, margin: 0 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* THE MASTER RIDE DETAIL MODAL */}
      {detailModalRideId && activeRideDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9000, backdropFilter: 'blur(5px)' }}>
          <div className="glass-card animate-pop" style={{ maxWidth: '450px', width: '90%', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'white', position: 'relative', padding: '30px', borderRadius: '16px' }}>
            
            <button onClick={() => setDetailModalRideId(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}>✖</button>

            <h2 style={{ marginTop: 0, borderBottom: '2px solid #e5e7eb', paddingBottom: '15px' }}>📝 Trip Details</h2>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: activeRideDetail.status === 'completed' ? '#d1fae5' : activeRideDetail.status === 'cancelled' ? '#fee2e2' : '#dbeafe', color: activeRideDetail.status === 'completed' ? '#065f46' : activeRideDetail.status === 'cancelled' ? '#991b1b' : '#1e40af' }}>
                Status: {activeRideDetail.status}
              </span>
            </div>

            {/* ── DRIVER DETAILS CARD — shown whenever a driver is assigned ── */}
            {activeRideDetail.driver && (['accepted', 'arrived', 'in-progress', 'waiting-at-stop'].includes(activeRideDetail.status)) && (
              <div
                className="animate-pop"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
                  padding: '20px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 8px 24px rgba(30, 64, 175, 0.35)',
                }}
              >
                {/* Header label */}
                <p style={{ margin: '0 0 14px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7, fontWeight: 'bold' }}>
                  🚗 Your Driver
                </p>

                {/* Avatar + name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  <img
                    src={activeRideDetail.driver.profilePicture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                    alt="Driver"
                    style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '18px' }}>
                      {activeRideDetail.driver.username || activeRideDetail.driver.name || 'Driver'}
                    </p>
                    {/* Star rating row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#fbbf24', fontSize: '15px' }}>⭐</span>
                      <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                        {activeRideDetail.driver.averageRating ? activeRideDetail.driver.averageRating.toFixed(1) : '5.0'}
                      </span>
                      <span style={{ fontSize: '12px', opacity: 0.6 }}>rating</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginBottom: '14px' }} />

                {/* Vehicle info */}
                {activeRideDetail.driver.vehicle && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.65 }}>Vehicle</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {/* Make + Model + Color */}
                      {(activeRideDetail.driver.vehicle.make || activeRideDetail.driver.vehicle.model) && (
                        <span style={{
                          backgroundColor: 'rgba(255,255,255,0.15)', padding: '5px 12px',
                          borderRadius: '20px', fontSize: '13px', fontWeight: '600'
                        }}>
                          🚘 {[activeRideDetail.driver.vehicle.color, activeRideDetail.driver.vehicle.make, activeRideDetail.driver.vehicle.model].filter(Boolean).join(' ')}
                        </span>
                      )}
                      {/* Plate number — most important for identification */}
                      {activeRideDetail.driver.vehicle.licensePlate && (
                        <span style={{
                          backgroundColor: '#fbbf24', color: '#1c1917',
                          padding: '5px 14px', borderRadius: '20px',
                          fontSize: '14px', fontWeight: '800', letterSpacing: '1px'
                        }}>
                          🔢 {activeRideDetail.driver.vehicle.licensePlate.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Vehicle Type (e.g. Car, Auto, Bike) */}
                {activeRideDetail.driver.vehicleType && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.65 }}>
                      Vehicle Type
                    </p>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      backgroundColor: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                      padding: '7px 16px', borderRadius: '10px',
                      fontWeight: '700', fontSize: '15px', letterSpacing: '0.5px',
                      border: '1.5px solid rgba(251,191,36,0.45)',
                    }}>
                      🚗 {activeRideDetail.driver.vehicleType}
                    </div>
                  </div>
                )}

                {/* Vehicle Registration Number (vehicleNumber field) */}
                {activeRideDetail.driver.vehicleNumber && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.65 }}>
                      Vehicle Licence Number
                    </p>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      backgroundColor: '#1c1917', color: '#fbbf24',
                      padding: '8px 18px', borderRadius: '10px',
                      fontWeight: '900', fontSize: '17px', letterSpacing: '3px',
                      border: '2px solid #fbbf24',
                      boxShadow: '0 2px 12px rgba(251,191,36,0.25)'
                    }}>
                      🪪 {activeRideDetail.driver.vehicleNumber}
                    </div>
                  </div>
                )}


                {/* Phone number — tap to call */}
                {activeRideDetail.driver.phone && (
                  <a
                    href={`tel:+91${activeRideDetail.driver.phone}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '12px', padding: '12px 16px',
                      textDecoration: 'none', color: 'white',
                      border: '1px solid rgba(255,255,255,0.2)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>📞</span>
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', opacity: 0.65, textTransform: 'uppercase', letterSpacing: '1px' }}>Tap to Call Driver</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px' }}>+91 {activeRideDetail.driver.phone}</p>
                    </div>
                  </a>
                )}
              </div>
            )}

            {activeRideDetail.status === 'arrived' && activeRideDetail.otp && (
              <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', padding: '25px', borderRadius: '16px', textAlign: 'center', marginBottom: '20px', color: 'white' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>🔐 Security PIN</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  {String(activeRideDetail.otp).split('').map((digit, i) => (
                    <div key={i} style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '60px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                      <h1 style={{ margin: 0, fontSize: '42px' }}>{digit}</h1>
                    </div>
                  ))}
                </div>
                <p style={{ margin: '15px 0 0 0', fontSize: '14px' }}>Give this code to your driver</p>
              </div>
            )}

            <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 10px 0' }}><strong>🟢 From:</strong> {activeRideDetail.pickupLocation}</p>
              <p style={{ margin: 0 }}><strong>🔴 To:</strong> {activeRideDetail.dropoffLocation}</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
              {(activeRideDetail.status === 'pending' || activeRideDetail.status === 'accepted') && (
                <button onClick={() => triggerCancelModal(activeRideDetail._id)} className="btn" style={{ flex: '1 1 45%', backgroundColor: '#fef08a', color: '#854d0e', margin: 0 }}>🚫 Cancel Ride</button>
              )}
              {activeRideDetail.status === 'completed' && !activeRideDetail.rating && (
                <button onClick={() => openRatingModal(activeRideDetail._id)} className="btn btn-blue" style={{ flex: '1 1 45%', margin: 0 }}>⭐ Rate Driver</button>
              )}
              {(activeRideDetail.status === 'completed' || activeRideDetail.status === 'cancelled') && (
                <button onClick={() => triggerDeleteModal(activeRideDetail._id)} className="btn" style={{ flex: '1 1 45%', backgroundColor: '#fee2e2', color: '#ef4444', margin: 0 }}>🗑️ Delete Record</button>
              )}
              <button onClick={() => setDetailModalRideId(null)} className="btn" style={{ flex: '1 1 100%', backgroundColor: '#e5e7eb', color: '#111827', margin: 0, fontWeight: 'bold' }}>✖ Close Window</button>
            </div>

          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="animate-slide-up delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0 }}>Where to, Ride?</h2>
        <button onClick={() => navigate('/profile')} className="btn" style={{ backgroundColor: '#f3f4f6', color: '#111827', margin: 0 }}>👤 Profile</button>
      </div>
      
      {/* MAP AND BOOKING SECTION */}
      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        <div className="glass-card animate-slide-up delay-2" style={{ flex: 1, minWidth: '300px' }}>
          <h3>Plan Your Trip</h3>
          <form onSubmit={handlePreviewRoute} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Pickup Address - free text */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="📍 Pickup Address (e.g. 12 MG Road, Mumbai)"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                required
                style={{ paddingRight: '45px' }}
              />
              <button type="button" onClick={handleUseCurrentLocation} title="Use Current Location" style={{ position: 'absolute', right: '10px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>📍</button>
            </div>

            {stops.map((stop, index) => (
              <div key={index} style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder={`Stop ${index + 1}`} value={stop} onChange={(e) => handleStopChange(index, e.target.value)} required style={{ border: '2px solid #f59e0b' }} />
                <button type="button" onClick={() => handleRemoveStop(index)} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', flex: '0 0 50px', padding: 0 }}>X</button>
              </div>
            ))}
            <button type="button" onClick={handleAddStop} className="btn" style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '2px dashed #f59e0b', margin: '0 0 15px 0' }}>+ Add Stop</button>

            {/* Dropoff Address */}
            <input type="text" placeholder="🔴 Dropoff Address (e.g. Airport Terminal 2, Delhi)" value={dropoff} onChange={(e) => setDropoff(e.target.value)} required />

            {/* Number of Travelers */}
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '4px 0 2px 2px' }}>👥 Number of Travelers</label>
            <input
              type="number"
              min="1"
              max="10"
              value={numberOfTravelers}
              onChange={(e) => setNumberOfTravelers(Number(e.target.value))}
              style={{ marginBottom: '8px' }}
            />

            {/* Vehicle Type */}
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '4px 0 2px 2px' }}>🚗 Choose Vehicle Type</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              style={{ marginBottom: '8px' }}
            >
              <option value="Car">🚗 Car</option>
              <option value="Auto">🛺 Auto</option>
              <option value="Bike">🏍️ Bike</option>
              <option value="Other">🚌 Other</option>
            </select>

            {/* Payment Method */}
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '4px 0 4px 2px' }}>💳 Payment Method</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              {['Cash', 'Online'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: paymentMethod === method ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                    backgroundColor: paymentMethod === method ? '#eff6ff' : '#f9fafb',
                    color: paymentMethod === method ? '#1d4ed8' : '#374151',
                    fontWeight: paymentMethod === method ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px'
                  }}
                >
                  {method === 'Cash' ? '💵 Cash' : '💳 Online'}
                </button>
              ))}
            </div>

            {/* Date & Time Picker — min enforces now+5 min to block past/near times */}
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '4px 0 2px 2px' }}>📅 Pickup Date & Time</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={handleTimeChange}
              min={getMinDateTime()}
            />
            {timeError && (
              <p style={{
                margin: '4px 0 8px 2px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#dc2626',
              }}>
                {timeError}
              </p>
            )}

            <button type="submit" className="btn btn-blue">🌍 Drop Pins on Map</button>
          </form>

          {tripDistance > 0 && (
            <div className="animate-pop" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#065f46' }}>📏 Estimated Distance: <strong>{tripDistance} km</strong></p>
              <button onClick={handleBookRide} className="btn btn-green">✅ Request Ride</button>
            </div>
          )}
          <p style={{ textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>{message}</p>
        </div>

        <div className="glass-card animate-slide-up delay-2" style={{ flex: 1.5, minWidth: '300px', padding: '10px' }}>
          <MapContainer center={pickupCoords || [20.5937, 78.9629]} zoom={pickupCoords ? 10 : 5} style={{ height: '500px', width: '100%', borderRadius: '10px' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pickupCoords && <Marker position={pickupCoords} icon={mapPinIcon} draggable eventHandlers={{ dragend: (e) => setPickupCoords([e.target.getLatLng().lat, e.target.getLatLng().lng]) }} />}
            {dropoffCoords && <Marker position={dropoffCoords} icon={mapPinIcon} draggable eventHandlers={{ dragend: (e) => setDropoffCoords([e.target.getLatLng().lat, e.target.getLatLng().lng]) }} />}
            {pickupCoords && dropoffCoords && <Polyline positions={[pickupCoords, ...stopCoords, dropoffCoords]} color="#3b82f6" />}
          </MapContainer>
        </div>
      </div>

      {/* RIDE HISTORY GRID */}
      <div className="animate-slide-up delay-3">
        <h3 style={{ marginTop: '40px' }}>My Ride History</h3>
        {myRides.length === 0 ? <p>No rides yet!</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {myRides.map((ride) => (
              <div key={ride._id} className="glass-card ride-card-hover" onClick={() => setDetailModalRideId(ride._id)} style={{ padding: '20px', cursor: 'pointer', borderLeft: ride.status === 'completed' ? '5px solid #10b981' : '5px solid #3b82f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '10px' }}>
                  <span>{new Date(ride.createdAt).toLocaleDateString()}</span>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{ride.status}</span>
                </div>
                <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}><strong>🟢</strong> {ride.pickupLocation}</p>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}><strong>🔴</strong> {ride.dropoffLocation}</p>
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '10px', textAlign: 'center', fontSize: '12px', color: '#6366f1' }}>Tap for details →</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;