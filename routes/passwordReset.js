const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');
const mixpanel = require('../mixpanel');

// Route for sending reset email
router.post('/forgot', (req, res, next) => {
    mixpanel.track('Password Reset Requested', {
        distinct_id: req.body.email,
        email: req.body.email,
        timestamp: new Date().toISOString()
    });
    next();
}, passwordResetController.forgotPassword);

// Route for rendering password reset page
router.get('/reset/:token', (req, res, next) => {
    mixpanel.track('Password Reset Form Accessed', {
        distinct_id: req.params.token,
        token: req.params.token,
        timestamp: new Date().toISOString()
    });
    next();
}, passwordResetController.renderResetForm);

// Route for resetting the password
router.post('/reset/:token', (req, res, next) => {
    mixpanel.track('Password Reset Attempted', {
        distinct_id: req.params.token,
        token: req.params.token,
        email: req.body.email,
        timestamp: new Date().toISOString()
    });
    next();
}, passwordResetController.resetPassword);

module.exports = router;