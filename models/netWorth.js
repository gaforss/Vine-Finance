const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    category: {
        type: String,
        enum: ['bank', 'credit card', 'loan', 'investment', 'retirement', 'insurance', 'crypto', 'misc'],
        required: true
    },
    manuallyAdded: { type: Boolean, default: true }
});

const netWorthSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    cash: { type: Number, required: true, default: 0 },
    investments: { type: Number, required: true, default: 0 },
    realEstate: { type: Number, required: true, default: 0 },
    retirementAccounts: { type: Number, required: true, default: 0 },
    vehicles: { type: Number, required: true, default: 0 },
    personalProperty: { type: Number, required: true, default: 0 },
    otherAssets: { type: Number, required: true, default: 0 },
    liabilities: { type: Number, required: true, default: 0 },
    customFields: [{
        name: { type: String, required: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ['asset', 'liability'], required: true }
    }],
    accounts: [accountSchema],
    netWorth: { type: Number, required: true }
});

netWorthSchema.pre('save', function(next) {
    const assetCategories = ['bank', 'investment', 'retirement', 'crypto', 'misc'];
    const liabilityCategories = ['loan', 'credit card'];

    const totalAssets = (this.cash || 0) + 
        (this.investments || 0) + 
        (this.retirementAccounts || 0) + 
        (this.realEstate || 0) + 
        (this.vehicles || 0) + 
        (this.personalProperty || 0) + 
        (this.otherAssets || 0) +
        this.customFields.filter(field => field.type === 'asset').reduce((a, b) => a + b.amount, 0) +
        this.accounts.filter(account => assetCategories.includes(account.category)).reduce((a, b) => a + b.amount, 0);
    
    const totalLiabilities = (this.liabilities || 0) + 
        this.customFields.filter(field => field.type === 'liability').reduce((a, b) => a + b.amount, 0) +
        this.accounts.filter(account => liabilityCategories.includes(account.category)).reduce((a, b) => a + b.amount, 0);
    
    this.netWorth = totalAssets - totalLiabilities;

    next();
});

const NetWorth = mongoose.models.NetWorth || mongoose.model('NetWorth', netWorthSchema);

module.exports = NetWorth;