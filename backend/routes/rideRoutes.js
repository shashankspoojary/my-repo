const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User'); 
const Driver = require('../models/Driver');
const protect = require('../middleware/authMiddleware');

// ==========================================
// 1. BOOK A RIDE (With "Ghost Ride" Fix)
// ==========================================
router.post('/book', protect, async (req, res) => {
    try {
        const { pickupLocation, dropoffLocation, scheduledFor, stops, distance, pickupCoords, dropoffCoords, stopCoords, paymentMethod, numberOfTravelers, vehicleType, paymentStatus } = req.body;
        
        // Generate a random 4-digit Security PIN
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

        // Safely grab the User ID regardless of token structure
        const activeUserId = req.user.userId || req.user.id || req.user._id;

        if (!activeUserId) {
            return res.status(400).json({ message: '❌ User ID missing from token. Please log out and log back in.' });
        }

        const newRide = new Ride({
            user: activeUserId,             // Explicitly link the user
            status: 'pending',              // Explicitly set status so Drivers see it
            pickupLocation, 
            dropoffLocation, 
            stops: stops || [],
            scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
            distanceInKm: distance, 
            pickupCoords, 
            dropoffCoords, 
            stopCoords,
            numberOfTravelers: numberOfTravelers || 1,
            vehicleType: vehicleType || 'Car',
            paymentMethod: paymentMethod || 'Cash',
            paymentStatus: paymentStatus || 'Pending',
            otp: generatedOtp 
        });
        
        await newRide.save();

        // ── Only notify drivers in the matching vehicle-type room ──────────
        const io = req.app.get('io');
        if (io) {
            // Populate rider info so the driver card shows passenger name
            const populatedRide = await Ride.findById(newRide._id)
                .populate('user', 'username name phone');

            // Debug: confirm the exact room being targeted before every emission.
            // Compare this value against the 'SOCKET JOIN EVENT' server log to
            // instantly catch any casing mismatch (e.g. 'car' vs 'Car').
            console.log('EMITTING LIVE RIDE to room:', `vehicle_${populatedRide.vehicleType}`);

            // Target only the room for this specific vehicle type (e.g. vehicle_Car, vehicle_Auto, vehicle_Bike)
            // Drivers self-join these rooms on dashboard mount via the 'joinVehicleRoom' socket event
            io.to(`vehicle_${populatedRide.vehicleType}`).emit('newRideRequest', populatedRide);
        }

        res.status(201).json({ message: 'Ride booked successfully!', ride: newRide });
    } catch (error) { 
        console.error("🚨 BOOKING CRASH:", error);
        res.status(500).json({ message: 'Server error during booking' }); 
    }
});

// ==========================================
// 2. GET RIDER HISTORY
// ==========================================
router.get('/my-rides', protect, async (req, res) => {
    try {
        const activeUserId = req.user.userId || req.user.id || req.user._id;
        const rides = await Ride.find({ 
            user: activeUserId, 
            riderClearedHistory: { $ne: true } 
        })
        .populate('driver', 'username name phone averageRating vehicle vehicleNumber vehicleType profilePicture') 
        .sort({ createdAt: -1 });
        
        res.status(200).json({ rides });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching rides' });
    }
});

