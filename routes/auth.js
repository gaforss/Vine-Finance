const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/user');
const NetWorth = require('../models/netWorth');
const PlaidToken = require('../models/plaidToken');
const RetirementGoals = require('../models/RetirementGoals');
const RealEstate = require('../models/RealEstate');
const { protect } = require('../middleware/authMiddleware');
const mixpanel = require('../mixpanel');
const axios = require('axios');

// Function to get geolocation data based on IP address
async function getGeolocation(ipAddress) {
    if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
        console.log('Localhost IP detected, skipping geolocation API call.');
        return {
            city: 'Localhost',
            region: '',
            country: '',
        };
    }

    try {
        const response = await axios.get(`https://ipinfo.io/${ipAddress}/json?token=${process.env.IPINFO_API_KEY}`);
        return {
            city: response.data.city || 'Unknown',
            region: response.data.region || 'Unknown',
            country: response.data.country || 'Unknown',
        };
    } catch (error) {
        console.error('Error fetching geolocation:', error.message);
        return {
            city: 'Unknown',
            region: 'Unknown',
            country: 'Unknown',
        };
    }
}

// Register a new user
router.post('/register', async (req, res, next) => {
    console.log(`[POST /auth/register] - Received registration request for email: ${req.body.email}`);
    try {
        const { username, email, password, firstName, lastName } = req.body;

        // Check if a user with this email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log(`[POST /auth/register] - Registration failed: User already exists with email: ${email}`);
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Get the IP address and geolocation data
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const location = await getGeolocation(ipAddress.split(',')[0].trim());

        // Create new user
        const newUser = new User({
            username,
            email,
            password,
            firstName,
            lastName,
            sessionActivity: [{
                timestamp: new Date(),
                ipAddress: ipAddress.split(',')[0].trim(),
                userAgent: req.headers['user-agent'],
                location: location
            }]
        });

        // Save the new user to the database
        await newUser.save();
        console.log(`[POST /auth/register] - Successfully created new user: ${newUser._id}`);

        // Create a JWT token for the new user
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Track the event in Mixpanel
        mixpanel.track('User Signed Up', {
            distinct_id: newUser._id.toString(),
            signup_method: 'email',
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            email: newUser.email,
            ip: ipAddress.split(',')[0].trim(),
            city: location.city,
            region: location.region,
            country: location.country,
            timestamp: new Date().toISOString()
        });

        // Set Mixpanel people properties
        mixpanel.people.set(newUser._id.toString(), {
            $first_name: newUser.firstName,
            $last_name: newUser.lastName,
            $email: newUser.email,
            $created: new Date().toISOString(),
            signup_method: 'email',
            ip: ipAddress.split(',')[0].trim(),
            city: location.city,
            region: location.region,
            country: location.country
        });

        // Send the token as a response
        res.status(201).json({ token });
    } catch (err) {
        next(err);
    }
});

