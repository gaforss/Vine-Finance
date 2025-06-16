const RealEstate = require('../models/RealEstate');
const mixpanel = require('../mixpanel');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

// Helper function to calculate advanced financial metrics
const calculateFinancialMetrics = (property) => {
    const value = property.value || 0;
    const purchasePrice = property.purchasePrice || 0;

    // 1. Calculate Appreciation
    const appreciation = purchasePrice > 0 ? ((value - purchasePrice) / purchasePrice) : 0;

    let noi = 0, capRate = 0, cocReturn = 0;

    // 2. Calculate advanced metrics for investment properties
    if (property.propertyType !== 'Primary Residence') {
        let annualGrossRent = 0;

        // --- Determine Annual Gross Rent from property type ---
        if (property.propertyType === 'Long-Term Rental') {
            // Sum ACTUAL rent received in the last 12 months
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (property.rentCollected && typeof property.rentCollected === 'object') {
                annualGrossRent = Object.entries(property.rentCollected)
                    .filter(([month, rent]) => {
                        // month is 'YYYY-MM', so construct a date
                        const rentDate = new Date(month + '-01');
                        return rentDate >= oneYearAgo && rent.collected;
                    })
                    .reduce((acc, [_, rent]) => acc + (rent.amount || 0), 0);
            }
        } else if (property.propertyType === 'Short-Term Rental' && Array.isArray(property.shortTermIncome)) {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            annualGrossRent = property.shortTermIncome
                .filter(income => new Date(income.date) >= oneYearAgo)
                .reduce((acc, income) => acc + income.amount, 0);
        } 

        if (annualGrossRent > 0) {
            // --- Annual Operating Expenses ---
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const annualActualExpenses = (property.expenses || [])
                .filter(exp => new Date(exp.date) >= oneYearAgo && exp.category !== 'mortgage')
                .reduce((acc, exp) => acc + exp.amount, 0);
            // Only use actual expenses, no 50% rule
            const annualOperatingExpenses = annualActualExpenses;
            
            // --- Net Operating Income (NOI) ---
            noi = annualGrossRent - annualOperatingExpenses;

            // --- Cap Rate ---
            capRate = value > 0 ? (noi / value) : 0;

            // --- Annual Debt Service (Mortgage) ---
            const mortgagePayments = (property.expenses || [])
                .filter(exp => exp.category === 'mortgage' && exp.amount > 0)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const monthlyDebtService = mortgagePayments.length > 0 ? mortgagePayments[0].amount : 0;
            const annualDebtService = monthlyDebtService * 12;
            
            // --- Cash Flow ---
            const cashFlow = noi - annualDebtService;
            
            // --- Cash-on-Cash Return ---
            const cashInvested = purchasePrice || 0;
            cocReturn = cashInvested > 0 ? (cashFlow / cashInvested) : 0;
        }
    }

    return {
        ...property,
        appreciation,
        noi,
        capRate,
        cocReturn
    };
};

