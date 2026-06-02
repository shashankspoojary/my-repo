const jwt = require('jsonwebtoken');

// This is our bouncer function!
const protect = (req, res, next) => {
    // 1. Look for the VIP pass in the headers of the request
    const authHeader = req.header('Authorization');

    // 2. If there is no pass, kick them out
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No VIP pass provided!' });
    }

    try {
        // 3. Extract the exact token (remove the word "Bearer ")
        const token = authHeader.split(' ')[1];

        // 4. Verify the pass using our secret signature
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. If it's real, attach the user's ID to the request so the next function knows who they are
        req.user = decoded;
        
        // 6. Let them pass through the door!
        next(); 

    } catch (error) {
        // If the token is fake or expired, kick them out
        res.status(401).json({ message: 'Invalid or expired VIP pass!' });
    }
};

module.exports = protect;