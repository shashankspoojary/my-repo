const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
    
    pickupLocation: { type: String, required: true }, // Free-text full address
    dropoffLocation: { type: String, required: true },
    stops: [{ type: String }], 
    scheduledFor: { type: Date }, 

    // Exact GPS Coordinates for the Driver's map
    pickupCoords: { type: [Number] },
    dropoffCoords: { type: [Number] },
    stopCoords: { type: [[Number]] }, 
    distanceInKm: { type: Number, default: 0 }, 

    // The 4-digit Ride Security PIN
    otp: { type: String }, 

    // Post-Ride Rating System
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String },

    // 💡 NEW: Soft-Delete Flags (Hides the ride without deleting it from the database)
    riderClearedHistory: { type: Boolean, default: false },
    driverClearedHistory: { type: Boolean, default: false },

    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'arrived', 'in-progress', 'waiting-at-stop', 'completed', 'cancelled'], 
        default: 'pending' 
    },
    
    currentWaitStartTime: { type: Date }, 
    totalWaitTimeMinutes: { type: Number, default: 0 }, 
    completedStopsCount: { type: Number, default: 0 }, 

    // Phase 2: New booking fields
    numberOfTravelers: { type: Number, required: true, default: 1 },
    vehicleType: { type: String, required: true, enum: ['Car', 'Auto', 'Bike', 'Other'], default: 'Car' },

    baseFare: { type: Number },
    waitingFare: { type: Number, default: 0 }, 
    totalFare: { type: Number },
    paymentMethod: { type: String, required: true, enum: ['Online', 'Cash'], default: 'Cash' },
    paymentStatus: { type: String, required: true, enum: ['Pending', 'Completed'], default: 'Pending' },
    // Phase 3: Razorpay transaction references (populated after successful payment verification)
    razorpayOrderId:   { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ride', rideSchema);