// ==========================================
// 3. GET AVAILABLE JOBS (FOR DRIVERS)
// ==========================================
router.get('/available', protect, async (req, res) => {
    try {
        const activeUserId = req.user.userId || req.user.id || req.user._id;

        // ── APPROVAL GATE ─────────────────────────────────────────────
        const driver = await Driver.findById(activeUserId).select('isApproved vehicleType');
        if (!driver || !driver.isApproved) {
            return res.status(403).json({
                message: '🔒 Your account is pending admin approval. You cannot view or accept rides until an administrator activates your account.'
            });
        }
        // ─────────────────────────────────────────────────────────────

        // FALLBACK FIX: Filter by the driver's own vehicleType so an Auto
        // driver who refreshes does NOT see Car rides (and vice versa).
        // This mirrors exactly what the Socket.io room-based dispatch does.
        const query = { status: 'pending' };
        if (driver.vehicleType) {
            query.vehicleType = driver.vehicleType.trim();
        }

        const rides = await Ride.find(query).sort({ createdAt: -1 });
        res.status(200).json({ rides });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ==========================================
// 4. GET ACTIVE JOBS FOR DRIVER
// ==========================================
router.get('/my-jobs', protect, async (req, res) => {
    try {
        const activeUserId = req.user.userId || req.user.id || req.user._id;

        // ── APPROVAL GATE ─────────────────────────────────────────────
        const driver = await Driver.findById(activeUserId).select('isApproved');
        if (!driver || !driver.isApproved) {
            return res.status(403).json({
                message: '🔒 Your account is pending admin approval. You cannot view or accept rides until an administrator activates your account.'
            });
        }
        // ─────────────────────────────────────────────────────────────

        const rides = await Ride.find({ 
            driver: activeUserId, 
            status: { $in: ['accepted', 'arrived', 'in-progress', 'waiting-at-stop'] } 
        }).sort({ createdAt: -1 });
        res.status(200).json({ rides });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ==========================================
// 5. DRIVER EARNINGS & STATS
// ==========================================
router.get('/driver-dashboard', protect, async (req, res) => {
    try {
        const activeUserId = req.user.userId || req.user.id || req.user._id;
        const rides = await Ride.find({ driver: activeUserId }).sort({ createdAt: -1 });
        const completedRides = rides.filter(r => r.status === 'completed');
        const grossFare = completedRides.reduce((acc, ride) => acc + (ride.totalFare || 0), 0);
        
        const driverEarnings = grossFare * 0.80;
        const activeRides = rides.filter(r => ['accepted', 'arrived', 'in-progress', 'waiting-at-stop'].includes(r.status)).length;

        res.status(200).json({ 
            rides, 
            totalRides: rides.length,
            activeRides,
            totalEarnings: driverEarnings 
        });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: 'Server error fetching driver dashboard' }); 
    }
});

// ==========================================
// 6. COMPLETION & FARE CALCULATION
// ==========================================
router.put('/:id/complete', protect, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        ride.status = 'completed';
        const baseFare = ride.distanceInKm * 15; 
        let waitingFare = 0;
        
        if (ride.totalWaitTimeMinutes > 10) { 
            const chargeableMins = ride.totalWaitTimeMinutes - 10;
            waitingFare = chargeableMins * 2; 
        }
        
        ride.baseFare = baseFare; 
        ride.waitingFare = waitingFare; 
        ride.totalFare = baseFare + waitingFare; 

        const driverEarningsForThisTrip = ride.totalFare * 0.80;

        if (ride.paymentMethod === 'online') {
            const rider = await User.findById(ride.user);
            const driver = await User.findById(ride.driver);
            if (rider && driver) {
                rider.walletBalance -= ride.totalFare; 
                driver.walletBalance += ride.totalFare;
                ride.paymentStatus = 'Completed'; 
                await rider.save(); 
                await driver.save();
            }
        }

        await ride.save();
        const io = req.app.get('io');
        if (io) io.emit('rideUpdated', ride);
        
        res.status(200).json({ 
            message: 'Ride completed!', 
            distance: ride.distanceInKm, 
            driverEarnings: driverEarningsForThisTrip 
        });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: 'Server error' }); 
    }
});

