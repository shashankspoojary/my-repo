import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Profile() {
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    profilePicture: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    try {
      // 💡 FIXED: Replaced hardcoded URL with environment variable
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
      setFormData({
        name: res.data.name || '',
        profilePicture: res.data.profilePicture || ''
      });
    } catch (error) {
      setMessage('❌ Failed to load profile.');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 💡 PRO TIP: I updated this to 10MB to match your backend limits!
      if (file.size > 10000000) {
        setMessage('❌ Image is too large! Please choose a picture under 10MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePicture: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePicture = () => {
    setFormData({ ...formData, profilePicture: '' });
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    setMessage('Saving...');
    
    const updatePayload = {
      name: formData.name,
      profilePicture: formData.profilePicture 
    };

    try {
      // 💡 FIXED: Replaced hardcoded URL with environment variable
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/auth/update-profile`, updatePayload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data.user);
      setIsEditing(false);
      setMessage('✅ Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Failed to update profile.');
    }
  };

  if (!user) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading Profile...</div>;

  const displayPicture = isEditing 
    ? (formData.profilePicture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png') 
    : (user.profilePicture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png');

  return (
    <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* ── Page Title — perfectly centred using 3-column grid ── */}
      <div
        className="animate-slide-up"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          marginBottom: '30px',
        }}
      >
        {/* Left cell — empty, acts as a spacer to push the title to the true centre */}
        <div />
        <h2 style={{ margin: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>My Profile</h2>
        {/* Right cell — empty */}
        <div />
      </div>

      {message && (
        <div className="glass-card animate-pop" style={{ textAlign: 'center', backgroundColor: message.includes('✅') ? '#d1fae5' : '#fee2e2', color: message.includes('✅') ? '#065f46' : '#b91c1c', padding: '10px', marginBottom: '20px' }}>
          {message}
        </div>
      )}

      <div className="glass-card animate-slide-up delay-1" style={{ borderTop: user.role === 'driver' ? '5px solid #f59e0b' : '5px solid #3b82f6' }}>
        
        {/* Avatar Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
          
          <input type="file" id="profilePicInput" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} disabled={!isEditing} />

          <label htmlFor="profilePicInput" style={{ cursor: isEditing ? 'pointer' : 'default', position: 'relative' }}>
            <img 
              src={displayPicture} 
              alt="Profile Avatar" 
              style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', opacity: isEditing ? 0.8 : 1, transition: '0.2s', backgroundColor: '#f3f4f6' }}
              onError={(e) => e.target.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
            />
            {isEditing && (
              <div className="animate-pop" style={{ position: 'absolute', bottom: '5px', right: '5px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', border: '2px solid white' }}>
                📷
              </div>
            )}
          </label>

          {isEditing && formData.profilePicture && (
            <button 
              onClick={handleRemovePicture} 
              className="animate-pop" 
              style={{ marginTop: '15px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🗑️ Remove Picture
            </button>
          )}

          <span style={{ marginTop: '15px', textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '4px 12px', borderRadius: '20px' }}>
            {user.role} Account
          </span>

          {user.role === 'driver' && (
            <div className="animate-pop" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '15px', backgroundColor: '#fffbeb', padding: '8px 16px', borderRadius: '20px', border: '1px solid #fde68a' }}>
              <span style={{ fontSize: '18px', color: '#d97706' }}>⭐</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#b45309' }}>
                {user.averageRating ? user.averageRating.toFixed(1) : '5.0'}
              </span>
              <span style={{ fontSize: '12px', color: '#d97706', marginLeft: '5px', fontWeight: 'bold' }}>
                ({user.totalRatings || 0} reviews)
              </span>
            </div>
          )}
        </div>

        {/* Basic Info Section */}
        <h4 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px', color: '#374151' }}>Personal Details</h4>
        <div style={{ display: 'grid', gap: '15px', marginBottom: '30px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>FULL NAME</label>
            {isEditing ? (
              <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
            ) : (
              <p style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: '600' }}>{user.name}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>EMAIL</label>
              <p style={{ margin: '5px 0 0 0', color: '#4b5563', fontSize: '14px' }}>{user.email}</p>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>PHONE</label>
              <p style={{ margin: '5px 0 0 0', color: '#4b5563', fontSize: '14px' }}>+91 {user.phone}</p>
            </div>
          </div>
        </div>

        {/* ── Primary Action Buttons (Edit / Save / Cancel) ── */}
        <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); setFormData({name: user.name, profilePicture: user.profilePicture || ''}); }} className="btn" style={{ backgroundColor: '#e5e7eb', color: '#111827', margin: 0, flex: 1 }}>Cancel</button>
              <button onClick={handleSave} className="btn btn-blue" style={{ margin: 0, flex: 2 }}>💾 Save Changes</button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="btn" style={{ backgroundColor: '#111827', color: 'white', margin: 0, width: '100%' }}>✏️ Edit Profile</button>
          )}
        </div>

        {/* ── Back Button — sits clearly below all inputs and action buttons ── */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f3f4f6' }}>
          <button
            onClick={() => navigate(-1)}
            className="btn"
            style={{ backgroundColor: '#f3f4f6', color: '#374151', margin: 0, width: '100%', border: '1px solid #e5e7eb', fontWeight: '600' }}
          >
            ← Back
          </button>
        </div>

      </div>
    </div>
  );
}

export default Profile;