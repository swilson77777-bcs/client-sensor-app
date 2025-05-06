const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();

const db = new sqlite3.Database(path.join(__dirname, '..', 'Sensors', 'BCS_data.db'));

router.get('/', (req, res) => {
    const customerNumber = req.query.customerNumber;
    console.log('Looking up customer:', customerNumber);
    
    // First query to check if customer exists in ClientProfile
    const checkCustomerQuery = `
    SELECT customerNumber, firstName, lastName, streetAddress, city, state, zipCode,
           roofMaterial, manufacturer, roofType, modelOfMaterial, color, ventType, 
           installDate, bcsWarrantyExpiration, gutterSize, gutterColor, gutterBrand,
           gutterInstallDate, gutterWarrantyExpiration,
           deviceMac1, deviceMac2, deviceMac3, deviceMac4, deviceMac5,
           deviceMac6, deviceMac7, deviceMac8, deviceMac9, deviceMac10,
           deviceName1, deviceName2, deviceName3, deviceName4, deviceName5,
           deviceName6, deviceName7, deviceName8, deviceName9, deviceName10,
           deviceSku1, deviceSku2, deviceSku3, deviceSku4, deviceSku5,
           deviceSku6, deviceSku7, deviceSku8, deviceSku9, deviceSku10
    FROM ClientProfile
    WHERE customerNumber = ?
    LIMIT 1`;

    db.get(checkCustomerQuery, [customerNumber], (err, customer) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: err.message });
        }

        if (!customer) {
            console.log('No customer found for number:', customerNumber);
            return res.json({ error: 'No data found for the given customer number' });
        }

        console.log('Found customer:', customer.firstName, customer.lastName);
        
        // Customer exists, now get any sensor readings
        const sensorQuery = `
        SELECT macAddress, timestamp, temperature, humidity
        FROM SensorReadings
        WHERE customerNumber = ?
        ORDER BY timestamp DESC`;

        db.all(sensorQuery, [customerNumber], (err, sensorRows) => {
            if (err) {
                console.error('Sensor query error:', err);
                return res.status(500).json({ error: err.message });
            }

            // Customer info is always available
            const customerInfo = {
                customerNumber: customer.customerNumber,
                firstName: customer.firstName,
                lastName: customer.lastName,
                streetAddress: customer.streetAddress,
                city: customer.city,
                state: customer.state,
                zipCode: customer.zipCode
            };
            
            // Roof info
            const roofInfo = {
                material: customer.roofMaterial,
                type: customer.roofType,
                color: customer.color,
                installDate: customer.installDate,
                manufacturer: customer.manufacturer,
                model: customer.modelOfMaterial,
                ventType: customer.ventType,
                bcsWarrantyExpiration: customer.bcsWarrantyExpiration
            };
            
            // Gutter info
            const gutterInfo = {
                size: customer.gutterSize,
                color: customer.gutterColor,
                brand: customer.gutterBrand,
                installDate: customer.gutterInstallDate,
                warrantyExpiration: customer.gutterWarrantyExpiration
            };
            
            // Get MAC addresses from device fields
            const macAddresses = [];
            for (let i = 1; i <= 10; i++) {
                const mac = customer[`deviceMac${i}`];
                if (mac) macAddresses.push(mac);
            }
            
            // Process sensor readings if they exist
            const deviceData = {};
            
            if (sensorRows.length > 0) {
                // Group readings by MAC address
                sensorRows.forEach(row => {
                    if (!deviceData[row.macAddress]) {
                        // Find the device name and SKU for this MAC
                        let deviceName = 'Unknown';
                        let deviceSku = 'Unknown';
                        
                        for (let i = 1; i <= 10; i++) {
                            if (customer[`deviceMac${i}`] === row.macAddress) {
                                deviceName = customer[`deviceName${i}`] || 'Unknown';
                                deviceSku = customer[`deviceSku${i}`] || 'Unknown';
                                break;
                            }
                        }
                        
                        deviceData[row.macAddress] = {
                            temperatures: [],
                            humidities: [],
                            timestamps: [],
                            deviceName: deviceName,
                            deviceSku: deviceSku
                        };
                    }
                    
                    deviceData[row.macAddress].temperatures.push(row.temperature);
                    deviceData[row.macAddress].humidities.push(row.humidity);
                    deviceData[row.macAddress].timestamps.push(row.timestamp);
                });
            }
            
            // Send the response with all available data
            res.json({
                customerInfo: customerInfo,
                roofInfo: roofInfo,
                gutterInfo: gutterInfo,
                macAddresses: macAddresses,
                deviceData: deviceData
            });
        });
    });
});

module.exports = router;
