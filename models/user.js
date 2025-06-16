const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const RetirementGoals = require('./RetirementGoals');
const NetWorth = require('./netWorth');
const RealEstate = require('./RealEstate');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    },
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  profileImage: {
    type: String,
  },
  isNewUser: {
    type: Boolean,
    default: true,
  },
  onboardingSteps: [{
        step: String,
        completed: Boolean,
  }],
  hasDeletedDummyData: {
    type: Boolean,
    default: false,
  },
  sessionActivity: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    location: {
      city: String,
      region: String,
      country: String
    }
  }]
}, { collection: 'users' });

userSchema.pre('save', async function(next) {
  const user = this;

  if (!user.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(user.password, salt);
    user.password = hash;

    if (!user.isNew) {
      user.isNewUser = false;
    }

    next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        console.log('Stored Hash:', this.password);
        console.log('Entered Password:', candidatePassword);

        const result = await bcrypt.compare(candidatePassword, this.password);
        console.log('Bcrypt Compare Result:', result);
        return result;
    } catch (error) {
        throw new Error(error);
    }
};

userSchema.post('save', async function(doc, next) {
  if (doc.isNewUser) {
    // Check if ghost entries already exist
    const existingEntries = await NetWorth.findOne({ user: doc._id });
    if (existingEntries) {
      console.log('Ghost entries already exist for user:', doc._id);
      return next();  // Skip creating duplicate entries
    }

    const defaultGoals = new RetirementGoals({
      userId: doc._id,
      currentAge: 35,
      retirementAge: 60,
      monthlySpend: 5500,
      mortgage: 22,
      cars: 3,
      healthCare: 12,
      foodAndDrinks: 10,
      travelAndEntertainment: 28,
      reinvestedFunds: 25
    });
    await defaultGoals.save();

    const demoProperty = new RealEstate({
      userId: doc._id,
      url: '/properties/demo-property',
      propertyAddress: '123 Demo Street, Demo City, CA',
      purchaseDate: new Date('2024-01-01'),
      purchasePrice: 200000,
      value: 250000,
      mortgageBalance: 200000,
      propertyType: 'Long-Term Rental', // ✅ must match schema enum
      rentCollected: {
        '2024-07-01': { amount: 1200, collected: true },
        '2024-06-01': { amount: 1200, collected: true }
      },
      expenses: [
        { category: 'maintenance', amount: 1000, date: new Date('2024-06-15') },
        { category: 'insurance', amount: 1500, date: new Date('2024-07-15') }
      ],
      documents: []
    });

    await demoProperty.save();

    // Create ghost entries
    const ghostEntries = [
      {
        user: doc._id,
        date: '2024-06-01',
        cash: 2000,
        investments: 7000,
        realEstate: 16000,
        retirementAccounts: 2800,
        vehicles: 3000,
        personalProperty: 1500,
        otherAssets: 500,
        liabilities: 4000,
        customFields: [],
        netWorth: 0 // This will be calculated automatically
      },
      {
        user: doc._id,
        date: '2024-05-01',
        cash: 1500,
        investments: 6000,
        realEstate: 12000,
        retirementAccounts: 2500,
        vehicles: 3500,
        personalProperty: 1700,
        otherAssets: 700,
        liabilities: 2500,
        customFields: [],
        netWorth: 0 // This will be calculated automatically
      },
      {
        user: doc._id,
        date: '2024-04-01',
        cash: 1000,
        investments: 5000,
        realEstate: 10000,
        retirementAccounts: 2200,
        vehicles: 3200,
        personalProperty: 1400,
        otherAssets: 600,
        liabilities: 3000,
        customFields: [],
        netWorth: 0 // This will be calculated automatically
      },
      {
        user: doc._id,
        date: '2024-03-01',
        cash: 1200,
        investments: 5500,
        realEstate: 11000,
        retirementAccounts: 2400,
        vehicles: 3400,
        personalProperty: 1500,
        otherAssets: 650,
        liabilities: 3200,
        customFields: [],
        netWorth: 0 // This will be calculated automatically
      }
    ];

    await NetWorth.insertMany(ghostEntries);
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
