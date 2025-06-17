const mongoose = require('mongoose');

const retirementGoalsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currentAge: { type: Number, required: true },
  retirementAge: { type: Number, required: true },
  currentNetWorth: { type: Number, required: false, default: 0 },
  monthlySpend: { type: Number, required: true },
  mortgage: { type: Number, required: true },
  cars: { type: Number, required: true },
  healthCare: { type: Number, required: true },
  foodAndDrinks: { type: Number, required: true },
  travelAndEntertainment: { type: Number, required: true },
  reinvestedFunds: { type: Number, required: true },
  annualSavings: { type: Number, required: false, default: 0 },
  isDraft: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
});

// Add index for faster queries
retirementGoalsSchema.index({ userId: 1, isDraft: 1 });

const RetirementGoals = mongoose.model('RetirementGoals', retirementGoalsSchema);

module.exports = RetirementGoals;