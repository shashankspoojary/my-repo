const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Ride = require('../models/Ride');
const protect = require('../middleware/authMiddleware');

// ============================================================
// Razorpay instance — reads keys from environment variables.
// Add these to your backend/.env before testing:
//   RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
//   RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
// ============================================================
const razorpayInstance = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ============================================================
// POST /api/payments/create-order
// Body: { amount: Number (INR), rideId: String }
// Creates a Razorpay order and returns order details + key_id
// to the frontend so it can open the checkout modal.
// ============================================================
router.post('/create-order', protect, async (req, res) => {
    try {
        const { amount, rideId } = req.body;

        if (!amount || !rideId) {
            return res.status(400).json({ message: '❌ amount and rideId are required.' });
        }

        // Razorpay expects amount in the smallest currency unit (paise for INR).
        // The frontend should pass the amount already in paise (multiply ₹ × 100).
        const options = {
            amount:   Math.round(amount), // paise — must be an integer
            currency: 'INR',
            receipt:  `receipt_ride_${rideId}`,
            notes: {
                rideId, // stored on Razorpay dashboard for easy lookup
            },
        };

        const order = await razorpayInstance.orders.create(options);

        res.status(200).json({
            success: true,
            orderId:  order.id,
            amount:   order.amount,
            currency: order.currency,
            keyId:    process.env.RAZORPAY_KEY_ID, // sent to frontend to init checkout
        });
    } catch (error) {
        console.error('🚨 Razorpay create-order error:', error);
        res.status(500).json({ message: 'Payment gateway error. Please try again.' });
    }
});

// ============================================================
// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id,
//         razorpay_signature, rideId }
// Verifies the HMAC-SHA256 signature returned by Razorpay.
// On success → updates Ride paymentStatus to 'Completed'.
// ============================================================
router.post('/verify', protect, async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            rideId,
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !rideId) {
            return res.status(400).json({ message: '❌ Missing verification fields.' });
        }

        // ── Signature Verification ─────────────────────────────────────────
        // Razorpay signs the string "order_id|payment_id" with your key secret.
        // We replicate that HMAC-SHA256 and compare it to the one Razorpay sent.
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.warn('⚠️  Signature mismatch — possible tampered request.');
            return res.status(400).json({
                success: false,
                message: '❌ Payment verification failed. Invalid signature.',
            });
        }

        // ── Update Ride ────────────────────────────────────────────────────
        const ride = await Ride.findById(rideId);
        if (!ride) {
            return res.status(404).json({ message: '❌ Ride not found.' });
        }

        ride.paymentStatus  = 'Completed';
        ride.razorpayOrderId   = razorpay_order_id;
        ride.razorpayPaymentId = razorpay_payment_id;
        await ride.save();

        // Optionally notify drivers/admins via Socket.io
        // const io = req.app.get('io');
        // if (io) io.emit('paymentConfirmed', { rideId, razorpay_payment_id });

        res.status(200).json({
            success: true,
            message: '✅ Payment verified and ride updated successfully!',
        });
    } catch (error) {
        console.error('🚨 Razorpay verify error:', error);
        res.status(500).json({ message: 'Server error during payment verification.' });
    }
});

module.exports = router;
