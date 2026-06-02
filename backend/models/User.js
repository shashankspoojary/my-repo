const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ['rider', 'driver', 'admin'], default: 'rider' },
    walletBalance: { type: Number, default: 0 },

    // 💡 NEW: Shared Profile Fields (Both Riders and Drivers get these)
    // We provide a default blank avatar so their profile isn't broken when they sign up!
    profilePicture: { 
        type: String, 
        default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' 
    }, 
    averageRating: { type: Number, default: 5.0 },
    totalRatings: { type: Number, default: 0 },

    
    
    createdAt: { type: Date, default: Date.now }
});

// 🔒 SECURITY MAGIC: This automatically scrambles passwords before saving!
userSchema.pre('save', async function() {
    // 💡 THE FIX: If the password didn't change (like when we are just updating a rating), exit immediately without crashing!
    if (!this.isModified('password')) return; 
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);