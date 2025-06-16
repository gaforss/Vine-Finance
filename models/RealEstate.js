const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    category: {
        type: String,
        enum: ['repairs', 'maintenance', 'property management', 'utilities', 'hoa', 'property tax', 'insurance', 'other'],
        required: true
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true }
}, { _id: true });

// Mongoose middleware to convert category to lowercase before validation
expenseSchema.pre('validate', function(next) {
    if (this.category) {
        this.category = this.category.toLowerCase();
    }
    next();
});

const rentDetailSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    collected: { type: Boolean, default: false }
}, { _id: false });

const documentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['property_tax', 'expense', 'insurance', 'misc'],
        required: true
    },
    path: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const shortTermIncomeSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    notes: { type: String }
}, { _id: true });

const vacancySchema = new mongoose.Schema({
    startDate: { type: Date, required: true },
    endDate: { type: Date }
}, { _id: true });

const unitSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rentAmount: { type: Number, required: true },
    tenant: { type: String }, // Could be expanded to a full tenant schema
    leaseStartDate: { type: Date },
    leaseEndDate: { type: Date }
}, { _id: true });

const valueHistorySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    value: { type: Number, required: true }
});

const realEstateSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    propertyAddress: {
        type: String,
        required: true,
        unique: true
    },
    purchaseDate: {
        type: Date
    },
    purchasePrice: {
        type: Number
    },
    url: {
        type: String,
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    mortgageBalance: {
        type: Number,
        default: 0
    },
    propertyType: {
        type: String,
        enum: ['Primary Residence', 'Long-Term Rental', 'Short-Term Rental'],
        required: true
    },
    units: {
        type: [unitSchema],
        default: []
    },
    valueHistory: {
        type: [valueHistorySchema],
        default: []
    },
    rentCollected: {
        type: Map,
        of: rentDetailSchema,
        default: {}
    },
    shortTermIncome: {
        type: [shortTermIncomeSchema],
        default: []
    },
    vacancies: {
        type: [vacancySchema],
        default: []
    },
    expenses: {
        type: [expenseSchema],
        default: []
    },
    documents: {
        type: [documentSchema],
        default: []
    }
});

module.exports = mongoose.model('RealEstate', realEstateSchema);