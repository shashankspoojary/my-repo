// 1. Import the necessary packages
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); 

const app = express();

// 1. CONNECT TO MONGODB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => console.log('❌ MongoDB Connection Error:', err));

// 2. UPGRADE TO HTTP & WEB-SOCKETS
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ["GET", "POST"]
    } 
});

// Save the 'io' operator so our routes can use it
app.set('io', io);

io.on('connection', (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);

    // Drivers call this right after connecting so we can target them individually
    socket.on('registerDriver', (driverId) => {
        socket.data.driverId = driverId;
        console.log(`🚗 Driver registered on socket: driverId=${driverId}`);
    });

    // Drivers declare their vehicle type so broadcasts can be scoped to the correct room
    socket.on('joinVehicleRoom', (data) => {
        console.log(`SOCKET JOIN EVENT - Socket ID: ${socket.id}, Vehicle Type: ${data ? data.vehicleType : 'MISSING DATA'}`);
        if (data && data.vehicleType) {
            // Trim whitespace but preserve original casing ('Car', 'Auto', 'Bike')
            // so the room name matches exactly what the /book route emits to
            const sanitizedType = data.vehicleType.trim();
            socket.join(`vehicle_${sanitizedType}`);
            console.log(`🚘 Driver socket ${socket.id} joined room: vehicle_${sanitizedType}`);
        } else {
            console.warn(`⚠️  joinVehicleRoom received empty/invalid data from socket ${socket.id}:`, data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// 3. MIDDLEWARE
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 💡 THE CRITICAL FIX: Ensure regular API calls use the same CORS rules as Sockets
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
})); 

// 4. ROUTES
const authRoutes = require('./routes/authRoutes'); 
app.use('/api/auth', authRoutes); 

const rideRoutes = require('./routes/rideRoutes'); 
app.use('/api/rides', rideRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Phase 3: Razorpay Payment Routes
// Required env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// 5. START THE SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));