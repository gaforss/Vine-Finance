const express = require('express');
const router = express.Router();
const RetirementGoals = require('../models/RetirementGoals');
const User = require('../models/user');
const NetWorth = require('../models/netWorth');
const mixpanel = require('../mixpanel');

router.get('/goals', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        let goals = await RetirementGoals.findOne({ userId });
        if (!goals) {
            // Return default values if no goals are found
            goals = {
                currentAge: 25,
                retirementAge: 60,
                monthlySpend: 7500,
                mortgage: 22,
                cars: 3,
                healthCare: 12,
                foodAndDrinks: 10,
                travelAndEntertainment: 28,
                reinvestedFunds: 25
            };
        }

        mixpanel.track('Retirement Goals Retrieved', {
            distinct_id: userId,
            timestamp: new Date().toISOString()
        });

        res.json(goals);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/goals', async (req, res) => {
    const userId = req.body.userId;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        const { currentAge, retirementAge, monthlySpend, mortgage, cars, healthCare, foodAndDrinks, travelAndEntertainment, reinvestedFunds } = req.body;

        let goals = await RetirementGoals.findOne({ userId });
        if (goals) {
            goals.currentAge = currentAge;
            goals.retirementAge = retirementAge;
            goals.monthlySpend = monthlySpend;
            goals.mortgage = mortgage;
            goals.cars = cars;
            goals.healthCare = healthCare;
            goals.foodAndDrinks = foodAndDrinks;
            goals.travelAndEntertainment = travelAndEntertainment;
            goals.reinvestedFunds = reinvestedFunds;
        } else {
            goals = new RetirementGoals({
                userId,
                currentAge,
                retirementAge,
                monthlySpend,
                mortgage,
                cars,
                healthCare,
                foodAndDrinks,
                travelAndEntertainment,
                reinvestedFunds
            });
        }

        await goals.save();

        mixpanel.track('Retirement Goals Updated', {
            distinct_id: userId,
            retirementAge,
            monthlySpend,
            timestamp: new Date().toISOString()
        });

        res.json({ message: 'Retirement goals saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/projections', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        let goals = await RetirementGoals.findOne({ userId });
        if (!goals) {
            // Provide default goals if none are found
            goals = {
                currentAge: 25,
                retirementAge: 65,
                monthlySpend: 5000,
                currentNetWorth: 0
            };
        }

        const { currentAge, retirementAge, monthlySpend, annualSavings } = goals;

        // Ensure correct retrieval of currentNetWorth
        let currentNetWorth = goals.currentNetWorth;
        if (!currentNetWorth || currentNetWorth === 0) {
            // Fetch the most recent net worth entry for the user if not present in goals
            const netWorthEntry = await NetWorth.findOne({ user: userId }).sort({ date: -1 });
            if (netWorthEntry) {
                const assetCategories = ['bank', 'investment', 'retirement', 'crypto', 'misc'];
                const liabilityCategories = ['loan', 'credit card'];

                const totalAssets = (netWorthEntry.cash || 0) + (netWorthEntry.investments || 0) + (netWorthEntry.retirementAccounts || 0) +
                                  (netWorthEntry.realEstate || 0) + (netWorthEntry.vehicles || 0) + (netWorthEntry.personalProperty || 0) +
                                  (netWorthEntry.otherAssets || 0) +
                                  (netWorthEntry.customFields || []).filter(field => field.type === 'asset').reduce((a, b) => a + (b.amount || 0), 0) +
                                  (netWorthEntry.accounts || []).filter(account => assetCategories.includes(account.category)).reduce((a, b) => a + (b.amount || 0), 0);

                const totalLiabilities = (netWorthEntry.liabilities || 0) +
                                       (netWorthEntry.customFields || []).filter(field => field.type === 'liability').reduce((a, b) => a + (b.amount || 0), 0) +
                                       (netWorthEntry.accounts || []).filter(account => liabilityCategories.includes(account.category)).reduce((a, b) => a + (b.amount || 0), 0);

                currentNetWorth = totalAssets - totalLiabilities;
            } else {
                // Default to 0 if no net worth data is found
                currentNetWorth = 0;
            }
        }

        const projectionYears = retirementAge - currentAge;

        const annualGrowthRates = [0.05, 0.07, 0.09, 0.11];

        const projections = annualGrowthRates.map(rate => {
            let futureValue = currentNetWorth;
            const projectionData = [];
            for (let i = 0; i < projectionYears; i++) {
                futureValue = (futureValue * (1 + rate)) + (annualSavings || 0);
                projectionData.push({
                    year: currentAge + i + 1,
                    value: futureValue
                });
            }
            return {
                rate: rate * 100,
                data: projectionData,
                currentAge,
                retirementAge
            };
        });

        mixpanel.track('Retirement Projections Generated', {
            distinct_id: userId,
            currentNetWorth,
            retirementAge,
            monthlySpend,
            timestamp: new Date().toISOString()
        });

        const sevenPercentProjection = projections.find(projection => Math.abs(projection.rate - 7) < 0.01);
        const totalAtRetirement = sevenPercentProjection && sevenPercentProjection.data && sevenPercentProjection.data.length > 0 ? sevenPercentProjection.data[sevenPercentProjection.data.length - 1].value : currentNetWorth;

        const requiredSavings = monthlySpend * 12 * Math.max(30, 85 - retirementAge);
        const intersectionData = sevenPercentProjection && sevenPercentProjection.data ? sevenPercentProjection.data.find(d => d.value >= requiredSavings) : null;
        const intersectionAge = intersectionData ? intersectionData.year : 'N/A';
        const goalMet = !!intersectionData;
        const shortfall = goalMet ? 0 : requiredSavings - totalAtRetirement;

        res.json({
            projections,
            currentNetWorth,
            totalAtRetirement,
            intersectionAge,
            goalMet,
            shortfall,
            requiredSavings
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/networth/comparison', async (req, res) => {
    try {
        const userId = req.query.userId; 
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let userAge;
        if (user.age) {
            userAge = user.age;
        } else {
            const goals = await RetirementGoals.findOne({ userId });
            if (goals && goals.currentAge) {
                userAge = goals.currentAge;
            } else {
                userAge = 25; // Default to 25 if no age is found
            }
        }

        const netWorthEntries = await NetWorth.find({ user: userId }).sort({ date: -1 });
        let userNetWorth;

        if (netWorthEntries.length > 0) {
            const entry = netWorthEntries[0];
            const assetCategories = ['bank', 'investment', 'retirement', 'crypto', 'misc'];
            const liabilityCategories = ['loan', 'credit card'];

            const totalAssets = (entry.cash || 0) + (entry.investments || 0) + (entry.retirementAccounts || 0) + (entry.realEstate || 0) +
                                (entry.vehicles || 0) + (entry.personalProperty || 0) + (entry.otherAssets || 0) +
                                (entry.customFields || []).filter(field => field.type === 'asset').reduce((a, b) => a + (b.amount || 0), 0) +
                                (entry.accounts || []).filter(account => assetCategories.includes(account.category)).reduce((a, b) => a + (b.amount || 0), 0);
            
            const totalLiabilities = (entry.liabilities || 0) +
                                   (entry.customFields || []).filter(field => field.type === 'liability').reduce((a, b) => a + (b.amount || 0), 0) +
                                   (entry.accounts || []).filter(account => liabilityCategories.includes(account.category)).reduce((a, b) => a + (b.amount || 0), 0);

            userNetWorth = totalAssets - totalLiabilities;
        } else {
            userNetWorth = 0; // Default to 0 if no net worth data found
        }

        const ageGroups = [
            { min: 18, max: 29, average: 281550 },
            { min: 30, max: 39, average: 711400 },
            { min: 40, max: 49, average: 1313700 },
            { min: 50, max: 59, average: 2629060 },
            { min: 60, max: 69, average: 2808600 },
            { min: 70, max: Infinity, average: 2547700 }
        ];

        const ageGroup = ageGroups.find(group => userAge >= group.min && userAge <= group.max);

        res.json({
            userNetWorth: userNetWorth,
            ageGroupAverage: ageGroup ? ageGroup.average : 0 // Handle case where ageGroup is not found
        });
    } catch (error) {
        console.error('Error in /networth/comparison:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add draft saving route
router.post('/goals/draft', async (req, res) => {
    const userId = req.body.userId;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        const { currentAge, retirementAge, monthlySpend, mortgage, cars, healthCare, foodAndDrinks, travelAndEntertainment, reinvestedFunds } = req.body;

        // Save draft to a separate collection or add a draft flag
        let draft = await RetirementGoals.findOne({ userId, isDraft: true });
        if (draft) {
            draft.currentAge = currentAge;
            draft.retirementAge = retirementAge;
            draft.monthlySpend = monthlySpend;
            draft.mortgage = mortgage;
            draft.cars = cars;
            draft.healthCare = healthCare;
            draft.foodAndDrinks = foodAndDrinks;
            draft.travelAndEntertainment = travelAndEntertainment;
            draft.reinvestedFunds = reinvestedFunds;
            draft.isDraft = true;
            draft.lastUpdated = new Date();
        } else {
            draft = new RetirementGoals({
                userId,
                currentAge,
                retirementAge,
                monthlySpend,
                mortgage,
                cars,
                healthCare,
                foodAndDrinks,
                travelAndEntertainment,
                reinvestedFunds,
                isDraft: true,
                lastUpdated: new Date()
            });
        }

        await draft.save();

        mixpanel.track('Retirement Goals Draft Saved', {
            distinct_id: userId,
            timestamp: new Date().toISOString()
        });

        res.json({ message: 'Draft saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Add route to get draft
router.get('/goals/draft', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        const draft = await RetirementGoals.findOne({ userId, isDraft: true });
        if (!draft) {
            return res.status(404).json({ message: 'No draft found' });
        }

        res.json(draft);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;