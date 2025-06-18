console.log('LOADED plaid.js - check for this line on server start');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const plaidClient = require('../plaid');
const plaid = require('plaid');
const NetWorth = require('../models/netWorth');
const PlaidToken = require('../models/plaidToken');
const { protect } = require('../middleware/authMiddleware');
const mixpanel = require('../mixpanel');
const cache = require('../config/cache');

router.use((req, res, next) => {
  console.log('[Plaid Router][DEBUG] Incoming request:', req.method, req.originalUrl, 'path:', req.path, 'url:', req.url);
  next();
});

// Create a Plaid link token
router.post('/create_link_token', protect, async (req, res, next) => {
    console.log('[POST /plaid/create_link_token] - Received request to create link token for user:', req.user._id);
    try {
        const response = await plaidClient.linkTokenCreate({
            user: { client_user_id: req.user._id.toString() },
            client_name: 'Net Worth App',
            products: ['auth', 'transactions', 'investments'],
            country_codes: ['US'],
            language: 'en',
        });
        mixpanel.track('Plaid Link Token Created', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });
        console.log('[POST /plaid/create_link_token] - Successfully created link token for user:', req.user._id);
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Exchange public token for access token
router.post('/exchange_public_token', protect, async (req, res) => {
    console.log('[POST /plaid/exchange_public_token] - Received request to exchange public token for user:', req.user._id);
    try {
        const { public_token, institutionName } = req.body;
        const response = await plaidClient.itemPublicTokenExchange({ public_token });
        const accessToken = response.data.access_token;
        const itemID = response.data.item_id;

        let plaidToken = await PlaidToken.findOne({ userId: req.user._id });

        const newItem = { accessToken, itemId: itemID, institutionName };

        if (!plaidToken) {
            plaidToken = new PlaidToken({
                userId: req.user._id,
                items: [newItem]
            });
        } else {
            plaidToken.items.push(newItem);
        }
        await plaidToken.save();
        console.log('[POST /plaid/exchange_public_token] - Successfully exchanged public token and saved access token for user:', req.user._id);
        
        // Invalidate cache for this user
        cache.del(`accounts_${req.user._id}`);

        mixpanel.track('Plaid Public Token Exchanged', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            itemId: itemID,
            timestamp: new Date().toISOString()
        });
        
        const plaidItemsCount = plaidToken.items.length;
        const manualAccountsCount = await NetWorth.countDocuments({ user: req.user._id, manual: true });
        const isFirstAccount = plaidItemsCount === 1 && manualAccountsCount === 0;


        res.json({ 
            message: "Public token exchanged successfully.",
            isFirstAccount: isFirstAccount 
        });
    } catch (error) {
        console.error('Error exchanging public token:', error);
        res.status(500).json({ error: 'Something went wrong while exchanging public token.' });
    }
});

// Retrieve accounts
router.get('/accounts', protect, async (req, res) => {
    console.log('[GET /plaid/accounts] - Received request to fetch accounts for user:', req.user._id);
    try {
        const plaidToken = await PlaidToken.findOne({ userId: req.user._id });
        if (!plaidToken || plaidToken.items.length === 0) {
            console.log(`No Plaid items found for user: ${req.user._id}. Returning empty array.`);
            return res.json([]);
        }

        let allAccounts = [];
        for (const item of plaidToken.items) {
            try {
                const response = await plaidClient.accountsGet({
                    access_token: item.accessToken,
                });

                const accountsWithDetails = await Promise.all(response.data.accounts.map(async (account) => {
                    try {
                        const institutionResponse = await plaidClient.institutionsGetById({
                            institution_id: response.data.item.institution_id,
                            country_codes: ['US'],
                        });
                        account.institutionLogo = institutionResponse.data.institution.logo;
                        account.institutionName = institutionResponse.data.institution.name;
                    } catch (error) {
                        console.error(`Could not fetch institution details for ${response.data.item.institution_id}:`, error);
                        account.institutionLogo = null;
                        account.institutionName = 'N/A';
                    }
                    return account;
                }));
                allAccounts = allAccounts.concat(accountsWithDetails);
            } catch (error) {
                console.error(`Error fetching accounts for item ${item.itemId}:`, error);
                // Decide how to handle per-item errors. Maybe skip or collect errors.
                // For now, just logging and continuing.
            }
        }

        console.log('Accounts retrieved from Plaid:', allAccounts);
        const accounts = allAccounts;

        const categorizedAccounts = {
            bankAccounts: accounts.filter(account => ['checking', 'savings', 'money market', 'prepaid'].includes(account.subtype)),
            creditCards: accounts.filter(account => account.subtype === 'credit card'),
            loans: accounts.filter(account => ['loan', 'student'].includes(account.subtype)),
            investments: accounts.filter(account => ['cd', 'brokerage', '529', 'investment'].includes(account.subtype)),
            retirement: accounts.filter(account => ['401k', 'ira', 'roth'].includes(account.subtype)),
            insurance: accounts.filter(account => ['life', 'disability'].includes(account.subtype)),
            digital: accounts.filter(account => ['cryptocurrency', 'paypal', 'venmo'].includes(account.subtype)),
            miscellaneous: accounts.filter(account => ![
                'checking', 'savings', 'money market', 'prepaid', 'credit card',
                'loan', 'student', 'cd', 'brokerage', '529', 'investment',
                '401k', 'ira', 'roth', 'life', 'disability', 'cryptocurrency',
                'paypal', 'venmo'
            ].includes(account.subtype)),
        };

        console.log('Categorized accounts:', categorizedAccounts);

        mixpanel.track('Accounts Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        console.log('[GET /plaid/accounts] - Successfully fetched and categorized accounts for user:', req.user._id);
        res.json(categorizedAccounts);
    } catch (error) {
        console.error('Error retrieving accounts:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Retrieve investment holdings
router.get('/investments/holdings', protect, async (req, res) => {
    try {
        const plaidToken = await PlaidToken.findOne({ userId: req.user._id });
        if (!plaidToken || plaidToken.items.length === 0) {
            return res.status(400).json({ error: 'No Plaid token found for this user.' });
        }

        let allHoldings = [];
        for (const item of plaidToken.items) {
            try {
                const response = await plaidClient.investmentsHoldingsGet({
                    access_token: item.accessToken,
                });
                allHoldings = allHoldings.concat(response.data.holdings);
            } catch (error) {
                console.error(`Error fetching investment holdings for item ${item.itemId}:`, error);
            }
        }

        mixpanel.track('Investment Holdings Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(allHoldings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Retrieve credit card accounts
router.get('/credit_cards', protect, async (req, res) => {
    try {
        const allAccounts = await getAllPlaidAccounts(req.user._id);
        const creditCards = allAccounts.filter(account => account.subtype === 'credit card');

        mixpanel.track('Credit Card Accounts Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(creditCards);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Retrieve loan accounts
router.get('/loans', protect, async (req, res) => {
    try {
        const allAccounts = await getAllPlaidAccounts(req.user._id);
        const loans = allAccounts.filter(account => account.subtype === 'loan');

        mixpanel.track('Loan Accounts Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(loans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Retrieve retirement accounts
router.get('/retirement', protect, async (req, res) => {
    try {
        const allAccounts = await getAllPlaidAccounts(req.user._id);
        const retirementAccounts = allAccounts.filter(account => 
            ['401k', 'ira', 'roth', 'other_retirement_type'].includes(account.subtype)
        );

        mixpanel.track('Retirement Accounts Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(retirementAccounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});


// Retrieve digital/crypto accounts
router.get('/digital', protect, async (req, res) => {
    try {
        const allAccounts = await getAllPlaidAccounts(req.user._id);
        const digitalAccounts = allAccounts.filter(account => ['cryptocurrency', 'paypal'].includes(account.subtype));

        mixpanel.track('Digital Accounts Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(digitalAccounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Retrieve miscellaneous accounts
router.get('/miscellaneous', protect, async (req, res) => {
    try {
        const allAccounts = await getAllPlaidAccounts(req.user._id);
        const miscellaneousAccounts = allAccounts.filter(account => ![
                'checking', 'savings', 'money market', 'prepaid', 'credit card',
                'loan', 'student', 'cd', 'brokerage', '529', 'investment',
                '401k', 'ira', 'roth', 'life', 'disability', 'cryptocurrency',
                'paypal', 'venmo'
            ].includes(account.subtype));

        mixpanel.track('Miscellaneous Accounts Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(miscellaneousAccounts);
    } catch (error) {
        console.error('Error getting miscellaneous accounts:', error.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Retrieve insurance accounts
router.get('/insurance', protect, async (req, res) => {
    try {
        const allAccounts = await getAllPlaidAccounts(req.user._id);
        const insuranceAccounts = allAccounts.filter(account => ['life', 'disability'].includes(account.subtype));
        
        mixpanel.track('Insurance Accounts Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(insuranceAccounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Transactions Endpoint for Cash Flow Analysis
router.get('/transactions/cashflow', async (req, res) => {
    console.log('[Cash Flow][DEBUG] Entered /transactions/cashflow route');
    try {
        const userId = req.user._id;
        const cacheKey = `transactions_cash_flow_${userId}`;
        const cachedTransactions = cache.get(cacheKey);

        if (cachedTransactions) {
            console.log(`[Cash Flow] Returning cached data for key: ${cacheKey}`);
            return res.json(cachedTransactions);
        }

        const plaidToken = await PlaidToken.findOne({ userId });

        if (!plaidToken) {
            return res.status(400).json({ error: 'No Plaid token found for this user.' });
        }

        console.log(`[Cash Flow] Found ${plaidToken.items.length} Plaid items for user ${userId}.`);
        let allTransactions = [];
        for (const item of plaidToken.items) {
            try {
                const endDate = new Date();
                const startDate = new Date();
                // TEMP: Use last 30 days instead of last 365 days for debugging
                startDate.setDate(endDate.getDate() - 30);
                const startDateString = startDate.toISOString().split('T')[0];
                const endDateString = endDate.toISOString().split('T')[0];
                console.log(`[Cash Flow][DEBUG] Fetching transactions for item ${item.itemId} (${item.institutionName}) from ${startDateString} to ${endDateString}`);

                const response = await plaidClient.transactionsGet({
                    access_token: item.accessToken,
                    start_date: startDateString,
                    end_date: endDateString,
                });
                console.log(`[Cash Flow][DEBUG] Received ${response.data.transactions.length} transactions for item ${item.itemId} (${item.institutionName})`);
                allTransactions = allTransactions.concat(response.data.transactions);
            } catch (error) {
                console.error(`[Cash Flow][DEBUG] Error fetching transactions for item ${item.itemId}:`, error.response ? error.response.data : error.message);
            }
        }

        mixpanel.track('Transactions Retrieved for Cash Flow', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        console.log(`[Cash Flow][DEBUG] Total transactions fetched: ${allTransactions.length}. Sending to client.`);
        // Only cache if there are transactions to avoid caching empty arrays
        if (allTransactions.length > 0) {
            cache.set(cacheKey, allTransactions);
            console.log(`[Cash Flow][DEBUG] Cached transactions for key: ${cacheKey}. Cache set!`);
        } else {
            console.log(`[Cash Flow][DEBUG] No transactions to cache for key: ${cacheKey}.`);
        }
        res.json(allTransactions);
    } catch (error) {
        console.error('[Cash Flow][DEBUG] Error fetching transactions:', error);
        res.status(500).json({ error: 'Something went wrong fetching transactions' });
    }
});

// Retrieve transactions for an account
router.get('/transactions/:accountId', protect, async (req, res) => {
    try {
        const { accountId } = req.params;
        const cacheKey = `transactions_${accountId}`;
        const cachedTransactions = cache.get(cacheKey);

        if (cachedTransactions) {
            console.log(`Returning cached transactions for account: ${accountId}`);
            return res.json(cachedTransactions);
        }

        const plaidToken = await PlaidToken.findOne({ userId: req.user._id });

        if (!plaidToken || plaidToken.items.length === 0) {
            return res.status(400).json({ error: 'No Plaid token found for this user.' });
        }

        const transactionPromises = plaidToken.items.map(item => {
            return plaidClient.transactionsGet({
                access_token: item.accessToken,
                start_date: '2023-01-01', 
                end_date: new Date().toISOString().split('T')[0],
                options: {
                    account_ids: [accountId],
                }
            }).catch(error => {
                // This catch is for Promise.all to not fail fast.
                // We'll inspect the error later.
                return { error: error, itemId: item.itemId };
            });
        });

        const results = await Promise.all(transactionPromises);

        let transactions = [];
        let lastError = null;

        for (const result of results) {
            if (result.error) {
                const errorCode = result.error.response?.data?.error_code;
                if (errorCode !== 'INVALID_FIELD' && errorCode !== 'PRODUCT_NOT_READY') {
                    // This is a more serious error we should log.
                    console.error(`Unexpected error fetching transactions for item ${result.itemId}:`, result.error.response?.data || result.error.message);
                    lastError = result.error;
                }
            } else if (result.data.transactions.length > 0) {
                transactions = result.data.transactions;
                break; // Found transactions, no need to check other items.
            }
        }

        if (transactions.length > 0) {
            cache.set(cacheKey, transactions);
            return res.json(transactions);
        }
        
        if (lastError) {
            // If we had a real error and didn't find transactions
            throw lastError;
        }
        
        // No "real" errors and no transactions found.
        return res.json([]);

    } catch (error) {
        console.error('Error retrieving transactions:', error.response?.data || error.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

router.get('/categorized-spending', protect, async (req, res) => {
    try {
        const { year, month, quarter, start, end, date } = req.query;
        const userId = req.user._id;

        if (!year && !month && !quarter && !start && !end && !date) {
            return res.status(400).json({ error: 'At least one time parameter (year, month, quarter, start, end, date) is required.' });
        }

        const cacheKey = `categorized-spending_${userId}_${year || ''}_${month || ''}_${quarter || ''}_${start || ''}_${end || ''}_${date || ''}`;
        const cachedData = cache.get(cacheKey);

        if (cachedData) {
            console.log(`Returning cached categorized spending data for key: ${cacheKey}`);
            return res.json(cachedData);
        }

        const plaidToken = await PlaidToken.findOne({ userId });

        if (!plaidToken) {
            return res.status(400).json({ error: 'No Plaid token found for this user.' });
        }

        let startDate, endDate;

        // Determine date range
        if (year && month) {
            startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
            endDate = new Date(year, month, 0).toISOString().split('T')[0];
        } else if (year && quarter) {
            const startMonth = (quarter - 1) * 3;
            startDate = new Date(year, startMonth, 1).toISOString().split('T')[0];
            endDate = new Date(year, startMonth + 3, 0).toISOString().split('T')[0];
        } else if (year) {
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
        } else if (start && end) {
            startDate = start;
            endDate = end;
        } else if (date) {
            startDate = date;
            endDate = date;
        }

        let allTransactions = [];
        for (const item of plaidToken.items) {
            try {
                const response = await plaidClient.transactionsGet({
                    access_token: item.accessToken,
                    start_date: startDate,
                    end_date: endDate,
                });
                allTransactions = allTransactions.concat(response.data.transactions);
            } catch (error) {
                console.error(`Error fetching transactions for item ${item.itemId}:`, error);
            }
        }

        const categorizedSpending = categorizeTransactions(allTransactions);

        mixpanel.track('Categorized Spending Retrieved', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });

        if (categorizedSpending.length > 0) {
            cache.set(cacheKey, categorizedSpending);
        }
        res.json(categorizedSpending);
    } catch (error) {
        console.error('Error fetching categorized spending:', error);
        res.status(500).json({ error: 'Something went wrong fetching categorized spending' });
    }
});

function categorizeTransactions(transactions) {
    const categories = transactions.reduce((acc, transaction) => {
        const category = transaction.category[0] || 'Uncategorized';
        const amount = Math.abs(transaction.amount);

        if (!acc[category]) {
            acc[category] = 0;
        }

        acc[category] += amount;
        return acc;
    }, {});

    return Object.keys(categories).map(category => ({
        _id: category,
        totalAmount: categories[category]
    }));
}

router.post('/manual_account', protect, async (req, res) => {
    try {
        const { name, amount, category } = req.body;

        if (!name || !amount || !category) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let netWorth = await NetWorth.findOne({ user: req.user._id });

        if (!netWorth) {
            netWorth = new NetWorth({
                user: req.user._id,
                date: new Date(),
                accounts: [],
                cash: 0,
                investments: 0,
                realEstate: 0,
                retirementAccounts: 0,
                liabilities: 0,
                netWorth: 0
            });
        }

        const newAccount = {
            name,
            amount: parseFloat(amount),
            category,
            manuallyAdded: true,
            type: 'manual'
        };

        // Add the new account
        netWorth.accounts.push(newAccount);

        // Recalculate net worth before saving
        const assetCategories = ['bank', 'investment', 'retirement', 'crypto', 'misc'];
        const liabilityCategories = ['loan', 'credit card'];

        const totalAssets = netWorth.cash + netWorth.realEstate + netWorth.vehicles + netWorth.personalProperty + netWorth.otherAssets +
            netWorth.customFields.filter(field => field.type === 'asset').reduce((a, b) => a + b.amount, 0) +
            netWorth.accounts.filter(account => assetCategories.includes(account.category)).reduce((a, b) => a + b.amount, 0);

        const totalLiabilities = netWorth.liabilities + 
            netWorth.customFields.filter(field => field.type === 'liability').reduce((a, b) => a + b.amount, 0) +
            netWorth.accounts.filter(account => liabilityCategories.includes(account.category)).reduce((a, b) => a + b.amount, 0);

        netWorth.netWorth = totalAssets - totalLiabilities;

        await netWorth.save();

        res.status(200).json({ message: 'Account added successfully', account: newAccount });
    } catch (error) {
        console.error('Error adding manual account:', error);
        res.status(500).json({ error: 'An error occurred while saving the account to the database.' });
    }
});


// Route to fetch manually added accounts
router.get('/manual_accounts', protect, async (req, res) => {
    try {
        const netWorth = await NetWorth.findOne({ user: req.user._id });

        if (!netWorth || !netWorth.accounts) {
            return res.status(200).json([]);
        }

        // Filter manually added accounts and add the type property for frontend identification
        const manualAccounts = netWorth.accounts
            .filter(account => account.manuallyAdded)
            .map(account => {
                const accObj = account.toObject();
                accObj.type = 'manual';
                return accObj;
            });

        return res.status(200).json(manualAccounts);
    } catch (error) {
        console.error('Error fetching manual accounts:', error);
        return res.status(500).json({ error: 'Failed to fetch manual accounts' });
    }
});


router.put('/manual_account/:accountId', protect, async (req, res) => {
    try {
        const { accountId } = req.params;
        const { name, amount, category } = req.body;

        if (!name || !amount || !category) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let netWorth = await NetWorth.findOne({ user: req.user._id });

        if (!netWorth) {
            return res.status(404).json({ message: 'Net worth data not found' });
        }

        const accountIndex = netWorth.accounts.findIndex(account => account._id.toString() === accountId);

        if (accountIndex === -1) {
            return res.status(404).json({ message: 'Account not found' });
        }

        // Update the account details
        netWorth.accounts[accountIndex].name = name;
        netWorth.accounts[accountIndex].amount = amount;
        netWorth.accounts[accountIndex].category = category;

        // Recalculate net worth
        const totalAssets = netWorth.cash + netWorth.investments + netWorth.realEstate + netWorth.retirementAccounts +
            netWorth.vehicles + netWorth.personalProperty + netWorth.otherAssets +
            netWorth.customFields.filter(field => field.type === 'asset').reduce((a, b) => a + b.amount, 0) +
            netWorth.accounts.filter(account => ['bank', 'investment', 'retirement'].includes(account.category)).reduce((a, b) => a + b.amount, 0);
        
        const totalLiabilities = netWorth.liabilities + 
            netWorth.customFields.filter(field => field.type === 'liability').reduce((a, b) => a + b.amount, 0) +
            netWorth.accounts.filter(account => ['loan', 'credit card'].includes(account.category)).reduce((a, b) => a + b.amount, 0);
        
        netWorth.netWorth = totalAssets - totalLiabilities;

        await netWorth.save();

        return res.status(200).json({ message: 'Account updated successfully', account: netWorth.accounts[accountIndex] });
    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// New endpoint for all accounts
router.get('/all_accounts', protect, async (req, res) => {
    try {
        console.log(`GET /all_accounts called for user: ${req.user._id}`);
        const allAccounts = await getAllPlaidAccounts(req.user._id);
        const categorizedAccounts = {
            bankAccounts: allAccounts.filter(account => ['checking', 'savings', 'money market', 'prepaid'].includes(account.subtype)),
            creditCards: allAccounts.filter(account => account.subtype === 'credit card'),
            loans: allAccounts.filter(account => ['loan', 'student'].includes(account.subtype)),
            investments: allAccounts.filter(account => ['cd', 'brokerage', '529', 'investment'].includes(account.subtype)),
            retirement: allAccounts.filter(account => ['401k', 'ira', 'roth'].includes(account.subtype)),
            insurance: allAccounts.filter(account => ['life', 'disability'].includes(account.subtype)),
            digital: allAccounts.filter(account => ['cryptocurrency', 'paypal', 'venmo'].includes(account.subtype)),
            miscellaneous: allAccounts.filter(account => ![
                'checking', 'savings', 'money market', 'prepaid', 'credit card',
                'loan', 'student', 'cd', 'brokerage', '529', 'investment',
                '401k', 'ira', 'roth', 'life', 'disability', 'cryptocurrency',
                'paypal', 'venmo'
            ].includes(account.subtype)),
        };
        console.log(`Returning ${allAccounts.length} accounts categorized for user: ${req.user._id}`);
        res.json(categorizedAccounts);
    } catch (error) {
        console.error('Error fetching all accounts:', error);
        res.status(500).json({ error: 'Failed to fetch all accounts' });
    }
});

// Delete a manual account
router.delete('/manual_account/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await NetWorth.updateOne(
            { user: req.user._id },
            { $pull: { accounts: { _id: id } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Manual account not found or you do not have permission to delete it.' });
        }
        
        res.json({ message: 'Manual account deleted successfully.' });

    } catch (error) {
        console.error('Error deleting manual account:', error);
        res.status(500).json({ error: 'Failed to delete manual account.' });
    }
});

async function fetchPlaidAccounts(userId) {
    const plaidToken = await PlaidToken.findOne({ userId });
    if (!plaidToken) {
        console.error('No Plaid token found for user:', userId);
        return [];
    }

    const response = await plaidClient.accountsGet({ access_token: plaidToken.accessToken });
    const accountsResponse = await plaidClient.accountsGet({ access_token: plaidToken.accessToken });
    let accounts = await Promise.all(accountsResponse.data.accounts.map(async (account) => {
        try {
            const institutionResponse = await plaidClient.institutionsGetById({
                institution_id: account.institution_id,
                country_codes: ['US'],
            });
            account.institutionLogo = institutionResponse.data.institution.logo;
        } catch (error) {
            console.error(`Could not fetch institution logo for ${account.institution_id}:`, error);
            account.institutionLogo = null; // Set logo to null if fetch fails
        }
        return account;
    }));

    const plaidAccounts = accounts.map(account => ({
        _id: account.account_id,
        name: account.name,
        amount: account.balances.current,
        category: categorizePlaidAccount(account.subtype),
        institutionLogo: account.institutionLogo
    }));

    return plaidAccounts;
}


function categorizePlaidAccount(subtype) {
    if (['checking', 'savings', 'money market', 'prepaid'].includes(subtype)) return 'bank';
    if (subtype === 'credit card') return 'credit card';
    if (['loan', 'student'].includes(subtype)) return 'loan';
    if (['cd', 'brokerage', '529', 'investment'].includes(subtype)) return 'investment';
    if (['401k', 'ira', 'roth'].includes(subtype)) return 'retirement';
    if (['life', 'disability'].includes(subtype)) return 'insurance';
    if (['cryptocurrency', 'paypal'].includes(subtype)) return 'crypto';
    return 'misc';
}

async function getAllPlaidAccounts(userId) {
    console.log(`getAllPlaidAccounts called for userId: ${userId}`);
    const cacheKey = `accounts_${userId}`;
    const cachedAccounts = cache.get(cacheKey);

    if (cachedAccounts) {
        console.log(`Returning cached accounts for user: ${userId}`);
        return cachedAccounts;
    }

    console.log(`No cached accounts found for user: ${userId}. Fetching from Plaid.`);
    const plaidToken = await PlaidToken.findOne({ userId: userId });
    if (!plaidToken || plaidToken.items.length === 0) {
        console.log(`No Plaid token or items found for user: ${userId}`);
        return [];
    }

    console.log(`Found ${plaidToken.items.length} items for user: ${userId}`);
    let allAccounts = [];
    for (const item of plaidToken.items) {
        try {
            console.log(`Fetching accounts for item: ${item.itemId} (${item.institutionName})`);
            const response = await plaidClient.accountsGet({
                access_token: item.accessToken,
            });
            const accountsWithInstName = response.data.accounts.map(acc => ({...acc, institutionName: item.institutionName}));
            allAccounts = allAccounts.concat(accountsWithInstName);
            console.log(`Fetched ${response.data.accounts.length} accounts for item ${item.itemId}`);
        } catch (error) {
            console.error(`Error fetching accounts for item ${item.itemId}:`, error);
        }
    }
    console.log(`Returning a total of ${allAccounts.length} accounts for user ${userId}`);
    
    // Store in cache
    cache.set(cacheKey, allAccounts);

    return allAccounts;
}

// Route to get all balances
router.get('/api/all-balances', protect, async (req, res) => {
    try {
        const allAccounts = await getAllPlaidAccounts(req.user._id);

        const balances = {
            cash: 0,
            investments: 0,
            retirement: 0,
            liabilities: 0
        };

        allAccounts.forEach(account => {
            const balance = account.balances.current;
            switch (account.type) {
                case 'depository':
                    balances.cash += balance;
                    break;
                case 'investment':
                    balances.investments += balance;
                    break;
                case 'retirement':
                    balances.retirement += balance;
                    break;
                case 'loan':
                case 'credit':
                    balances.liabilities += balance;
                    break;
            }
        });

        res.json(balances);
    } catch (error) {
        console.error('Error fetching all balances:', error);
        res.status(500).json({ error: 'Something went wrong while fetching balances' });
    }
});

// Route to get categorized spending
router.get('/spending', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const period = req.query.period || 'monthly'; // default to monthly

        const endDate = new Date();
        const startDate = new Date();
        if (period === 'monthly') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (period === 'yearly') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        } else {
            startDate.setDate(startDate.getDate() - 30); // Default to last 30 days
        }

        const startDateString = startDate.toISOString().split('T')[0];
        const endDateString = endDate.toISOString().split('T')[0];

        const plaidToken = await PlaidToken.findOne({ userId });
        if (!plaidToken) {
            return res.status(400).json({ error: 'No Plaid token found for this user.' });
        }

        let allTransactions = [];
        for (const item of plaidToken.items) {
            try {
                const response = await plaidClient.transactionsGet({
                    access_token: item.accessToken,
                    start_date: startDateString,
                    end_date: endDateString,
                });
                allTransactions = allTransactions.concat(response.data.transactions);
            } catch (error) {
                console.error(`Error fetching transactions for item ${item.itemId}:`, error.response ? error.response.data : error.message);
            }
        }

        const spendingByCategory = {};
        allTransactions.forEach(t => {
            if (t.amount > 0 && t.personal_finance_category && t.personal_finance_category.primary !== 'INTERNAL_ACCOUNT_TRANSFER') {
                const category = t.personal_finance_category.primary || 'Uncategorized';
                spendingByCategory[category] = (spendingByCategory[category] || 0) + t.amount;
            }
        });

        const formattedSpending = Object.keys(spendingByCategory).map(category => ({
            name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: spendingByCategory[category]
        })).sort((a, b) => b.value - a.value);

        res.json(formattedSpending);

    } catch (error) {
        console.error('Error fetching categorized spending:', error);
        res.status(500).json({ error: 'Something went wrong while fetching spending data.' });
    }
});

router.all('*', (req, res, next) => {
  console.log('[Plaid Router][DEBUG] Unmatched route:', req.method, req.originalUrl);
  next();
});

module.exports = router;
