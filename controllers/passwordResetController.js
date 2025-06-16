// controllers/passwordResetController.js
const crypto = require('crypto');
const User = require('../models/user');
const ResetToken = require('../models/resetToken');
const nodemailer = require('nodemailer');
const path = require('path');

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: 'No user with that email' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const resetToken = new ResetToken({ userId: user._id, token });
    await resetToken.save();

    const transporter = nodemailer.createTransport({
        service: 'hotmail',
        auth: {
            user: process.env.SENDER,
            pass: process.env.PASSKEY
        }
    });

    const mailOptions = {
        to: user.email,
        from: process.env.SENDER,
        subject: 'Password Reset',
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
              `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
              `http://${req.headers.host}/password/reset/${token}\n\n` +
              `If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    transporter.sendMail(mailOptions, (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: 'Error sending email' });
        }
        res.status(200).json({ message: 'Email sent' });
    });
};

exports.renderResetForm = async (req, res) => {
    const { token } = req.params;
    const resetToken = await ResetToken.findOne({ token, expirationDate: { $gt: Date.now() } });

    if (!resetToken) {
        return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    res.sendFile(path.resolve(__dirname, '../public/password-reset.html'));
};

exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    const resetToken = await ResetToken.findOne({ token, expirationDate: { $gt: Date.now() } });

    if (!resetToken) {
        return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    const user = await User.findById(resetToken.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    user.password = password;
    await user.save();
    await ResetToken.deleteOne({ token });

    res.status(200).json({ message: 'Password has been reset' });
};