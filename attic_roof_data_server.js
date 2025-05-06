const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();

const db = new sqlite3.Database(path.join(__dirname, '..', 'Sensors', 'BCS_data.db'));

router.get('/', (req, res) => {
    const customerNumber = req.query.customerNumber;
    
    // Modified query to start with ClientProfile instead of SensorReadings
    const query = `
    SELECT c.*, s.macAddress, s.timestamp, s.temperature, s.humidity
    FROM ClientProfile c
    LEFT JOIN SensorReadings s ON c.customerNumber = s.customerNumber
    WHERE c.customerNumber = ?
    ORDER BY s.timestamp DESC`;

    db.all(query, [customerNumber], (err, rows) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: err.message });
        }

        // Check if customer exists (even without sensor readings)
        if (rows.length > 0) {
            const firstRow = rows[0];
            
            // Customer info is always available
            const customerInfo = {
                customerNumber: firstRow.customerNumber,
                firstName: firstRow.firstName,
                lastName: firstRow.lastName,
                streetAddress: firstRow.streetAddress,
                city: firstRow.city,
                state: firstRow.state,
                zipCode: firstRow.zipCode
            };
            
            // Roof info
            const roofInfo = {
                material: firstRow.roofMaterial,
                type: firstRow.roofType,
                color: firstRow.color,
                installDate: firstRow.installDate,
                manufacturer: firstRow.manufacturer,
                model: firstRow.modelOfMaterial,
                ventType: firstRow.ventType,
                bcsWarrantyExpiration: firstRow.bcsWarrantyExpiration
            };
            
            // Get MAC addresses from sensor readings (may be empty)
            const macAddresses = [];
            const deviceData = {};
            
            // Only process sensor rows that have macAddress (not NULL)
            const sensorRows = rows.filter(row => row.macAddress);
            
            if (sensorRows.length > 0) {
                // Get unique MAC addresses
                sensorRows.forEach(row => {
                    if (!macAddresses.includes(row.macAddress)) {
                        macAddresses.push(row.macAddress);
                    }
                    
                    if (!deviceData[row.macAddress]) {
                        deviceData[row.macAddress] = {
                            temperatures: [],
                            humidities: [],
                            timestamps: [],
                            deviceName: 'Unknown',
                            deviceSku: 'Unknown'
                        };
                    }
                    
                    deviceData[row.macAddress].temperatures.push(row.temperature);
                    deviceData[row.macAddress].humidities.push(row.humidity);
                    deviceData[row.macAddress].timestamps.push(row.timestamp);
                });
                
                // Match MAC addresses with device names/SKUs
                for (let i = 1; i <= 10; i++) {
                    const mac = firstRow[`deviceMac${i}`];
                    if (mac && deviceData[mac]) {
                        deviceData[mac].deviceName = firstRow[`deviceName${i}`] || 'Unknown';
                        deviceData[mac].deviceSku = firstRow[`deviceSku${i}`] || 'Unknown';
                    }
                }
            }
            
            res.json({
                customerInfo: customerInfo,
                roofInfo: roofInfo,
                macAddresses: macAddresses,
                deviceData: deviceData
            });
        } else {
            console.log('No results found for customer number:', customerNumber);
            res.json({ error: 'No data found for the given customer number' });
        }
    });
});

module.exports = router;
