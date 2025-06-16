const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const mapLegacyDataToSchema = require('../config/dataMapper');
const mixpanel = require('../mixpanel');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', protect, upload.single('file'), async (req, res) => {
    try {
        console.log('Upload endpoint hit');
        if (!req.file) {
            console.error('No file received');
            return res.status(400).json({ message: 'No file received' });
        }

        const filePath = req.file.path;
        console.log('Received file:', filePath);

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log('Sheet data:', sheet);

        const formattedData = sheet.map(row => mapLegacyDataToSchema({ ...row, user: req.user._id }));

        console.log('Formatted data:', formattedData);

        const collection = mongoose.connection.collection('networths');
        console.log('Inserting data to database');
        const result = await collection.insertMany(formattedData);

        console.log('Inserted data:', result.insertedIds);

        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
            }
        });

        console.log('Fetching inserted data for response');
        const insertedData = await collection.find({ _id: { $in: Object.values(result.insertedIds) } }).toArray();

        console.log('Sending response with data...', insertedData);
        mixpanel.track('Imported Data', {
            distinct_id: req.user._id.toString(),
            email: req.user.email,
            timestamp: new Date().toISOString()
        });
        res.status(200).json({ message: 'Data imported successfully', data: insertedData });
    } catch (error) {
        console.error('Error importing data:', error);
        res.status(500).json({ message: 'Error importing data' });
    }
});

module.exports = router;