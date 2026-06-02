const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const riderSchema = new mongoose.Schema({
    // username: ONLY alphabetic characters (A-Z, a-z). No numbers, spaces, or special characters.
    username: {
        type: String,
        required: [true, 'Username is required.'],
        unique: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^[A-Za-z]+$/.test(v);
            },
            message: 'Username must contain only alphabetic characters (A-Z, a-z). No numbers, spaces, or special characters are allowed.'
        }
    },

    // Standard alphanumeric email
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        trim: true,
        lowercase: true
    },

    password: { type: String, required: [true, 'Password is required.'] },
    phone:    { type: String, required: [true, 'Phone number is required.'] },

    // Profile fields
    profilePicture: {
        type: String,
        default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
    },
    averageRating: { type: Number, default: 5.0 },
    totalRatings:  { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving if it was modified
riderSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('Rider', riderSchema);
