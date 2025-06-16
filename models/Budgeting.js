const mongoose = require('mongoose');

// Expense Schema
const expenseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true } // Added category field
});

const Expense = mongoose.model('Expense', expenseSchema);

// Savings Goal Schema
const savingsGoalSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, required: true, default: 0 },
    endDate: { type: Date, required: true }
});

const SavingsGoal = mongoose.model('SavingsGoal', savingsGoalSchema);

module.exports = {
    Expense,
    SavingsGoal
};