// ==========================================
// CANCELLATION ROUTES
// ==========================================
router.put('/:id/cancel-by-rider', protect, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        if (ride.scheduledFor) {
            const timeUntilRideMins = (new Date(ride.scheduledFor) - new Date()) / 60000;
            if (timeUntilRideMins < 30) return res.status(400).json({ message: '❌ Too late! You cannot cancel within 30 minutes of a scheduled ride.' });
        } else {
            if (ride.status !== 'pending' && ride.status !== 'accepted') return res.status(400).json({ message: '❌ Driver has already arrived or started the trip.' });
        }
        
        ride.status = 'cancelled';
        await ride.save();
        
        const io = req.app.get('io');
        if (io) {
            io.emit('rideUpdated', ride);
            io.emit('rideCancelledByRider', ride); 
        }
        
        res.status(200).json({ message: 'Ride successfully cancelled.' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id/cancel-by-driver', protect, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        ride.status = 'cancelled';
        await ride.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('rideUpdated', ride);
            io.emit('rideCancelledByDriver', ride); 
        }

        res.status(200).json({ message: 'Trip successfully cancelled.' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ==========================================
// DELETE ROUTE
// ==========================================
router.delete('/:id', protect, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        if (req.user.role === 'rider') {
            ride.riderClearedHistory = true;
        } else if (req.user.role === 'driver') {
            ride.driverClearedHistory = true;
        }

        await ride.save();
        res.status(200).json({ message: 'Ride removed from your history!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting ride' });
    }
});

// ==========================================
// 7. WILDCARD ROUTE (ACCEPT, ARRIVE, START, PAUSE, RESUME)
// ==========================================
router.put('/:id/:action', protect, async (req, res) => {
    try {
        const activeUserId = req.user.userId || req.user.id || req.user._id;
        const { id, action } = req.params;
        const ride = await Ride.findById(id);
        
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        if (action === 'accept') { 
            // ── APPROVAL GATE ─────────────────────────────────────────
            const driverDoc = await Driver.findById(activeUserId).select('isApproved');
            if (!driverDoc || !driverDoc.isApproved) {
                return res.status(403).json({
                    message: '🔒 Your account is pending admin approval. You cannot accept rides until an administrator activates your account.'
                });
            }
            // ─────────────────────────────────────────────────────────
            ride.driver = activeUserId; 
            ride.status = 'accepted'; 
        } 
        else if (action === 'arrive') { 
            ride.status = 'arrived'; 
        } 
        else if (action === 'start') { 
            const { otp } = req.body;
            if (!ride.otp || !otp || String(ride.otp).trim() !== String(otp).trim()) {
                return res.status(400).json({ message: '❌ Invalid PIN! Please ask the passenger for the correct 4-digit code.' });
            }
            ride.status = 'in-progress'; 
        } 
        else if (action === 'pause') { 
            ride.status = 'waiting-at-stop'; 
            ride.currentWaitStartTime = new Date(); 
        } 
        else if (action === 'resume') {
            ride.status = 'in-progress';
            if (ride.currentWaitStartTime) {
                const waitTime = Math.round((new Date() - ride.currentWaitStartTime) / 60000);
                ride.totalWaitTimeMinutes += waitTime; 
                ride.currentWaitStartTime = null; 
                ride.completedStopsCount += 1;
            }
        }

        await ride.save();
        
        // 💡 Populating the driver details before emitting and returning
        await ride.populate('driver', 'username name phone averageRating vehicle vehicleNumber vehicleType profilePicture');


        const io = req.app.get('io');
        if (io) io.emit('rideUpdated', ride);
        res.status(200).json({ message: `Ride ${action} successful!`, ride });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: 'Server error' }); 
    }
});

// ==========================================
// 8. RATE A DRIVER
// ==========================================
router.post('/:id/rate', protect, async (req, res) => {
    try {
        const { rating, feedback } = req.body;
        const ride = await Ride.findById(req.params.id);

        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        if (ride.status !== 'completed') return res.status(400).json({ message: 'You can only rate completed rides.' });
        if (ride.rating) return res.status(400).json({ message: 'You already rated this ride.' });

        // Save rating and feedback to the ride receipt
        ride.rating = rating;
        ride.feedback = feedback;
        await ride.save();

        // Update Driver's global rating profile
        const driverId = ride.driver; 
        if (driverId) {
            const driver = await User.findById(driverId);
            if (driver) {
                const currentTotalRatings = driver.totalRatings || 0;
                const currentAverage = driver.averageRating || 5.0;

                const newTotalRatings = currentTotalRatings + 1;
                const newAverage = ((currentAverage * currentTotalRatings) + rating) / newTotalRatings;

                driver.totalRatings = newTotalRatings;
                driver.averageRating = parseFloat(newAverage.toFixed(1)); 
                await driver.save();
            }
        }

        res.status(200).json({ message: 'Thank you for your feedback!' });
    } catch (error) {
        console.error("🚨 CRASH IN RATING ROUTE:", error.message);
        res.status(500).json({ message: 'Server error saving rating' });
    }
});

module.exports = router;