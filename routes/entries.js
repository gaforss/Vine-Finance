const express = require('express');
const router = express.Router();
const NetWorth = require('../models/netWorth');
const User = require('../models/user');
const RealEstate = require('../models/RealEstate');
const { protect } = require('../middleware/authMiddleware');
const mixpanel = require('../mixpanel');

// Fetch all entries for the logged-in user
router.get('/', protect, async (req, res) => {
    try {
        const entries = await NetWorth.find({ user: req.user._id }).sort({ date: 'desc' });
        mixpanel.track('Viewed Entries', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });
        res.json(entries);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching entries');
    }
});

// Fetch a single entry by ID for the logged-in user
router.get('/:id', protect, async (req, res) => {
    try {
        const entry = await NetWorth.findOne({ _id: req.params.id, user: req.user._id });
        if (!entry) {
            return res.status(404).send('Entry not found');
        }
        mixpanel.track('Viewed Entry Detail', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            entryId: req.params.id,
            timestamp: new Date().toISOString()
        });
        res.json(entry);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Add a new net worth entry for the logged-in user
router.post('/add', protect, async (req, res) => {
    const { date, customFields } = req.body;

    // Sanitize numeric inputs
    const numericFields = ['cash', 'investments', 'realEstate', 'retirementAccounts', 'vehicles', 'personalProperty', 'otherAssets', 'liabilities'];
    const sanitizedData = { ...req.body };
    numericFields.forEach(field => {
        sanitizedData[field] = parseFloat(req.body[field]) || 0;
    });
    
    const { cash, investments, realEstate, retirementAccounts, vehicles, personalProperty, otherAssets, liabilities } = sanitizedData;

    // Check for existing entry with the same date and user
    const existingEntry = await NetWorth.findOne({ user: req.user._id, date: new Date(date).toISOString() });
    if (existingEntry) {
        return res.status(400).send('Entry for this date already exists');
    }

    const customFieldArray = customFields.map(field => ({
        name: field.name,
        amount: field.amount,
        type: field.type
    }));
    const totalAssets = cash + investments + realEstate + retirementAccounts + vehicles + personalProperty + otherAssets +
        customFieldArray.filter(field => field.type === 'asset').reduce((a, b) => a + b.amount, 0);
    const totalLiabilities = liabilities + 
        customFieldArray.filter(field => field.type === 'liability').reduce((a, b) => a + b.amount, 0);
    const netWorth = totalAssets - totalLiabilities;

    try {
        const newEntry = new NetWorth({
            user: req.user._id,
            date: new Date(date).toISOString(),
            cash, investments, realEstate, retirementAccounts, vehicles, personalProperty, otherAssets, liabilities, netWorth,
            customFields: customFieldArray
        });

        await newEntry.save();
        mixpanel.track('Added Net Worth Entry', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            netWorth,
            timestamp: new Date().toISOString()
        });

        res.status(201).send('Entry added successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error saving entry');
    }
});

// Edit an existing net worth entry by ID for the logged-in user
router.put('/edit/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { date, customFields } = req.body;

    // Sanitize numeric inputs
    const numericFields = ['cash', 'investments', 'realEstate', 'retirementAccounts', 'vehicles', 'personalProperty', 'otherAssets', 'liabilities'];
    const sanitizedData = { ...req.body };
    numericFields.forEach(field => {
        sanitizedData[field] = parseFloat(req.body[field]) || 0;
    });

    const { cash, investments, realEstate, retirementAccounts, vehicles, personalProperty, otherAssets, liabilities } = sanitizedData;

    const customFieldArray = customFields.map(field => ({
        name: field.name,
        amount: field.amount,
        type: field.type
    }));
    const totalAssets = cash + investments + realEstate + retirementAccounts + vehicles + personalProperty + otherAssets +
        customFieldArray.filter(field => field.type === 'asset').reduce((a, b) => a + b.amount, 0);
    const totalLiabilities = liabilities + 
        customFieldArray.filter(field => field.type === 'liability').reduce((a, b) => a + b.amount, 0);
    const netWorth = totalAssets - totalLiabilities;

    try {
        const updatedEntry = await NetWorth.findOneAndUpdate(
            { _id: id, user: req.user._id },
            {
                date: new Date(date).toISOString(),
                cash, investments, realEstate, retirementAccounts, vehicles, personalProperty, otherAssets, liabilities, netWorth,
                customFields: customFieldArray
            },
            { new: true }
        );

        if (!updatedEntry) {
            return res.status(404).send('Entry not found');
        }

        mixpanel.track('Updated Net Worth Entry', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            entryId: id,
            netWorth,
            timestamp: new Date().toISOString()
        });

        res.status(200).send('Entry updated successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating entry');
    }
});

// Delete an existing net worth entry by ID for the logged-in user
router.delete('/delete/:id', protect, async (req, res) => {
    const { id } = req.params;

    try {
        const deletedEntry = await NetWorth.findOneAndDelete({ _id: id, user: req.user._id });

        if (!deletedEntry) {
            return res.status(404).send('Entry not found');
        }

        mixpanel.track('Deleted Net Worth Entry', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            entryId: id,
            timestamp: new Date().toISOString()
        });

        res.status(200).send('Entry deleted successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting entry');
    }
});

// Delete all dummy data entries and demo property for a given user
router.delete('/deleteDummyData/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Delete NetWorth entries
        await NetWorth.deleteMany({ user: userId, date: { $in: ['2024-06-01', '2024-05-01', '2024-04-01', '2024-03-01'] } });

        // Delete Demo Property (or all real estate entries if applicable)
        await RealEstate.deleteMany({ userId: userId, name: 'Demo Property' });

        // Update the user's flag
        await User.findByIdAndUpdate(userId, { hasDeletedDummyData: true });

        mixpanel.track('Deleted Dummy Data', {
            distinct_id: userId,
            timestamp: new Date().toISOString()
        });

        res.status(200).send('Dummy data deleted');
    } catch (error) {
        console.error('Error deleting dummy data:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Fetch the last entry for the logged-in user
router.get('/last', protect, async (req, res) => {
    try {
        const lastEntry = await NetWorth.findOne({ user: req.user._id }).sort({ date: 'desc' });
        if (!lastEntry) {
            return res.status(404).send('No entries found');
        }
        res.json(lastEntry);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching last entry');
    }
});

module.exports = router;