// Adding a new property
exports.addProperty = async (req, res) => {
    const {
        url,
        value,
        propertyType,
        propertyAddress,
        purchaseDate,
        purchasePrice,
        units,
        mortgageBalance
    } = req.body;
    const userId = req.user._id;

    if (!url || !value || !propertyType || !propertyAddress) {
        return res.status(400).json({ message: 'All fields, including property type and address, are required' });
    }

    try {
        const newProperty = new RealEstate({
            userId,
            url,
            value,
            propertyType,
            propertyAddress,
            purchaseDate,
            purchasePrice,
            units,
            mortgageBalance
        });

        await newProperty.save();
        
        // Mixpanel tracking
        mixpanel.track('Property Added', {
            distinct_id: userId.toString(),
            propertyAddress: propertyAddress,
            propertyValue: value,
            timestamp: new Date().toISOString()
        });

        res.status(200).json(newProperty);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.listProperties = async (req, res) => {
    try {
        const userId = req.user._id;
        // Use .lean() for better performance and to get plain JS objects
        const properties = await RealEstate.find({ userId }).populate('expenses').lean();
        
        // Calculate metrics for each property
        const propertiesWithMetrics = properties.map(calculateFinancialMetrics);

        mixpanel.track('Properties Listed', {
            distinct_id: userId.toString(),
            propertyCount: properties.length,
            timestamp: new Date().toISOString()
        });

        res.status(200).json(propertiesWithMetrics);
    } catch (error) {
        console.error('Error in listProperties:', error); // Add console log for better debugging
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateProperty = async (req, res) => {
    const { id } = req.params;
    const {
        url,
        value,
        propertyType,
        propertyAddress,
        purchaseDate,
        purchasePrice,
        units,
        mortgageBalance
    } = req.body;
    const userId = req.user._id;

    if (!url || !value || !propertyType || !propertyAddress) {
        return res.status(400).json({ message: 'All fields, including property type and address, are required' });
    }

    try {
        const updatedPropertyDoc = await RealEstate.findOneAndUpdate(
            { _id: id, userId },
            {
                url,
                value,
                propertyType,
                propertyAddress,
                purchaseDate,
                purchasePrice,
                units,
                mortgageBalance
            },
            { new: true, runValidators: true }
        ).populate('expenses');

        if (!updatedPropertyDoc) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Convert to plain object before calculating metrics
        const propertyWithMetrics = calculateFinancialMetrics(updatedPropertyDoc.toObject());

        // Mixpanel tracking
        mixpanel.track('Property Updated', {
            distinct_id: userId.toString(),
            propertyId: id,
            propertyAddress: propertyAddress,
            propertyValue: value,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({ message: 'Property updated successfully!', data: propertyWithMetrics });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updatePropertyType = async (req, res) => {
    const { id } = req.params;
    const { propertyType } = req.body;
    const userId = req.user._id;

    if (!propertyType) {
        return res.status(400).json({ message: 'Property type is required' });
    }

    try {
        const updatedProperty = await RealEstate.findOneAndUpdate(
            { _id: id, userId },
            { propertyType },
            { new: true, runValidators: true }
        );

        if (!updatedProperty) {
            return res.status(404).json({ message: 'Property not found' });
        }

        mixpanel.track('Property Type Updated', {
            distinct_id: userId.toString(),
            propertyId: id,
            newPropertyType: propertyType,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({ message: 'Property type updated successfully!', data: updatedProperty });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.deleteProperty = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOneAndDelete({ _id: id, userId });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Mixpanel tracking
        mixpanel.track('Property Deleted', {
            distinct_id: userId.toString(),
            propertyId: id,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({ message: 'Property deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getProperty = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: id, userId }).populate('expenses').lean();

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const propertyWithMetrics = calculateFinancialMetrics(property);

        res.status(200).json(propertyWithMetrics);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateRentCollection = async (req, res) => {
    const { id, month } = req.params;
    const { collected, amount } = req.body;
    const userId = req.user._id;

    try {
        // Use findOneAndUpdate to only update the specific rent collection entry
        const updateData = {};
        if (amount !== undefined) {
            updateData[`rentCollected.${month}.amount`] = amount;
        }
        updateData[`rentCollected.${month}.collected`] = collected;

        const property = await RealEstate.findOneAndUpdate(
            { _id: id, userId },
            { $set: updateData },
            { new: true, runValidators: false } // Disable validators since we're only updating rentCollected
        );

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        res.status(200).json({ message: 'Rent collection updated successfully!', data: property });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.addRentPayment = async (req, res) => {
    const { id } = req.params;
    const { amount, startDate, endDate } = req.body;
    const userId = req.user._id;

    try {
        // Use findOneAndUpdate to only update the rentCollected field
        const property = await RealEstate.findOneAndUpdate(
            { _id: id, userId },
            {
                $set: {
                    [`rentCollected.${startDate}`]: { amount: amount || 0, collected: false }
                }
            },
            { new: true, runValidators: false } // Disable validators since we're only updating rentCollected
        );

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const propertyObj = property.toObject();
        propertyObj.rentCollected = Object.fromEntries(property.rentCollected || new Map());

        res.status(200).json(propertyObj);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.addExpense = async (req, res) => {
    const { id } = req.params;
    const { category, amount, date } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: id, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const expense = { category, amount, date };
        property.expenses.push(expense);

        await property.save();
        res.status(200).json(property);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.listExpenses = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: id, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        res.status(200).json(property.expenses);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.deleteExpense = async (req, res) => {
    const { propertyId, expenseId } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            console.error(`[DeleteExpense] Property not found for propertyId=${propertyId}, userId=${userId}`);
            return res.status(404).json({ message: 'Property not found' });
        }
        const expense = property.expenses.id(expenseId);
        if (!expense) {
            console.error(`[DeleteExpense] Expense not found for expenseId=${expenseId} in propertyId=${propertyId}`);
            return res.status(404).json({ message: 'Expense not found' });
        }
        property.expenses.pull(expenseId);
        await property.save();
        console.log(`[DeleteExpense] Expense deleted. Property after save:`, property);
        res.status(200).json({ message: 'Expense deleted successfully!', data: property, expenses: property.expenses });
    } catch (error) {
        console.error('[DeleteExpense] Server error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};



exports.getTotalUnpaidRent = async (req, res) => {
    const userId = req.user._id;

    try {
        const properties = await RealEstate.find({ userId });
        let totalUnpaidRent = 0;

        properties.forEach(property => {
            property.rentCollected.forEach(rentDetail => {
                if (!rentDetail.collected) {
                    totalUnpaidRent += rentDetail.amount;
                }
            });
        });

        res.status(200).json({ totalUnpaidRent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getTotalRentCollected = async (req, res) => {
    const userId = req.user._id;

    try {
        const properties = await RealEstate.find({ userId });
        let totalCollected = 0;
        let totalExpected = 0;

        properties.forEach(property => {
            property.rentCollected.forEach(rentDetail => {
                totalExpected += rentDetail.amount;
                if (rentDetail.collected) {
                    totalCollected += rentDetail.amount;
                }
            });
        });

        res.status(200).json({ totalCollected, totalExpected });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getCashFlow = async (req, res) => {
    const userId = req.user._id;

    try {
        const properties = await RealEstate.find({ userId });
        const cashFlowData = {};

        properties.forEach(property => {
            property.rentCollected.forEach((rentDetail, month) => {
                if (!cashFlowData[month]) {
                    cashFlowData[month] = { rentCollected: 0, expenses: 0 };
                }
                if (rentDetail.collected) {
                    cashFlowData[month].rentCollected += rentDetail.amount;
                }
            });

            property.expenses.forEach(expense => {
                const month = new Date(expense.date).toISOString().slice(0, 7);
                if (!cashFlowData[month]) {
                    cashFlowData[month] = { rentCollected: 0, expenses: 0 };
                }
                cashFlowData[month].expenses += expense.amount;
            });
        });

        const cashFlow = Object.keys(cashFlowData).map(month => ({
            month: new Date(month + '-01').toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short' }),
            cashFlow: cashFlowData[month].rentCollected - cashFlowData[month].expenses
        })).sort((a, b) => new Date(a.month) - new Date(b.month));

        res.status(200).json(cashFlow);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// =================================================================================
// Document Management Controllers
// =================================================================================

exports.listDocuments = async (req, res) => {
    const { propertyId } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            // If no property is found, it's a 404. But if it's just no documents, we send an empty array.
            return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property.documents);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.uploadDocument = async (req, res) => {
    const { propertyId } = req.params;
    const userId = req.user._id;
    console.log(`[UPLOAD /documents] Attempting to upload document for propertyId: ${propertyId}`);

    if (!req.file) {
        console.log('[UPLOAD /documents] No file provided in the request.');
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    console.log(`[UPLOAD /documents] File received: ${req.file.originalname}, size: ${req.file.size}`);

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            console.log(`[UPLOAD /documents] Property not found for id: ${propertyId}`);
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: 'Property not found' });
        }
        console.log(`[UPLOAD /documents] Found property: ${property.propertyAddress}`);

        const newDocument = {
            name: req.file.originalname,
            type: 'misc', // Set default type to satisfy schema validation
            path: req.file.path, 
            url: `/uploads/${req.file.filename}`,
            uploadedAt: new Date()
        };

        console.log('[UPLOAD /documents] Adding new document to property.');
        property.documents.push(newDocument);

        console.log('[UPLOAD /documents] Saving property.');
        await property.save();
        console.log('[UPLOAD /documents] Property saved successfully.');

        res.status(201).json({
            message: 'Document uploaded successfully',
            documents: property.documents
        });

    } catch (error) {
        console.error('[UPLOAD /documents] An unexpected error occurred:', error);
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
            console.log(`[UPLOAD /documents] Deleted orphaned file: ${req.file.path}`);
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.renameDocument = async (req, res) => {
    const { propertyId, docId } = req.params;
    const { name } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const document = property.documents.id(docId);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        document.name = name;
        await property.save();

        res.status(200).json({ 
            message: 'Document renamed successfully',
            documents: property.documents 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.deleteDocument = async (req, res) => {
    const { propertyId, docId } = req.params;
    const userId = req.user._id;
    console.log(`[DELETE /documents] Attempting to delete docId: ${docId} from propertyId: ${propertyId}`);

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            console.log(`[DELETE /documents] Property not found for id: ${propertyId}`);
            return res.status(404).json({ message: 'Property not found' });
        }
        console.log(`[DELETE /documents] Found property: ${property.propertyAddress}`);

        const document = property.documents.id(docId);
        if (!document) {
            console.log(`[DELETE /documents] Document not found for id: ${docId}`);
            return res.status(404).json({ message: 'Document not found' });
        }
        console.log(`[DELETE /documents] Found document: ${document.name}`);

        // Attempt to delete the physical file, but don't let it block the DB operation.
        if (document.path) {
            console.log(`[DELETE /documents] Attempting to delete physical file at: ${document.path}`);
            try {
                if (fs.existsSync(document.path)) {
                    fs.unlinkSync(document.path);
                    console.log(`[DELETE /documents] Successfully deleted physical file.`);
                } else {
                    console.log(`[DELETE /documents] Physical file not found at path, skipping deletion.`);
                }
            } catch (fileError) {
                console.error(`[DELETE /documents] Error deleting physical file: ${fileError.message}`);
                // We continue anyway
            }
        } else {
            console.log(`[DELETE /documents] No path for document, skipping physical file deletion.`);
        }

        console.log(`[DELETE /documents] Attempting to pull document from property array.`);
        property.documents.pull({ _id: docId });
        
        console.log(`[DELETE /documents] Attempting to save property.`);
        await property.save();
        console.log(`[DELETE /documents] Successfully saved property. Document record deleted.`);

        res.status(200).json({
            message: 'Document deleted successfully',
            documents: property.documents
        });
    } catch (error) {
        console.error('[DELETE /documents] An unexpected error occurred in the catch block:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.addUnit = async (req, res) => {
    const { id } = req.params;
    const { name, rentAmount, tenant, leaseStartDate, leaseEndDate } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: id, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        property.units.push({ name, rentAmount, tenant, leaseStartDate, leaseEndDate });
        await property.save();
        res.status(201).json(property.units[property.units.length - 1]);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.addMortgage = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const mortgageData = req.body;

    try {
        const property = await RealEstate.findOneAndUpdate(
            { _id: id, userId },
            { $set: { mortgage: mortgageData } },
            { new: true, runValidators: true }
        );

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        res.status(200).json(property);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.addValueHistory = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const { date, value } = req.body;

    try {
        const property = await RealEstate.findOne({ _id: id, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        property.valueHistory.push({ date, value });
        property.value = value; // Update current value
        await property.save();

        res.status(200).json(property);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getPropertySummary = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: id, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const summary = {
            totalRentCollected: 0,
            totalExpenses: 0,
            netCashFlow: 0,
            occupancyRate: 0,
            vacancyRate: 0,
        };

        let totalRentExpected = 0;
        property.rentCollected.forEach(rent => {
            totalRentExpected += rent.amount;
            if (rent.collected) {
                summary.totalRentCollected += rent.amount;
            }
        });

        property.expenses.forEach(expense => {
            summary.totalExpenses += expense.amount;
        });

        summary.netCashFlow = summary.totalRentCollected - summary.totalExpenses;

        if (property.units.length > 0) {
            const occupiedUnits = property.units.filter(unit => unit.tenant).length;
            summary.occupancyRate = (occupiedUnits / property.units.length) * 100;
            summary.vacancyRate = 100 - summary.occupancyRate;
        }

        res.status(200).json(summary);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getPropertyAnalysis = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: id, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const { value, purchasePrice, rentCollected, expenses } = property;

        const annualRent = Array.from(rentCollected.values()).reduce((acc, month) => acc + month.amount, 0);
        const annualExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
        const noi = annualRent - annualExpenses;
        const capRate = value > 0 ? (noi / value) * 100 : 0;
        const cashOnCashReturn = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;

        const analysis = {
            noi,
            capRate,
            cashOnCashReturn,
            annualRent,
            annualExpenses,
        };

        res.status(200).json(analysis);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getPortfolioSummary = async (req, res) => {
    const userId = req.user._id;

    try {
        const properties = await RealEstate.find({ userId }).lean();
        if (!properties || properties.length === 0) {
            return res.json({ totalNOI: 0, averageCapRate: 0, averageCoCReturn: 0 });
        }

        let totalNOI = 0;
        let totalCapRate = 0;
        let capRateCount = 0;
        let totalCoCReturn = 0;
        let cocReturnCount = 0;

        for (const property of properties) {
            if (property.propertyType !== 'Primary Residence') {
                const metrics = calculateFinancialMetrics(property);
                
                totalNOI += metrics.noi;

                if (metrics.capRate > 0 && isFinite(metrics.capRate)) {
                    totalCapRate += metrics.capRate;
                    capRateCount++;
                }

                if (metrics.cocReturn > 0 && isFinite(metrics.cocReturn)) {
                    totalCoCReturn += metrics.cocReturn;
                    cocReturnCount++;
                }
            }
        }

        const averageCapRate = capRateCount > 0 ? totalCapRate / capRateCount : 0;
        const averageCoCReturn = cocReturnCount > 0 ? totalCoCReturn / cocReturnCount : 0;

        res.json({
            totalNOI,
            averageCapRate,
            averageCoCReturn
        });

    } catch (error) {
        console.error('Error in getPortfolioSummary:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}; 