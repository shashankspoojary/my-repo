const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');

const Ride   = require('../models/Ride');
const User   = require('../models/User');   // Admin accounts still live here
const Rider  = require('../models/Rider');
const Driver = require('../models/Driver');

const protect = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /admin/check-setup
// Returns whether the founding admin account has been created yet.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/check-setup', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        return res.status(200).json({ isSetupComplete: !!adminExists });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /admin/setup  (one-time bootstrap)
// Creates the founding admin account in the legacy User collection.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/setup', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(403).json({ message: '🛑 Access Denied: An Admin already exists.' });
        }

        const { email, password } = req.body;

        const foundingAdmin = new User({
            name:     'Super Admin',
            email,
            password,
            phone:    '0000000000',
            role:     'admin'
        });

        await foundingAdmin.save();
        res.status(201).json({ message: '👑 Founding Admin created successfully! You can now log in.' });

    } catch (error) {
        console.error('🚨 CRITICAL SETUP ERROR:', error);
        res.status(500).json({ message: 'Server error: Check terminal!' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: adminOnly
// Verifies the authenticated user has the admin role.
// ─────────────────────────────────────────────────────────────────────────────
const adminOnly = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (user && user.role === 'admin') {
            return next();
        }
        res.status(401).json({ message: 'Not authorized as an admin.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED: GET /admin/dashboard
// Returns paginated rides + platform stats.
// Now counts riders and drivers from their own separate collections.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', protect, adminOnly, async (req, res) => {
    try {
        const page  = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip  = (page - 1) * limit;

        // Paginated ride list — explicit select ensures paymentMethod &
        // paymentStatus are always returned regardless of future schema changes.
        const paginatedRides = await Ride.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select(
                'pickupLocation dropoffLocation distanceInKm ' +
                'paymentMethod paymentStatus ' +
                'totalFare baseFare status otp ' +
                'rating feedback createdAt ' +
                'vehicleType numberOfTravelers ' +
                'razorpayOrderId razorpayPaymentId'
            );

        const totalRidesCount = await Ride.countDocuments();
        const totalPages      = Math.ceil(totalRidesCount / limit);

        // Revenue & profit calculations — include paymentMethod for future breakdown stats
        const statsRides     = await Ride.find().select('totalFare status paymentMethod paymentStatus');
        const completedRides = statsRides.filter(r => r.status === 'completed');
        const totalRevenue   = completedRides.reduce((acc, r) => acc + (r.totalFare || 0), 0);
        const platformProfit = totalRevenue * 0.20;

        const activeRides = statsRides.filter(r =>
            ['accepted', 'arrived', 'in-progress'].includes(r.status)
        ).length;

        // ── SEPARATE USER COUNTS ──────────────────────────────────────────────
        const [totalRiders, totalDrivers] = await Promise.all([
            Rider.countDocuments(),
            Driver.countDocuments()
        ]);

        res.status(200).json({
            rides: paginatedRides,
            currentPage:    page,
            totalPages:     totalPages || 1,
            totalRevenue,
            platformProfit,
            activeRides,
            totalRides:     totalRidesCount,
            // Replaced the single `totalUsers` with two distinct counts
            totalRiders,
            totalDrivers,
            totalUsers:     totalRiders + totalDrivers  // kept for backward-compat
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching dashboard.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED: GET /admin/riders
// Returns all Rider documents (without passwords).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/riders', protect, adminOnly, async (req, res) => {
    try {
        const riders = await Rider.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json(riders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching riders.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED: GET /admin/drivers
// Returns all Driver documents (without passwords).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/drivers', protect, adminOnly, async (req, res) => {
    try {
        const drivers = await Driver.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json(drivers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching drivers.' });
    }
});

module.exports = router;