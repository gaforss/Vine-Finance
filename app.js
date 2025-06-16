require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const { protect } = require('./middleware/authMiddleware');
const mixpanel = require('./mixpanel');
const { OAuth2Client } = require('google-auth-library');
const User = require('./models/user');
const jwt = require('jsonwebtoken');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { router: authRouter, getGeolocation } = require('./routes/auth');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));



// Session handling
app.use(session({
    secret: 'yourSecret',
    resave: false,
    saveUninitialized: true
}));

app.set('trust proxy', true);

// Passport.js middleware
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
console.log("🔍 MONGO_URI:", process.env.MONGO_URI);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Function to track page views
const trackPageView = (page) => (req, res, next) => {
    const user = req.user;

    if (user) {
        // Track page view for a logged-in user
        mixpanel.track('Page View', {
            distinct_id: user._id.toString(),
            page: page,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            ip: req.ip, // Capture the user's IP address
            userAgent: req.headers['user-agent'], // Capture user agent (browser details)
            timestamp: new Date().toISOString()
        });

        // Optionally, update user profile in Mixpanel with the latest page viewed
        mixpanel.people.set(user._id.toString(), {
            $last_page_view: page,
            $last_page_viewed_at: new Date().toISOString(),
            $last_ip: req.ip,
            $last_user_agent: req.headers['user-agent']
        });
    } else {
        // Track page view for an anonymous user
        mixpanel.track('Page View', {
            distinct_id: 'anonymous',
            page: page,
            timestamp: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    }

    next();
};

// Route definitions
app.get('/', trackPageView('Home'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', trackPageView('Dashboard'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/input', trackPageView('Input'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'input.html'));
});

app.get('/editProfile', trackPageView('Edit Profile'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'editProfile.html'));
});

app.get('/accounts', trackPageView('Accounts'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'accounts.html'));
});

app.get('/transactions', trackPageView('Transactions'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'transactions.html'));
});

app.get('/retirement', trackPageView('Retirement'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'retirement.html'));
});

app.get('/realestate', trackPageView('Real Estate'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'realestate.html'));
});

app.get('/budgeting', trackPageView('Budgeting'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'budgeting.html'));
});

app.get('/learning', trackPageView('Learning'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'learning.html'));
});

// API Routes
app.use('/auth', authRouter);
const entriesRouter = require('./routes/entries');
const importRouter = require('./routes/import');
const passwordRouter = require('./routes/passwordReset');
const plaidRouter = require('./routes/plaid');
const retirementRouter = require('./routes/retirement');
const realestateRouter = require('./routes/realestate');
const budgetingRouter = require('./routes/budgeting');
const snapshotRouter = require('./routes/snapshot');

app.use('/entries', protect, entriesRouter);
app.use('/import', protect, importRouter);
app.use('/auth', authRouter);
app.use('/password', passwordRouter);
app.use('/plaid', protect, plaidRouter);
app.use('/retirement', retirementRouter);
app.use('/realestate', protect, realestateRouter);
app.use('/budgeting', budgetingRouter);
app.use('/api', snapshotRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/login', trackPageView('Login'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', trackPageView('Login'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/password-reset', trackPageView('Password Reset'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'password-reset.html'));
});

app.get('/forgot-password', trackPageView('Forgot Password'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/why-vine', trackPageView('Why Vine'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'why-vine.html'));
});

app.get('/testimonials', trackPageView('Why Vine'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'testimonials.html'));
});

app.get('/terms', trackPageView('Terms'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/privacy', trackPageView('Privacy'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Google Auth route
app.post('/auth/google', async (req, res) => {
    const { token, username } = req.body;
    console.log("Token:", token);
    console.log("Username:", username);

    try {
        // Verify the token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleId = payload['sub'];

        let user = await User.findOne({ googleId });

        if (!user) {
            // Create a new user if not found
            user = new User({
                googleId,
                firstName: payload['given_name'],
                lastName: payload['family_name'],
                email: payload['email'],
                profileImage: payload['picture'],
                username
            });
            await user.save();
        }

        // Capture IP and User-Agent
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const location = await getGeolocation(ipAddress.split(',')[0].trim());

        // Log session activity
        const sessionData = {
            timestamp: new Date(),
            ipAddress: ipAddress.split(',')[0].trim(),
            userAgent: req.headers['user-agent'],
            location
        };

        user.sessionActivity.push(sessionData);
        await user.save();

        console.log('Session data saved for user:', user._id);

        // Track Mixpanel event for Google Sign-In
        mixpanel.track('User Logged In with Google', {
            distinct_id: user._id.toString(),
            login_method: 'google',
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            ip: ipAddress.split(',')[0].trim(),
            city: location.city,
            region: location.region,
            country: location.country,
            timestamp: new Date().toISOString()
        });

        // Set Mixpanel people properties for Google Sign-In
        mixpanel.people.set(user._id.toString(), {
            $first_name: user.firstName,
            $last_name: user.lastName,
            $email: user.email,
            $last_login: new Date().toISOString(),
            login_method: 'google',
            ip: ipAddress.split(',')[0].trim(),
            city: location.city,
            region: location.region,
            country: location.country
        });

        // Generate and send JWT token
        const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ success: true, token: jwtToken, user });

    } catch (error) {
        console.error('Error verifying Google ID token:', error);
        res.status(400).json({ success: false, message: 'Invalid Google ID token' });
    }
});

// Logout route
app.get('/logout', (req, res, next) => {
    if (req.user) {
        mixpanel.track('User Logged Out', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            name: `${req.user.firstName} ${req.user.lastName}`
        });
    }
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/login.html');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    mixpanel.track('Server Error', {
        distinct_id: req.user ? req.user._id.toString() : 'anonymous',
        error: err.message,
        email: req.user ? req.user.email : 'anonymous',
        name: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'anonymous'
    });
    res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
