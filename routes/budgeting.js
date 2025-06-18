const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');
const { Expense, SavingsGoal } = require('../models/Budgeting');
const PlaidToken = require('../models/plaidToken');
const plaidClient = require('../plaid');
const mixpanel = require('../mixpanel');
const cache = require('../config/cache');

// Expense Endpoints
router.get('/expenses', protect, async (req, res) => {
    try {
        const expenses = await Expense.find({ user: req.user._id });

        mixpanel.track('Expenses Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Something went wrong fetching expenses' });
    }
});

router.post('/expenses', protect, async (req, res) => {
    try {
        const { date, amount, description, category } = req.body;
        const expense = new Expense({ user: req.user._id, date, amount, description, category });
        await expense.save();

        mixpanel.track('Expense Added', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            amount,
            category,
            timestamp: new Date().toISOString()
        });

        res.status(201).json(expense);
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ error: 'Something went wrong adding expense' });
    }
});

// Savings Goals Endpoints
router.get('/goals', protect, async (req, res) => {
    try {
        const goals = await SavingsGoal.find({ user: req.user._id });

        mixpanel.track('Savings Goals Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(goals);
    } catch (error) {
        console.error('Error fetching savings goals:', error);
        res.status(500).json({ error: 'Something went wrong fetching savings goals' });
    }
});

router.post('/goals', protect, async (req, res) => {
    try {
        const { name, targetAmount, currentAmount, endDate } = req.body;
        const goal = new SavingsGoal({ user: req.user._id, name, targetAmount, currentAmount, endDate });
        await goal.save();

        mixpanel.track('Savings Goal Added', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            name,
            targetAmount,
            timestamp: new Date().toISOString()
        });

        res.status(201).json(goal);
    } catch (error) {
        console.error('Error adding savings goal:', error);
        res.status(500).json({ error: 'Something went wrong adding savings goal' });
    }
});

// Get a specific savings goal by ID
router.get('/goals/:id', protect, async (req, res) => {
    try {
        const goal = await SavingsGoal.findById(req.params.id);
        if (!goal) {
            return res.status(404).send('Goal not found');
        }
        res.json(goal);
    } catch (error) {
        console.error('Error fetching goal:', error);
        res.status(500).send('Something went wrong fetching the goal');
    }
});

// Update a specific savings goal by ID
router.put('/goals/:id', protect, async (req, res) => {
    try {
        const goal = await SavingsGoal.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!goal) {
            return res.status(404).send('Goal not found');
        }
        res.json(goal);
    } catch (error) {
        console.error('Error updating goal:', error);
        res.status(500).send('Something went wrong updating the goal');
    }
});

// Delete a specific savings goal by ID
router.delete('/goals/:id', protect, async (req, res) => {
    try {
        const goal = await SavingsGoal.findByIdAndDelete(req.params.id);
        if (!goal) {
            return res.status(404).send('Goal not found');
        }
        res.send('Goal deleted');
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).send('Something went wrong deleting the goal');
    }
});

module.exports = router;