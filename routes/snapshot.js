const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const PlaidToken = require('../models/plaidToken');
const NetWorth = require('../models/netWorth');
const plaidClient = require('../plaid');
const cache = require('../config/cache');

// Helper function to get Plaid accounts - avoiding duplication
async function getPlaidAccounts(userId) {
    const plaidToken = await PlaidToken.findOne({ userId });
    if (!plaidToken) return [];

    let allAccounts = [];
    for (const item of plaidToken.items) {
        try {
            const response = await plaidClient.accountsGet({ access_token: item.accessToken });
            allAccounts = allAccounts.concat(response.data.accounts);
        } catch (error) {
            console.error(`Error fetching accounts for item ${item.itemId}:`, error);
        }
    }
    return allAccounts;
}

router.get('/financial-snapshot', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const cacheKey = `financial_snapshot_${userId}`;
        const cachedData = cache.get(cacheKey);

        if (cachedData) {
            return res.json(cachedData);
        }

        // 1. Get latest manual net worth entry - THIS IS THE SOURCE OF TRUTH FOR TOTALS
        const latestEntry = await NetWorth.findOne({ user: userId }).sort({ date: -1 });

        if (!latestEntry) {
            return res.status(404).json({ error: 'No net worth entries found. Please create one.' });
        }
        
        // These are the correct, user-provided totals.
        const totalAssets = (latestEntry.cash || 0) +
                              (latestEntry.investments || 0) +
                              (latestEntry.realEstate || 0) +
                              (latestEntry.retirementAccounts || 0) +
                              (latestEntry.vehicles || 0) +
                              (latestEntry.personalProperty || 0) +
                              (latestEntry.otherAssets || 0);
        const totalLiabilities = latestEntry.liabilities || 0;
        const netWorth = totalAssets - totalLiabilities;


        // 2. Get Plaid account data *only* to calculate LIQUID assets for the learning module.
        const plaidAccounts = await getPlaidAccounts(userId);
        let liquidAssets = 0;
        plaidAccounts.forEach(account => {
            const balance = account.balances.current || 0;
            const subtype = account.subtype;
            if (subtype === 'checking' || subtype === 'savings' || subtype === 'money market') {
                liquidAssets += balance;
            }
        });

        // 3. Construct the snapshot with the CORRECT totals and the SPECIFIC liquid asset value.
        const snapshot = {
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: netWorth,
            liquidAssets: liquidAssets,
        };
        
        cache.set(cacheKey, snapshot, 600);
        res.json(snapshot);

    } catch (error) {
        console.error('Error fetching financial snapshot:', error);
        res.status(500).json({ error: 'Failed to fetch financial snapshot' });
    }
});

module.exports = router; 