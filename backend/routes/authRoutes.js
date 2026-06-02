const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const Rider  = require('../models/Rider');
const Driver = require('../models/Driver');
// User is kept for admin look-ups (admin accounts still live in the User collection)
const User   = require('../models/User');

const protect = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: resolve the correct Mongoose model from a role string
// ─────────────────────────────────────────────────────────────────────────────
function modelForRole(role) {
    if (role === 'rider')  return Rider;
    if (role === 'driver') return Driver;
    return null; // admin is handled via User
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/register
// Body: { username, email, password, phone, role }
// role must be 'rider' or 'driver' (admin accounts are seeded via /admin/setup)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, phone, role } = req.body;

        // 1. Role guard — only riders and drivers can self-register
        if (!role || !['rider', 'driver'].includes(role)) {
            return res.status(400).json({ message: 'Role must be either "rider" or "driver".' });
        }

        // 2. Username format: alphabetic characters only
        const usernameRegex = /^[A-Za-z]+$/;
        if (!username || !usernameRegex.test(username)) {
            return res.status(400).json({
                message: 'Username must contain only alphabetic characters (A-Z, a-z). No numbers, spaces, or special characters are allowed.'
            });
        }

        // 3. Phone: 10-digit Indian number
        const phoneRegex = /^\d{10}$/;
        if (!phone || !phoneRegex.test(phone.toString())) {
            return res.status(400).json({ message: 'Please enter a valid 10-digit phone number.' });
        }

        // 4. Password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!password || !passwordRegex.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.'
            });
        }

        // 5. Select the correct collection
        const Model = modelForRole(role);

        // 6. Duplicate-email check within the same collection
        const existingByEmail = await Model.findOne({ email });
        if (existingByEmail) {
            return res.status(400).json({ message: `A ${role} with this email already exists.` });
        }

        // 7. Duplicate-username check within the same collection
        const existingByUsername = await Model.findOne({ username });
        if (existingByUsername) {
            return res.status(400).json({ message: `The username "${username}" is already taken.` });
        }

        // 8. Create and persist the new document
        const newAccount = new Model({ username, email, password, phone });
        await newAccount.save();

        res.status(201).json({
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully!`,
            user: {
                id:       newAccount._id,
                username: newAccount.username,
                email:    newAccount.email,
                role
            }
        });

    } catch (error) {
        console.error('Error during registration:', error);

        // Surface Mongoose validation errors cleanly
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message).join(' ');
            return res.status(400).json({ message: messages });
        }

        res.status(500).json({ message: 'Server error while registering.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// Body: { email, password, role? }
//
// Resolution order for an explicit role ('rider' | 'driver'):
//   1. Query the matching collection (Rider / Driver).
//   2. ADMIN FALLBACK — if no document was found in step 1, immediately query
//      the legacy User collection for an admin with that email.
//   3. Verify password with bcrypt.
//   4. Sign JWT with the *resolved* role and return.
//
// This means an administrator can submit the login form with any toggle value
// and will still be authenticated correctly as 'admin'.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        let user         = null;
        let resolvedRole = role || null; // will be set to the actual role once found

        // ── STEP 1: Query the collection that matches the submitted role ────────
        if (role === 'admin') {
            user = await User.findOne({ email, role: 'admin' });

        } else if (role === 'rider') {
            user = await Rider.findOne({ email });

        } else if (role === 'driver') {
            user = await Driver.findOne({ email });

        } else {
            // No role submitted — probe every collection in priority order
            const riderCandidate = await Rider.findOne({ email });
            if (riderCandidate) { user = riderCandidate; resolvedRole = 'rider'; }

            if (!user) {
                const driverCandidate = await Driver.findOne({ email });
                if (driverCandidate) { user = driverCandidate; resolvedRole = 'driver'; }
            }

            if (!user) {
                const adminCandidate = await User.findOne({ email, role: 'admin' });
                if (adminCandidate) { user = adminCandidate; resolvedRole = 'admin'; }
            }
        }

        // ── STEP 2: ADMIN FALLBACK ────────────────────────────────────────────
        // If a specific role ('rider' or 'driver') was requested but no document
        // was found in that collection, silently check the admin User collection.
        // This is the key fix: an admin using the public toggle still gets in.
        if (!user && (role === 'rider' || role === 'driver')) {
            console.log(`[login] No ${role} found for "${email}" — running admin fallback.`);
            const adminFallback = await User.findOne({ email, role: 'admin' });
            if (adminFallback) {
                user         = adminFallback;
                resolvedRole = 'admin';
                console.log(`[login] Admin fallback matched for "${email}". Proceeding as admin.`);
            }
        }

        // ── STEP 3: Guard — nothing found anywhere ────────────────────────────
        if (!user) {
            console.log(`[login] No account found for "${email}" in any collection.`);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // ── STEP 4: Password verification ─────────────────────────────────────
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[login] Password mismatch for "${email}" (resolvedRole: ${resolvedRole}).`);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // ── STEP 5: Issue JWT ──────────────────────────────────────────────────
        const token = jwt.sign(
            { userId: user._id, role: resolvedRole },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log(`[login] ✅ "${email}" authenticated successfully as ${resolvedRole}.`);

        // Return both a top-level `role` AND a nested `user.role` so the frontend
        // can read either `res.data.role` or `res.data.user.role` interchangeably.
        return res.status(200).json({
            token,
            role: resolvedRole,
            user: {
                id:       user._id,
                username: user.username || user.name, // admin has `name`; rider/driver have `username`
                email:    user.email,
                role:     resolvedRole
            }
        });

    } catch (error) {
        console.error('[login] Unexpected error:', error);
        return res.status(500).json({ message: 'Server error during login.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/profile  (protected)
// Reads from the correct collection based on the role encoded in the JWT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', protect, async (req, res) => {
    try {
        const { userId, role } = req.user;
        let user;

        if (role === 'admin') {
            user = await User.findById(userId).select('-password');
        } else {
            const Model = modelForRole(role);
            if (!Model) return res.status(400).json({ message: 'Invalid role in token.' });
            user = await Model.findById(userId).select('-password');
        }

        if (!user) return res.status(404).json({ message: 'Profile not found.' });
        res.status(200).json({ ...user.toObject(), role });

    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error fetching profile.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /auth/update-profile  (protected)
// Updates the document in the correct collection
// ─────────────────────────────────────────────────────────────────────────────
router.put('/update-profile', protect, async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { username, profilePicture, vehicle } = req.body;

        let user;

        if (role === 'admin') {
            user = await User.findById(userId);
        } else {
            const Model = modelForRole(role);
            if (!Model) return res.status(400).json({ message: 'Invalid role in token.' });
            user = await Model.findById(userId);
        }

        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Username update with format validation
        if (username !== undefined) {
            const usernameRegex = /^[A-Za-z]+$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({
                    message: 'Username must contain only alphabetic characters (A-Z, a-z).'
                });
            }
            user.username = username;
        }

        // Profile picture — allow empty string to clear the photo
        if (profilePicture !== undefined) {
            user.profilePicture = profilePicture;
        }

        // Vehicle info — drivers only
        if (role === 'driver' && vehicle) {
            user.vehicle = {
                make:         vehicle.make         || user.vehicle?.make,
                model:        vehicle.model        || user.vehicle?.model,
                year:         vehicle.year         || user.vehicle?.year,
                color:        vehicle.color        || user.vehicle?.color,
                licensePlate: vehicle.licensePlate || user.vehicle?.licensePlate
            };
        }

        await user.save();

        let updatedUser;
        if (role === 'admin') {
            updatedUser = await User.findById(user._id).select('-password');
        } else {
            const Model = modelForRole(role);
            updatedUser = await Model.findById(user._id).select('-password');
        }

        res.status(200).json({ message: 'Profile updated successfully!', user: { ...updatedUser.toObject(), role } });

    } catch (error) {
        console.error('Error updating profile:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message).join(' ');
            return res.status(400).json({ message: messages });
        }
        res.status(500).json({ message: 'Server error updating profile.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/users  (admin-only, legacy)
// Returns riders + drivers as separate arrays for the admin panel
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required.' });
        }

        const [riders, drivers] = await Promise.all([
            Rider.find().select('-password').sort({ createdAt: -1 }),
            Driver.find().select('-password').sort({ createdAt: -1 })
        ]);

        // Tag each document with its role so the frontend can tell them apart
        const taggedRiders  = riders.map(r => ({ ...r.toObject(), role: 'rider'  }));
        const taggedDrivers = drivers.map(d => ({ ...d.toObject(), role: 'driver' }));

        res.status(200).json({ riders: taggedRiders, drivers: taggedDrivers });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error fetching users.' });
    }
});

module.exports = router;