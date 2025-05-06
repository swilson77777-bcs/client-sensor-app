const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const atticRoofDataApp = require('./attic_roof_data_server');

// Support both JSON and form-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection with correct path structure
const db = new sqlite3.Database(path.join(__dirname, '..', 'Sensors', 'BCS_data.db'), (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'Sensors')));

// Add route to serve verify.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Sensors', 'verify.html'));
});

// Verification endpoint
app.post('/Sensors', (req, res) => {
    try {
        const customerNumber = req.body.customerNumber;
        console.log('Received customer number:', customerNumber);
        
        if (!customerNumber) {
            return res.status(400).json({
                success: false,
                message: 'Customer number is required'
            });
        }
        
        // Query database for mobileAccessCode and customerurl
        db.get(
            'SELECT mobileAccessCode, customerurl FROM ClientProfile WHERE customerNumber = ?', 
            [customerNumber], 
            (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Database error'
                    });
                }
                
                if (row) {
                    console.log('Customer found:', customerNumber);
                    return res.status(200).json({
                        success: true,
                        customerNumber: customerNumber,
                        mobileAccessCode: row.mobileAccessCode,
                        customerurl: row.customerurl // Include customerurl in response
                    });
                } else {
                    console.log('Customer not found:', customerNumber);
                    return res.status(404).json({
                        success: false,
                        message: 'Customer not found'
                    });
                }
            }
        );
    } catch (error) {
        console.error('Request handling error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Start server on port 3003 for reverse proxy
const PORT = 3003;
app.use('/attic-roof-data', atticRoofDataApp);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
});

// Handle database closing on shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
