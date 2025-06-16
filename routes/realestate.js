const express = require('express');
const router = express.Router();
const RealEstate = require('../models/RealEstate');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const mixpanel = require('../mixpanel');
const realEstateController = require('../controllers/realEstateController');

// Helper function to generate date range
const generateDateRange = (startDate, endDate) => {
    let start = new Date(startDate);
    let end = new Date(endDate);
    let dates = [];
    while (start <= end) {
        dates.push(start.toISOString().slice(0, 7));
        start.setMonth(start.getMonth() + 30);
    }
    if (!dates.includes(end.toISOString().slice(0, 7))) {
        dates.push(end.toISOString().slice(0, 7));
    }
    return dates;
};

// Adding a new property
router.post('/add', realEstateController.addProperty);

// Fetch all real estate properties for the logged-in user
router.get('/list', realEstateController.listProperties);

// Get portfolio summary metrics
router.get('/summary', realEstateController.getPortfolioSummary);

// Updating a property
router.put('/update/:id', realEstateController.updateProperty);

// Update property type
router.put('/update/:id/type', realEstateController.updatePropertyType);

// Deleting a property
router.delete('/delete/:id', realEstateController.deleteProperty);

// Fetching a specific property with rent collection details
router.get('/property/:id', realEstateController.getProperty);

// Updating rent collection status and amount for a specific month
router.put('/rent/collect/:id/:month', realEstateController.updateRentCollection);

// Adding rent payments based on date range
router.post('/rent/pay/:id', realEstateController.addRentPayment);

// Adding an expense
router.post('/expense/add/:id', realEstateController.addExpense);

// Listing expenses
router.get('/expense/list/:id', realEstateController.listExpenses);

// Deleting an expense
router.delete('/expense/delete/:propertyId/:expenseId', realEstateController.deleteExpense);

// Fetching total unpaid rent for all properties of a user
router.get('/totalUnpaidRent', realEstateController.getTotalUnpaidRent);

// Fetching total rent collected and expected for all properties of a user
router.get('/totalRentCollected', realEstateController.getTotalRentCollected);

router.get('/cashFlow', realEstateController.getCashFlow);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// =================================================================================
// Document Management Routes
// =================================================================================

// Get all documents for a property
router.get('/:propertyId/documents', realEstateController.listDocuments);

// Upload a new document
router.post('/:propertyId/documents', upload.single('document'), realEstateController.uploadDocument);

// Rename a document
router.put('/:propertyId/documents/:docId', realEstateController.renameDocument);

// Delete a document
router.delete('/:propertyId/documents/:docId', realEstateController.deleteDocument);

