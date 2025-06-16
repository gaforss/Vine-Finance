// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const protect = async (req, res, next) => {
    console.log('[Middleware] - Running protect middleware for route:', req.originalUrl);
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            console.log('[Middleware] - Token found, verifying...');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('[Middleware] - Token verified, decoded user ID:', decoded.id);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                console.log('[Middleware] - Auth failed: User not found for ID:', decoded.id);
                return res.status(401).json({ status:false,message: 'User not found' });
            }

            console.log('[Middleware] - Auth successful, user attached to request:', req.user._id);
            next();
        } catch (error) {
            console.log('[Middleware] - Auth failed: Token verification failed:', error.message);
            return res.status(401).json({status:false, message: 'Token verification failed' });
        }
    } else {
        console.log('[Middleware] - Auth failed: No token provided');
        return res.status(401).json({ status:false,message: 'No token provided' });
    }
};

module.exports = { protect };