// User login
router.post('/login', async (req, res, next) => {
    console.log(`[POST /auth/login] - Received login request for email: ${req.body.email}`);
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`[POST /auth/login] - Login failed: User not found with email: ${email}`);
            return res.status(401).json({ message: 'User not found' });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            console.log(`[POST /auth/login] - Login failed: Invalid password for user: ${user._id}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const location = await getGeolocation(ipAddress.split(',')[0].trim());

        const sessionData = {
            ipAddress: ipAddress.split(',')[0].trim(),
            userAgent: req.headers['user-agent'],
            location: location
        };
        
        user.sessionActivity.push(sessionData);
        await user.save();

        // Track Mixpanel event
        mixpanel.track('User Logged In', {
            distinct_id: user._id.toString(),
            email: user.email,
            timestamp: new Date().toISOString()
        });

        mixpanel.people.set(user._id.toString(), {
            $last_login: new Date().toISOString()
        });

        console.log(`[POST /auth/login] - Successfully logged in user: ${user._id}`);
        res.status(200).json({ token });
    } catch (error) {
        console.error('Error during login:', error);
        next(error);
    }
});

// Update user profile
router.post('/api/profile', protect, async (req, res) => {
    console.log('[POST /auth/api/profile] - Received profile update request.');
    try {
        const { firstName, lastName } = req.body;
        const userId = req.user._id;

        console.log(`[POST /auth/api/profile] - User ID: ${userId}`);
        console.log(`[POST /auth/api/profile] - Request body:`, req.body);

        const user = await User.findById(userId);
        if (!user) {
            console.log(`[POST /auth/api/profile] - User not found with ID: ${userId}`);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`[POST /auth/api/profile] - User found. Current name: ${user.firstName} ${user.lastName}`);

        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        
        console.log(`[POST /auth/api/profile] - Attempting to save updated name: ${user.firstName} ${user.lastName}`);

        const updatedUser = await user.save();
        
        console.log(`[POST /auth/api/profile] - Profile updated successfully for user: ${userId}`);

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        console.error('[POST /auth/api/profile] - Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch user data
router.get('/api/user', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user profile
router.post('/updateProfile', protect, async (req, res) => {
    const { firstName, lastName } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        await user.save();

        mixpanel.people.set(user._id.toString(), {
            $first_name: user.firstName,
            $last_name: user.lastName
        });

        res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark the user tour as complete
router.post('/complete-tour', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        await User.findByIdAndUpdate(userId, { isNewUser: false });
        res.status(200).send({ message: 'Tour marked as completed' });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// Delete a user account
router.delete('/deleteAccount', protect, async (req, res) => {
    console.log(`[DELETE /auth/deleteAccount] - Received request to delete account for user: ${req.user._id}`);
    try {
        const user = req.user;

        // Use Promise.all to delete all associated data in parallel for efficiency
        await Promise.all([
            NetWorth.deleteMany({ user: user._id }),
            PlaidToken.deleteMany({ userId: user._id }),
            RetirementGoals.deleteMany({ userId: user._id }),
            RealEstate.deleteMany({ userId: user._id })
        ]);
        console.log(`[DELETE /auth/deleteAccount] - Deleted associated data (NetWorth, PlaidToken, RetirementGoals, RealEstate) for user: ${user._id}`);

        // Finally, delete the user document itself
        await User.deleteOne({ _id: user._id });
        console.log(`[DELETE /auth/deleteAccount] - Deleted User document for user: ${user._id}`);

        res.status(200).json({ message: 'User account and all associated data deleted successfully' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Error deleting account' });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    if (req.user) {
        mixpanel.track('User Logged Out', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            name: `${req.user.firstName} ${req.user.lastName}`
        });
    }
    req.logout();
    res.redirect('/');
});

// Fetch onboarding steps
router.get('/api/onboarding-steps', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user.onboardingSteps || user.onboardingSteps.length === 0) {
            user.onboardingSteps = [
                { 
                    step: `
                        <div class="onboarding-step">
                            <div class="onboarding-content">
                                <h5>1. Replace Demo Entries with Your Values</h5>
                                <p>Remove your demo data <a href="/input">here</a> and import your historical data if available. Otherwise, manually add your first entry and then mark this step as completed.</p>
                                <p>If you need the template, download it <a href="files/template.xlsx" download="template.xlsx"><i class="fa fa-download"></i> here</a>.</p>
                            </div>
                        </div>
                    `, 
                    completed: false 
                },
                { 
                    step: `
                        <div class="onboarding-step">
                            <div class="onboarding-content">
                                <h5>2. Link Your First Account</h5>
                                <p>Link your first <a href="/accounts">account</a> and manually add any additional accounts.</p>
                                <p>These accounts will help bring your financial data to life and prefill input fields for new monthly entries.</p>
                            </div>
                        </div>
                    `, 
                    completed: false 
                },
                { 
                    step: `
                        <div class="onboarding-step">
                            <div class="onboarding-content">
                                <h5>3. Set Your Retirement Goals</h5>
                                <p>Set your retirement goals <a href="/retirement">here</a>.</p>
                                <p>Define your current age, desired monthly spending, and spending categories to track progress towards retirement based on your current net worth.</p>
                            </div>
                        </div>
                    `, 
                    completed: false 
                },
                { 
                    step: `
                        <div class="onboarding-step">
                            <div class="onboarding-content">
                                <h5>4. Add a Property</h5>
                                <p>Add a property <a href="/realestate">here</a>.</p>
                                <p>Track properties, including rentals, manage rental contracts, overdue payments, and store documents for easy access during tax season.</p>
                            </div>
                        </div>
                    `, 
                    completed: false 
                }
            ];
            await user.save();
        } else {
            user.onboardingSteps = user.onboardingSteps.filter(s => s.step && typeof s.completed === 'boolean');
        }
        
        res.json(user.onboardingSteps);
    } catch (error) {
        console.error('Error fetching onboarding steps:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a single onboarding step
router.post('/api/onboarding-step', protect, async (req, res) => {
    try {
        const { step, completed } = req.body;
        
        const user = await User.findById(req.user._id);

        // Ensure valid step and completed values are received
        if (step && typeof completed === 'boolean') {
            const stepToUpdate = user.onboardingSteps.find(s => s.step === step);
            if (stepToUpdate) {
                stepToUpdate.completed = completed;
            } else {
                user.onboardingSteps.push({ step, completed });
            }

            await user.save();
        } else {
            console.error('Invalid step or completion status received:', step, completed);
            return res.status(400).json({ message: 'Invalid step data' });
        }

        // Filter out any steps that don't have the necessary fields
        const validSteps = user.onboardingSteps.filter(s => s.step && typeof s.completed === 'boolean');

        // Check if all valid steps are completed
        const allCompleted = validSteps.every(s => s.completed);

        res.json({ allCompleted });
    } catch (error) {
        console.error('Error updating onboarding step:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = {
    router,
    getGeolocation,
};