// Fetching total rent paid for all properties of a user
router.get('/totalRentPaid', async (req, res) => {
    const userId = req.user._id;

    try {
        const properties = await RealEstate.find({ userId });

        let totalRentPaid = 0;
        properties.forEach(property => {
            // --- 1. Long-Term Rental Income ---
            const rentCollected = property.rentCollected || {};
            const rentCollectedObject = rentCollected instanceof Map ? Object.fromEntries(rentCollected) : rentCollected;
            Object.values(rentCollectedObject).forEach(rentDetail => {
                if (rentDetail.collected) {
                    totalRentPaid += rentDetail.amount;
                }
            });

            // --- 2. Short-Term Rental Income ---
            if (property.shortTermIncome && property.shortTermIncome.length > 0) {
                property.shortTermIncome.forEach(income => {
                    totalRentPaid += income.amount;
                });
            }
        });

        res.status(200).json({ totalRentPaid });
    } catch (error) {
        console.error('Server error:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/totalOverdueRent', async (req, res) => {
    const userId = req.user._id;

    try {
        const properties = await RealEstate.find({ userId });
        let totalOverdueRent = 0;
        const currentMonth = new Date().toISOString().slice(0, 7);

        properties.forEach(property => {
            property.rentCollected.forEach((rentDetail, month) => {
                if (!rentDetail.collected && month < currentMonth) {
                    totalOverdueRent += rentDetail.amount;
                }
            });
        });

        res.status(200).json({ totalOverdueRent });
    } catch (error) {
        console.error('Server error:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/rent/upcoming', async (req, res) => {
    const userId = req.user._id;
    const today = new Date();
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    console.log(`Fetching upcoming rent notifications for user: ${userId}`);
    console.log(`Today: ${today}, Next Month Start: ${nextMonthStart}, Next Month End: ${nextMonthEnd}`);

    try {
        const properties = await RealEstate.find({ userId });
        let upcomingRentDates = [];

        properties.forEach(property => {
            console.log(`Processing property: ${property.propertyAddress}`);
            property.rentCollected.forEach((rentDetail, month) => {
                const [year, monthStr] = month.split('-');
                const rentMonth = new Date(year, parseInt(monthStr) - 1, 1);

                console.log(`Checking rent month: ${rentMonth} for property: ${property.propertyAddress}`);
                if (rentMonth >= nextMonthStart && rentMonth <= nextMonthEnd && !rentDetail.collected) {
                    console.log(`Upcoming rent found for month: ${rentMonth}`);
                    const monthYear = rentMonth.toLocaleString('en-US', { year: 'numeric', month: 'long' });
                    upcomingRentDates.push({
                        propertyId: property._id,
                        propertyAddress: property.propertyAddress,
                        month: monthYear,
                        amount: rentDetail.amount,
                    });
                }
            });
        });

        console.log(`Upcoming rent dates: ${JSON.stringify(upcomingRentDates)}`);
        res.status(200).json(upcomingRentDates);
    } catch (error) {
        console.error('Error fetching upcoming rent notifications:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Route to export documents as a zip file
router.get('/exportDocuments', async (req, res) => {
    const userId = req.user._id;

    try {
        const properties = await RealEstate.find({ userId });
        if (!properties || properties.length === 0) {
            return res.status(404).json({ message: 'No properties found' });
        }

        const zip = archiver('zip', {
            zlib: { level: 9 }
        });

        res.attachment('documents.zip');

        zip.on('error', (err) => {
            throw err;
        });

        properties.forEach(property => {
            const propertyName = property.propertyAddress.replace(/ /g, '_');
            property.documents.forEach(doc => {
                const docType = doc.type;
                const docPath = path.resolve(__dirname, '../uploads', path.basename(doc.path));
                const docName = path.basename(doc.path);

                if (fs.existsSync(docPath)) {
                    fs.accessSync(docPath, fs.constants.R_OK);
                    zip.file(docPath, { name: `${propertyName}/${docType}/${docName}` });
                } else {
                    console.error(`Document not found: ${docPath}`);
                }
            });
        });

        zip.pipe(res);

        zip.on('finish', function () {
            console.log('Zip file successfully created and sent.');
        });

        zip.finalize();
    } catch (error) {
        console.error('Error exporting documents:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Add Short-Term Rental Income
router.post('/income/short-term/add/:id', async (req, res) => {
    const { id } = req.params;
    const { date, amount, notes } = req.body;
    const userId = req.user._id;

    if (!date || !amount) {
        return res.status(400).json({ message: 'Date and amount are required' });
    }

    try {
        const property = await RealEstate.findOne({ _id: id, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        if (property.propertyType !== 'Short-Term Rental') {
            return res.status(400).json({ message: 'This operation is only for Short-Term Rental properties.' });
        }

        const newIncome = { date, amount, notes };
        property.shortTermIncome.push(newIncome);

        await property.save();

        mixpanel.track('Short-Term Income Added', {
            distinct_id: userId.toString(),
            propertyId: id,
            amount: amount,
            timestamp: new Date().toISOString()
        });
        
        const addedIncome = property.shortTermIncome[property.shortTermIncome.length - 1];
        res.status(200).json(addedIncome);

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update Short-Term Rental Income
router.put('/income/short-term/update/:propertyId/:incomeId', async (req, res) => {
    const { propertyId, incomeId } = req.params;
    const { date, amount, notes } = req.body;
    const userId = req.user._id;

    if (!date || !amount) {
        return res.status(400).json({ message: 'Date and amount are required' });
    }

    try {
        const property = await RealEstate.findOneAndUpdate(
            { "_id": propertyId, "userId": userId, "shortTermIncome._id": incomeId },
            { 
                "$set": {
                    "shortTermIncome.$.date": date,
                    "shortTermIncome.$.amount": amount,
                    "shortTermIncome.$.notes": notes
                }
            },
            { new: true }
        );

        if (!property) {
            return res.status(404).json({ message: 'Property or income entry not found' });
        }
        
        mixpanel.track('Short-Term Income Updated', {
            distinct_id: userId.toString(),
            propertyId: propertyId,
            incomeId: incomeId,
            amount: amount,
            timestamp: new Date().toISOString()
        });
        
        const updatedIncome = property.shortTermIncome.find(inc => inc._id.toString() === incomeId);

        res.status(200).json({ message: 'Short-term income updated successfully!', data: updatedIncome });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete Short-Term Rental Income
router.delete('/income/short-term/delete/:propertyId/:incomeId', async (req, res) => {
    const { propertyId, incomeId } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const incomeIndex = property.shortTermIncome.findIndex(income => income._id.toString() === incomeId);

        if (incomeIndex === -1) {
            return res.status(404).json({ message: 'Income entry not found' });
        }

        property.shortTermIncome.splice(incomeIndex, 1);
        await property.save();
        
        mixpanel.track('Short-Term Income Deleted', {
            distinct_id: userId.toString(),
            propertyId: propertyId,
            incomeId: incomeId,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({ message: 'Income entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Updating an expense
router.put('/expense/update/:propertyId/:expenseId', async (req, res) => {
    const { propertyId, expenseId } = req.params;
    const { category, amount, date } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const expense = property.expenses.id(expenseId);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        expense.category = category;
        expense.amount = amount;
        expense.date = date;

        await property.save();
        res.status(200).json({ message: 'Expense updated successfully!', data: property });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Add a unit to a property
router.post('/:propertyId/units', async (req, res) => {
    const { propertyId } = req.params;
    const { name, rentAmount, tenant } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        property.units.push({ name, rentAmount, tenant });
        await property.save();
        res.status(201).json(property.units[property.units.length - 1]);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update a unit
router.put('/:propertyId/units/:unitId', async (req, res) => {
    const { propertyId, unitId } = req.params;
    const { name, rentAmount, tenant } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const unit = property.units.id(unitId);
        if (!unit) {
            return res.status(404).json({ message: 'Unit not found' });
        }

        unit.set({ name, rentAmount, tenant });
        await property.save();
        res.status(200).json(unit);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete a unit
router.delete('/:propertyId/units/:unitId', async (req, res) => {
    const { propertyId, unitId } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        property.units.id(unitId).remove();
        await property.save();
        res.status(200).json({ message: 'Unit deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Add a vacancy period
router.post('/:propertyId/vacancies', async (req, res) => {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        property.vacancies.push({ startDate, endDate });
        await property.save();
        res.status(201).json(property.vacancies[property.vacancies.length - 1]);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update a vacancy period
router.put('/:propertyId/vacancies/:vacancyId', async (req, res) => {
    const { propertyId, vacancyId } = req.params;
    const { startDate, endDate } = req.body;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const vacancy = property.vacancies.id(vacancyId);
        if (!vacancy) {
            return res.status(404).json({ message: 'Vacancy not found' });
        }

        vacancy.set({ startDate, endDate });
        await property.save();
        res.status(200).json(vacancy);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete a vacancy period
router.delete('/:propertyId/vacancies/:vacancyId', async (req, res) => {
    const { propertyId, vacancyId } = req.params;
    const userId = req.user._id;

    try {
        const property = await RealEstate.findOne({ _id: propertyId, userId });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        property.vacancies.id(vacancyId).remove();
        await property.save();
        res.status(200).json({ message: 'Vacancy deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Add a new unit to a property
router.post('/unit/add/:id', realEstateController.addUnit);

// Add a value history entry for a property
router.post('/value/add/:id', realEstateController.addValueHistory);

// Get a summary for a property
router.get('/summary/:id', realEstateController.getPropertySummary);

// Get a financial analysis for a property
router.get('/analysis/:id', realEstateController.getPropertyAnalysis);

// Get a summary of the entire portfolio
router.get('/portfolio-summary', realEstateController.getPortfolioSummary);

module.exports = router;