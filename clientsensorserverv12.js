const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();
const port = 3020;
// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});





// Database connection
const db = new sqlite3.Database(path.join(__dirname, '..', 'Sensors', 'BCS_data.db'));

// Create NotesLog table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS NotesLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    streetAddress TEXT NOT NULL,
    note TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (streetAddress) REFERENCES ClientProfile(streetAddress)
)`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'Sensors')));

// Serve the main entry form
app.get(['/', '/Sensors'], (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Sensors', 'clientsensor.html'));
});

// Get dropdown data
app.get('/api/dropdowns/:listType', (req, res) => {
  const { listType } = req.params;
  db.all(
    'SELECT listItem FROM DropdownManagement WHERE listType = ?',
    [listType],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows.map(row => row.listItem));
    }
  );
});
// Search endpoint
app.get('/api/search', (req, res) => {
  const searchParams = req.query;
  let conditions = [];
  let values = [];

  Object.entries(searchParams).forEach(([field, value]) => {
    if (value) {
      if (field === 'customerNumber') {
        // Use exact match for customer number
        conditions.push(`${field} = ?`);
        values.push(value);
        } else {
      conditions.push(`${field} LIKE ?`);
      values.push(`%${value}%`);
    }
    }
  });

  if (conditions.length === 0) {
    return res.status(400).json({ error: 'No search criteria provided' });
  }

  const query = `SELECT rowid, * FROM ClientProfile WHERE ${conditions.join(' AND ')}`;
  console.log('Search query:', query, 'Values:', values);

  db.all(query, values, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// API endpoint to get customer media files
app.get('/api/customer-media/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;
  
  if (!customerNumber) {
    return res.status(400).json({ error: 'Customer number is required' });
  }

  // Array to hold all media files
  const mediaFiles = [];
  
  // Query RGAdocs table
  db.get(
    `SELECT customerNumber, 
            docRoof as roofDoc, docRoofDesc as roofDesc, docRoofCustomerView as roofCustomerView, docRoofInternalView as roofInternalView,
            docGutter as gutterDoc, docGutterDesc as gutterDesc, docGutterCustomerView as gutterCustomerView, docGutterInternalView as gutterInternalView,
            docAttic as atticDoc, docAtticDesc as atticDesc, docAtticCustomerView as atticCustomerView, docAtticInternalView as atticInternalView
     FROM RGAdocs 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, row) => {
      if (err) {
        console.error('Database error when fetching docs:', err);
        return res.status(500).json({ error: 'Database error when fetching media' });
      }
      
      // Process docs if they exist
      if (row) {
        if (row.roofDoc) {
          mediaFiles.push({
            id: customerNumber,
            mediaType: 'Document',
            category: 'Roof',
            description: row.roofDesc || 'Roof Document',
            customerView: row.roofCustomerView,
            internalView: row.roofInternalView
          });
        }
        
        if (row.gutterDoc) {
          mediaFiles.push({
            id: customerNumber,
            mediaType: 'Document',
            category: 'Gutter',
            description: row.gutterDesc || 'Gutter Document',
            customerView: row.gutterCustomerView,
            internalView: row.gutterInternalView
          });
        }
        
        if (row.atticDoc) {
          mediaFiles.push({
            id: customerNumber,
            mediaType: 'Document',
            category: 'Attic',
            description: row.atticDesc || 'Attic Document',
            customerView: row.atticCustomerView,
            internalView: row.atticInternalView
          });
        }
      }
      
      // Query RGAimages table
      db.get(
        `SELECT customerNumber, 
                imageRoof as roofImage, imageRoofDesc as roofDesc, imageRoofCustomerView as roofCustomerView, imageRoofInternalView as roofInternalView,
                imageGutter as gutterImage, imageGutterDesc as gutterDesc, imageGutterCustomerView as gutterCustomerView, imageGutterInternalView as gutterInternalView,
                imageAttic as atticImage, imageAtticDesc as atticDesc, imageAtticCustomerView as atticCustomerView, imageAtticInternalView as atticInternalView
         FROM RGAimages 
         WHERE customerNumber = ?`,
        [customerNumber],
        (err, row) => {
          if (err) {
            console.error('Database error when fetching images:', err);
            return res.status(500).json({ error: 'Database error when fetching media' });
          }
          
          // Process images if they exist
          if (row) {
            if (row.roofImage) {
              mediaFiles.push({
                id: customerNumber,
                mediaType: 'Image',
                category: 'Roof',
                description: row.roofDesc || 'Roof Image',
                customerView: row.roofCustomerView,
                internalView: row.roofInternalView
              });
            }
            
            if (row.gutterImage) {
              mediaFiles.push({
                id: customerNumber,
                mediaType: 'Image',
                category: 'Gutter',
                description: row.gutterDesc || 'Gutter Image',
                customerView: row.gutterCustomerView,
                internalView: row.gutterInternalView
              });
            }
            
            if (row.atticImage) {
              mediaFiles.push({
                id: customerNumber,
                mediaType: 'Image',
                category: 'Attic',
                description: row.atticDesc || 'Attic Image',
                customerView: row.atticCustomerView,
                internalView: row.atticInternalView
              });
            }
          }
          
          // Query RGAvideos table
          db.get(
            `SELECT customerNumber, 
                    videoRoof as roofVideo, videoRoofDesc as roofDesc, videoRoofCustomerView as roofCustomerView, videoRoofInternalView as roofInternalView,
                    videoGutter as gutterVideo, videoGutterDesc as gutterDesc, videoGutterCustomerView as gutterCustomerView, videoGutterInternalView as gutterInternalView,
                    videoAttic as atticVideo, videoAtticDesc as atticDesc, videoAtticCustomerView as atticCustomerView, videoAtticInternalView as atticInternalView
             FROM RGAvideos 
             WHERE customerNumber = ?`,
            [customerNumber],
            (err, row) => {
              if (err) {
                console.error('Database error when fetching videos:', err);
                return res.status(500).json({ error: 'Database error when fetching media' });
              }
              
              // Process videos if they exist
              if (row) {
                if (row.roofVideo) {
                  mediaFiles.push({
                    id: customerNumber,
                    mediaType: 'Video',
                    category: 'Roof',
                    description: row.roofDesc || 'Roof Video',
                    customerView: row.roofCustomerView,
                    internalView: row.roofInternalView
                  });
                }
                
                if (row.gutterVideo) {
                  mediaFiles.push({
                    id: customerNumber,
                    mediaType: 'Video',
                    category: 'Gutter',
                    description: row.gutterDesc || 'Gutter Video',
                    customerView: row.gutterCustomerView,
                    internalView: row.gutterInternalView
                  });
                }
                
                if (row.atticVideo) {
                  mediaFiles.push({
                    id: customerNumber,
                    mediaType: 'Video',
                    category: 'Attic',
                    description: row.atticDesc || 'Attic Video',
                    customerView: row.atticCustomerView,
                    internalView: row.atticInternalView
                  });
                }
              }
              
              // Return all media files
              return res.json({ media: mediaFiles });
            }
          );
        }
      );
    }
  );
});

// API endpoint to download media
app.get('/api/download-media/:mediaType/:category/:customerNumber', (req, res) => {
  const { mediaType, category, customerNumber } = req.params;

  // Validate parameters
  if (!mediaType || !category || !customerNumber) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  let tableName, columnName, filenameColumn;
  
  // Match document structure for other media types
  switch(mediaType) {
    case 'Document':
      tableName = 'RGAdocs';
      columnName = `doc${category}`;
      filenameColumn = `doc${category}Filename`;
      break;
    case 'Image':
      tableName = 'RGAimages';
      columnName = `image${category}`;
      filenameColumn = `image${category}Filename`; 
      break;
    case 'Video':
      tableName = 'RGAvideos';
      columnName = `video${category}`;
      filenameColumn = `video${category}Filename`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid media type' });
  }

  // Keep existing working query pattern
  db.get(
    `SELECT ${columnName} as fileData, ${filenameColumn} as filename 
     FROM ${tableName}
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, row) => {
      if (err) {
        console.error(`Database error: ${err.message}`);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row || !row.fileData) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Use original filename or generate default
      const filename = row.filename || `${category}_${mediaType.toLowerCase()}_${customerNumber}.${mediaType === 'Document' ? 'pdf' : mediaType === 'Image' ? 'jpg' : 'mp4'}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(row.fileData));    
    }
  );
});

// Update the /api/customer-docs/:customerNumber endpoint
app.get('/api/customer-docs/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  db.all(
    `SELECT customerNumber, 
            docRoof as roofDoc, docRoofDesc as roofDesc, docRoofFilename as roofFilename,
            docGutter as gutterDoc, docGutterDesc as gutterDesc, docGutterFilename as gutterFilename,
            docAttic as atticDoc, docAtticDesc as atticDesc, docAtticFilename as atticFilename
     FROM RGAdocs 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, rows) => {
      if (err) {
        console.error('Database error when fetching docs:', err);
        return res.status(500).json({ error: 'Database error when fetching documents' });
      }

      const docs = [];
      
      // Process all rows (though typically just one row per customer)
      rows.forEach(row => {
        // Add Roof document if exists
        if (row.roofDoc) {
          docs.push({
            id: row.customerNumber + '_roof',
            category: 'Roof',
            filename: row.roofFilename || 'Roof Document',
            description: row.roofDesc || 'Roof Document'
          });
        }
        
        // Add Gutter document if exists
        if (row.gutterDoc) {
          docs.push({
            id: row.customerNumber + '_gutter',
            category: 'Gutter',
            filename: row.gutterFilename || 'Gutter Document',
            description: row.gutterDesc || 'Gutter Document'
          });
        }
        
        // Add Attic document if exists
        if (row.atticDoc) {
          docs.push({
            id: row.customerNumber + '_attic',
            category: 'Attic',
            filename: row.atticFilename || 'Attic Document',
            description: row.atticDesc || 'Attic Document'
          });
        }
      });

      return res.json({ docs });
    }
  );
});

// API endpoint to get customer images
app.get('/api/customer-images/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  db.all(
    `SELECT customerNumber, 
            imageRoof as roofImage, imageRoofDesc as roofDesc, imageRoofFilename as roofFilename,
            imageGutter as gutterImage, imageGutterDesc as gutterDesc, imageGutterFilename as gutterFilename,
            imageAttic as atticImage, imageAtticDesc as atticDesc, imageAtticFilename as atticFilename
     FROM RGAimages 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, rows) => {
      if (err) {
        console.error('Database error when fetching images:', err);
        return res.status(500).json({ error: 'Database error when fetching images' });
      }

      const images = [];
      
      rows.forEach(row => {
        if (row.roofImage) {
          images.push({
            id: row.customerNumber + '_roof',
            category: 'Roof',
            filename: row.roofFilename || 'Roof Image',
            description: row.roofDesc || 'Roof Image'
          });
        }
        if (row.gutterImage) {
          images.push({
            id: row.customerNumber + '_gutter',
            category: 'Gutter',
            filename: row.gutterFilename || 'Gutter Image',
            description: row.gutterDesc || 'Gutter Image'
          });
        }
        if (row.atticImage) {
          images.push({
            id: row.customerNumber + '_attic',
            category: 'Attic',
            filename: row.atticFilename || 'Attic Image',
            description: row.atticDesc || 'Attic Image'
          });
        }
      });

      return res.json({ images });
    }
  );
});

// API endpoint to get customer videos
app.get('/api/customer-videos/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  db.all(
    `SELECT customerNumber, 
            videoRoof as roofVideo, videoRoofDesc as roofDesc, videoRoofFilename as roofFilename,
            videoGutter as gutterVideo, videoGutterDesc as gutterDesc, videoGutterFilename as gutterFilename,
            videoAttic as atticVideo, videoAtticDesc as atticDesc, videoAtticFilename as atticFilename
     FROM RGAvideos 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, rows) => {
      if (err) {
        console.error('Database error when fetching videos:', err);
        return res.status(500).json({ error: 'Database error when fetching videos' });
      }

      const videos = [];
      
      rows.forEach(row => {
        if (row.roofVideo) {
          videos.push({
            id: row.customerNumber + '_roof',
            category: 'Roof',
            filename: row.roofFilename || 'Roof Video',
            description: row.roofDesc || 'Roof Video'
          });
        }
        if (row.gutterVideo) {
          videos.push({
            id: row.customerNumber + '_gutter',
            category: 'Gutter',
            filename: row.gutterFilename || 'Gutter Video',
            description: row.gutterDesc || 'Gutter Video'
          });
        }
        if (row.atticVideo) {
          videos.push({
            id: row.customerNumber + '_attic',
            category: 'Attic',
            filename: row.atticFilename || 'Attic Video',
            description: row.atticDesc || 'Attic Video'
          });
        }
      });

      return res.json({ videos });
    }
  );
});




// Save/Update endpoint
app.post('/api/client', (req, res) => {
    console.log('Received data:', JSON.stringify(req.body, null, 2));
    console.log('Received recordId:', req.body.recordId);
    console.log('Received username:', req.body.username);
    console.log('Received streetAddress:', req.body.streetAddress);

    const data = req.body;
    
    if (data.recordId) {
        console.log('Using recordId for update:', data.recordId);
        // First check if username exists in another record
        db.get('SELECT rowid FROM ClientProfile WHERE username = ? AND rowid != ?', 
            [data.username, data.recordId], 
            (err, existingRow) => {
                console.log('Username check result:', existingRow);
                if (err) {
                    console.error('Username check error:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                if (existingRow) {
                    return res.status(409).json({ 
                        error: 'Username already exists in another record',
                        field: 'username'
                    });
                }
                
                // Continue with update if no conflict
                const updateSql = `
                    UPDATE ClientProfile 
                    SET username = ?, 
                        firstName = ?, 
                        lastName = ?,
                        streetAddress = ?, 
                        city = ?,
                        state = ?,
                        zipCode = ?,
                        phoneNumber = ?, 
                        email = ?, 
                        mobileAppAccess = ?,
                        mobileAccessCode = ?,
                        roofMaterial = ?, 
                        manufacturer = ?, 
                        roofType = ?,
                        modelOfMaterial = ?, 
                        color = ?, 
                        ventType = ?, 
                        clientType = ?,
                        installDate = ?,
                        bcsWarrantyExpiration = ?,
                        deviceMac1 = ?, deviceName1 = ?, deviceSku1 = ?,
                        deviceMac2 = ?, deviceName2 = ?, deviceSku2 = ?,
                        deviceMac3 = ?, deviceName3 = ?, deviceSku3 = ?,
                        deviceMac4 = ?, deviceName4 = ?, deviceSku4 = ?,
                        deviceMac5 = ?, deviceName5 = ?, deviceSku5 = ?,
                        deviceMac6 = ?, deviceName6 = ?, deviceSku6 = ?,
                        deviceMac7 = ?, deviceName7 = ?, deviceSku7 = ?,
                        deviceMac8 = ?, deviceName8 = ?, deviceSku8 = ?,
                        deviceMac9 = ?, deviceName9 = ?, deviceSku9 = ?,
                        deviceMac10 = ?, deviceName10 = ?, deviceSku10 = ?,
                        customerNumber = ?, customerurl = ?,
                        gutterSize = ?, gutterColor = ?, gutterBrand = ?,
                        gutterClientType = ?,
                        gutterInstallDate = ?,
                        gutterWarrantyExpiration = ?,
                        referralFirstName = ?,
                        referralLastName = ?,
                        referralPhone = ?,
                        referralEmail = ?,
                        updatedAt = CURRENT_TIMESTAMP
                    WHERE rowid = ?
                `;

                const params = [
                    data.username,
                    data.firstName,
                    data.lastName,
                    data.streetAddress,
                    data.city,
                    data.state,
                    data.zipCode,
                    data.phoneNumber,
                    data.email,
                    data.mobileAppAccess,
                    data.mobileAccessCode,
                    data.roofMaterial,
                    data.manufacturer,
                    data.roofType,
                    data.modelOfMaterial,
                    data.color,
                    data.ventType,
                    data.clientType,
                    data.installDate,
                    data.bcsWarrantyExpiration,
                    data.deviceMac1, data.deviceName1, data.deviceSku1,
                    data.deviceMac2, data.deviceName2, data.deviceSku2,
                    data.deviceMac3, data.deviceName3, data.deviceSku3,
                    data.deviceMac4, data.deviceName4, data.deviceSku4,
                    data.deviceMac5, data.deviceName5, data.deviceSku5,
                    data.deviceMac6, data.deviceName6, data.deviceSku6,
                    data.deviceMac7, data.deviceName7, data.deviceSku7,
                    data.deviceMac8, data.deviceName8, data.deviceSku8,
                    data.deviceMac9, data.deviceName9, data.deviceSku9,
                    data.deviceMac10, data.deviceName10, data.deviceSku10,
                    data.customerNumber, data.customerurl,
                    data.gutterSize, data.gutterColor, data.gutterBrand,
                    data.gutterClientType,
                    data.gutterInstallDate,
                    data.gutterWarrantyExpiration,
                    data.referralFirstName,
                    data.referralLastName,
                    data.referralPhone,
                    data.referralEmail,
                    data.recordId                    
                ];

                console.log('Update SQL:', updateSql);
                console.log('Update params:', JSON.stringify(params, null, 2));

                db.run(updateSql, params, function(err) {
                    if (err) {
                        console.error('Update error:', err);
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    console.log(`Row updated: ${this.changes}`);
                    res.json({ message: 'Record updated successfully' });
                });
            }
        );
    } else {
        // Check if username exists before inserting
        db.get('SELECT rowid FROM ClientProfile WHERE username = ?', 
            [data.username], 
            (err, existingRow) => {
                if (err) {
                    console.error('Username check error:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                if (existingRow) {
                    return res.status(409).json({ 
                        error: 'Username already exists',
                        field: 'username'
                    });
                }
                
                // Insert new record
                const insertSql = `
                    INSERT INTO ClientProfile (
                        username, firstName, lastName, streetAddress, 
                        city, state, zipCode,
                        phoneNumber, email, mobileAppAccess, mobileAccessCode, 
                        roofMaterial, manufacturer, 
                        roofType, modelOfMaterial, color, ventType, 
                        clientType, installDate, bcsWarrantyExpiration, 
                        deviceMac1, deviceName1, deviceMac2, deviceName2,
                        deviceMac3, deviceName3, deviceMac4, deviceName4,
                        deviceMac5, deviceName5, deviceMac6, deviceName6,
                        deviceMac7, deviceName7, deviceMac8, deviceName8,
                        deviceMac9, deviceName9, deviceMac10, deviceName10, 
                        deviceSku1, deviceSku2, deviceSku3, deviceSku4, deviceSku5,
                        deviceSku6, deviceSku7, deviceSku8, deviceSku9, deviceSku10,
                        customerNumber, customerurl, gutterSize, gutterColor, gutterBrand,
                        gutterClientType,
                        gutterInstallDate,
                        gutterWarrantyExpiration,
                        referralFirstName, referralLastName, referralPhone, referralEmail
                    ) VALUES (${Array(62).fill('?').join(', ')})
                `;
                
                const params = [
                    data.username,
                    data.firstName,
                    data.lastName,
                    data.streetAddress,
                    data.city,
                    data.state,
                    data.zipCode,
                    data.phoneNumber,
                    data.email,
                    data.mobileAppAccess,
                    data.mobileAccessCode,
                    data.roofMaterial,
                    data.manufacturer,
                    data.roofType,
                    data.modelOfMaterial,
                    data.color,
                    data.ventType,
                    data.clientType,
                    data.installDate,
                    data.bcsWarrantyExpiration,
                    data.deviceMac1,
                    data.deviceName1,
                    data.deviceMac2,
                    data.deviceName2,
                    data.deviceMac3,
                    data.deviceName3,
                    data.deviceMac4,
                    data.deviceName4,
                    data.deviceMac5,
                    data.deviceName5,
                    data.deviceMac6,
                    data.deviceName6,
                    data.deviceMac7,
                    data.deviceName7,
                    data.deviceMac8,
                    data.deviceName8,
                    data.deviceMac9,
                    data.deviceName9,
                    data.deviceMac10,
                    data.deviceName10,
                    data.deviceSku1,
                    data.deviceSku2,
                    data.deviceSku3,
                    data.deviceSku4,
                    data.deviceSku5,
                    data.deviceSku6,
                    data.deviceSku7,
                    data.deviceSku8,
                    data.deviceSku9,
                    data.deviceSku10,
                    data.customerNumber,
                    data.customerurl,
                    // Add new gutter fields
                   data.gutterSize,
                   data.gutterColor,
                   data.gutterBrand,
                   data.gutterClientType,
                   data.gutterInstallDate,
                   data.gutterWarrantyExpiration,
                   data.referralFirstName,
                   data.referralLastName,
                   data.referralPhone,
                   data.referralEmail
                ];

                console.log('Insert SQL:', insertSql);
                console.log('Insert params:', JSON.stringify(params, null, 2));

                db.run(insertSql, params, function(err) {
                    if (err) {
                        console.error('Database error:', err.message);
                        console.error('SQL:', insertSql);
                        console.error('Parameters:', JSON.stringify(params, null, 2));
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    console.log(`Row inserted with ID: ${this.lastID}`);
                    res.json({ message: 'Record created successfully', id: this.lastID });
                });
            }
        );
    }
});

// Notes endpoints

app.post('/api/notes', (req, res) => {
    const { streetAddress, note, timestamp } = req.body;
    console.log('Adding note:', { streetAddress, note, timestamp });
    
    db.run(`INSERT INTO NotesLog (streetAddress, note, timestamp) 
            VALUES (?, ?, ?)`,
        [streetAddress, note, timestamp],
        (err) => {
            if (err) {
                console.error('Error saving note:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Note saved successfully' });
        });
});

// Handle media uploads
// API endpoint to upload media
app.post('/api/upload-media', upload.single('file'), (req, res) => {
  const { topic, mediaType, description, customerView, internalView, customerNumber } = req.body;
  const file = req.file;
  
  if (!file || !topic || !mediaType || !customerNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  let tableName, columnName, descColumn, filenameColumn;
  
  switch(mediaType) {
    case 'Document':
      tableName = 'RGAdocs';
      columnName = `doc${topic}`;
      descColumn = `doc${topic}Desc`;
      filenameColumn = `doc${topic}Filename`;
      break;
    case 'Image':
      tableName = 'RGAimages';
      columnName = `image${topic}`;
      descColumn = `image${topic}Desc`;
      filenameColumn = `image${topic}Filename`;
      break;
    case 'Video':
      tableName = 'RGAvideos';
      columnName = `video${topic}`;
      descColumn = `video${topic}Desc`;
      filenameColumn = `video${topic}Filename`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid media type' });
  }
  
  const custView = customerView === 'true' || customerView === '1' ? 1 : 0;
  const intView = internalView === 'true' || internalView === '1' ? 1 : 0;
  const originalFilename = file.originalname;
  
  db.run(
    `INSERT OR REPLACE INTO ${tableName} (customerNumber, ${columnName}, ${descColumn}, ${filenameColumn}, 
     ${columnName}CustomerView, ${columnName}InternalView) VALUES (?, ?, ?, ?, ?, ?)`,
    [customerNumber, file.buffer, description, originalFilename, custView, intView],
    function(err) {
      if (err) {
        console.error(`Database error when uploading to ${tableName}:`, err);
        return res.status(500).json({ error: 'Database error when uploading media' });
      }
      
      res.json({ success: true });
    }
  );
});

// API endpoint to update media view settings
app.post('/api/update-media-views', (req, res) => {
  const { customerNumber, customerView, internalView } = req.body;
  
  if (!customerNumber) {
    return res.status(400).json({ error: 'Customer number is required' });
  }
  
  // Convert checkbox values to integers (0 or 1)
  // This ensures that unchecked boxes (which send undefined or empty strings) are properly handled
  const custView = customerView === true || customerView === "true" || customerView === 1 || customerView === "1" ? 1 : 0;
  const intView = internalView === true || internalView === "true" || internalView === 1 || internalView === "1" ? 1 : 0;
  
  console.log('Updating views for customer:', customerNumber, 'customerView:', custView, 'internalView:', intView);
  
  // Update view settings in all three tables
  const updatePromises = [
    new Promise((resolve, reject) => {
      db.run(
        `UPDATE RGAdocs SET 
         docRoofCustomerView = ?, docRoofInternalView = ?,
         docGutterCustomerView = ?, docGutterInternalView = ?,
         docAtticCustomerView = ?, docAtticInternalView = ?
         WHERE customerNumber = ?`,
        [custView, intView, custView, intView, custView, intView, customerNumber],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    }),
    new Promise((resolve, reject) => {
      db.run(
        `UPDATE RGAimages SET 
         imageRoofCustomerView = ?, imageRoofInternalView = ?,
         imageGutterCustomerView = ?, imageGutterInternalView = ?,
         imageAtticCustomerView = ?, imageAtticInternalView = ?
         WHERE customerNumber = ?`,
        [custView, intView, custView, intView, custView, intView, customerNumber],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    }),
    new Promise((resolve, reject) => {
      db.run(
        `UPDATE RGAvideos SET 
         videoRoofCustomerView = ?, videoRoofInternalView = ?,
         videoGutterCustomerView = ?, videoGutterInternalView = ?,
         videoAtticCustomerView = ?, videoAtticInternalView = ?
         WHERE customerNumber = ?`,
        [custView, intView, custView, intView, custView, intView, customerNumber],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    })
  ];
  
  Promise.all(updatePromises)
    .then(() => {
      res.json({ success: true });
    })
    .catch(err => {
      console.error('Error updating media view settings:', err);
      res.status(500).json({ error: 'Database error when updating view settings' });
    });
});

// Add this to your server-side code
app.get('/api/media-view-status/:customerNumber', (req, res) => {
  const { customerNumber } = req.params;
  
  // Get the current view settings from the database
  db.get(
    `SELECT docRoofCustomerView as customerView, docRoofInternalView as internalView 
     FROM RGAdocs WHERE customerNumber = ? LIMIT 1`,
    [customerNumber],
    (err, row) => {
      if (err) {
        console.error('Error fetching media view status:', err);
        res.status(500).json({ error: 'Database error' });
      } else {
        res.json(row || { customerView: 0, internalView: 1 });
      }
    }
  );
});

app.get('/api/notes/:address', (req, res) => {
    const address = req.params.address;
    console.log('Fetching notes for address:', address);
    
    db.all(`SELECT * FROM NotesLog 
            WHERE streetAddress = ? 
            ORDER BY timestamp DESC`,
        [address],
        (err, rows) => {
            if (err) {
                console.error('Error fetching notes:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
});

app.get('/api/dropdowns/deviceMac', (req, res) => {
  const query = `
    SELECT DISTINCT deviceMac1 as mac FROM ClientProfile WHERE deviceMac1 IS NOT NULL AND deviceMac1 != ''
    UNION
    SELECT DISTINCT deviceMac2 FROM ClientProfile WHERE deviceMac2 IS NOT NULL AND deviceMac2 != ''
    UNION
    SELECT DISTINCT deviceMac3 FROM ClientProfile WHERE deviceMac3 IS NOT NULL AND deviceMac3 != ''
    UNION
    SELECT DISTINCT deviceMac4 FROM ClientProfile WHERE deviceMac4 IS NOT NULL AND deviceMac4 != ''
    UNION
    SELECT DISTINCT deviceMac5 FROM ClientProfile WHERE deviceMac5 IS NOT NULL AND deviceMac5 != ''
    UNION
    SELECT DISTINCT deviceMac6 FROM ClientProfile WHERE deviceMac6 IS NOT NULL AND deviceMac6 != ''
    UNION
    SELECT DISTINCT deviceMac7 FROM ClientProfile WHERE deviceMac7 IS NOT NULL AND deviceMac7 != ''
    UNION
    SELECT DISTINCT deviceMac8 FROM ClientProfile WHERE deviceMac8 IS NOT NULL AND deviceMac8 != ''
    UNION
    SELECT DISTINCT deviceMac9 FROM ClientProfile WHERE deviceMac9 IS NOT NULL AND deviceMac9 != ''
    UNION
    SELECT DISTINCT deviceMac10 FROM ClientProfile WHERE deviceMac10 IS NOT NULL AND deviceMac10 != ''
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(row => row.mac));
  });
});


// Get unique MAC addresses endpoint
app.get('/api/dropdowns/devicemacdropdown', (req, res) => {
  const query = `
    SELECT DISTINCT deviceMac1 as mac FROM ClientProfile 
    WHERE deviceMac1 IS NOT NULL 
    AND deviceMac1 != '' 
    AND (
      LENGTH(deviceMac1) = 17  -- 6-byte format (xx:xx:xx:xx:xx:xx)
      OR LENGTH(deviceMac1) = 23  -- 8-byte format (xx:xx:xx:xx:xx:xx:xx:xx)
    )
    UNION
    SELECT DISTINCT deviceMac2 FROM ClientProfile 
    WHERE deviceMac2 IS NOT NULL 
    AND deviceMac2 != '' 
    AND (
      LENGTH(deviceMac2) = 17 
      OR LENGTH(deviceMac2) = 23
    )
    UNION
    SELECT DISTINCT deviceMac3 FROM ClientProfile 
    WHERE deviceMac3 IS NOT NULL 
    AND deviceMac3 != '' 
    AND (
      LENGTH(deviceMac3) = 17 
      OR LENGTH(deviceMac3) = 23
    )
    UNION
    SELECT DISTINCT deviceMac4 FROM ClientProfile 
    WHERE deviceMac4 IS NOT NULL 
    AND deviceMac4 != '' 
    AND (
      LENGTH(deviceMac4) = 17 
      OR LENGTH(deviceMac4) = 23
    )
    UNION
    SELECT DISTINCT deviceMac5 FROM ClientProfile 
    WHERE deviceMac5 IS NOT NULL 
    AND deviceMac5 != '' 
    AND (
      LENGTH(deviceMac5) = 17 
      OR LENGTH(deviceMac5) = 23
    )
    UNION
    SELECT DISTINCT deviceMac6 FROM ClientProfile 
    WHERE deviceMac6 IS NOT NULL 
    AND deviceMac6 != '' 
    AND (
      LENGTH(deviceMac6) = 17 
      OR LENGTH(deviceMac6) = 23
    )
    UNION
    SELECT DISTINCT deviceMac7 FROM ClientProfile 
    WHERE deviceMac7 IS NOT NULL 
    AND deviceMac7 != '' 
    AND (
      LENGTH(deviceMac7) = 17 
      OR LENGTH(deviceMac7) = 23
    )
    UNION
    SELECT DISTINCT deviceMac8 FROM ClientProfile 
    WHERE deviceMac8 IS NOT NULL 
    AND deviceMac8 != '' 
    AND (
      LENGTH(deviceMac8) = 17 
      OR LENGTH(deviceMac8) = 23
    )
    UNION
    SELECT DISTINCT deviceMac9 FROM ClientProfile 
    WHERE deviceMac9 IS NOT NULL 
    AND deviceMac9 != '' 
    AND (
      LENGTH(deviceMac9) = 17 
      OR LENGTH(deviceMac9) = 23
    )
    UNION
    SELECT DISTINCT deviceMac10 FROM ClientProfile 
    WHERE deviceMac10 IS NOT NULL 
    AND deviceMac10 != '' 
    AND (
      LENGTH(deviceMac10) = 17 
      OR LENGTH(deviceMac10) = 23
    )
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(row => row.mac));
  });
});

app.get('/api/debug/macaddresses', (req, res) => {
  const query = `
    SELECT 
      deviceMac1, deviceMac2, deviceMac3, deviceMac4, deviceMac5,
      deviceMac6, deviceMac7, deviceMac8, deviceMac9, deviceMac10
    FROM ClientProfile
    LIMIT 5
  `;
  
  try {
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('MAC Address Query Error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Sample MAC Addresses:', rows);
      res.json(rows);
    });
  } catch (error) {
    console.error('Unexpected error in MAC address route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Add this after your other API endpoints
app.get('/api/check-username', (req, res) => {
  const username = req.query.username;
  const excludeId = req.query.excludeId; // For excluding the current record when updating
  
  let query = 'SELECT rowid FROM ClientProfile WHERE username = ?';
  let params = [username];
  
  if (excludeId) {
    query += ' AND rowid != ?';
    params.push(excludeId);
  }
  
  db.get(query, params, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json({ 
      available: !row,
      message: row ? 'Username already exists' : 'Username is available'
    });
  });
});

// Endpoint to get media for viewing/downloading
app.get('/api/media/:type/:topic/:customerNumber', (req, res) => {
  const { type, topic, customerNumber } = req.params;
  
  let table, blobColumn;
  
  switch (type.toLowerCase()) {
    case 'document':
      table = 'RGAdocs';
      blobColumn = `doc${topic}`;
      break;
    case 'image':
      table = 'RGAimages';
      blobColumn = `image${topic}`;
      break;
    case 'video':
      table = 'RGAvideos';
      blobColumn = `video${topic}`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid media type' });
  }
  
  db.get(`SELECT ${blobColumn} FROM ${table} WHERE customerNumber = ?`, [customerNumber], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row || !row[blobColumn]) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    // Set appropriate content type based on file extension or media type
    // This is a simplified version - you might want to store and check actual file types
    let contentType;
    switch (type.toLowerCase()) {
      case 'document':
        contentType = 'application/octet-stream';
        break;
      case 'image':
        contentType = 'image/jpeg';  // Assuming JPEG, adjust as needed
        break;
      case 'video':
        contentType = 'video/mp4';   // Assuming MP4, adjust as needed
        break;
    }
    
    res.set('Content-Type', contentType);
    res.send(row[blobColumn]);
  });
});


// Create MasterCompanyInfo table connection
const masterDb = new sqlite3.Database(path.join(__dirname, 'MasterCompanyInfo.db'), (err) => {
    if (err) {
        console.error('Error connecting to MasterCompanyInfo database:', err.message);
    } else {
        console.log('Connected to MasterCompanyInfo database');
    }
});

app.post('/api/validate-company', (req, res) => {
  const { companyNumber } = req.body;
  
  if (!companyNumber) {
    return res.status(400).json({ valid: false, message: 'Company Number is required' });
  }

  masterDb.get('SELECT * FROM CompanyDataKeys WHERE companyNumber = ?', [companyNumber], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ valid: false, message: 'Database error', error: err.message });
    }
    
    if (row) {
      res.json({ valid: true });
    } else {
      res.json({ valid: false, message: 'Invalid Company Number' });
    }
  });
});


app.get('/api/company-info/:companyNumber', (req, res) => {
  const { companyNumber } = req.params;
  masterDb.get('SELECT * FROM Companies WHERE companyNumber = ?', [companyNumber], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'Company not found' });
    }
  });
});

// Load active keys for the company
function loadActiveKeys(companyNumber) {
    if (!companyNumber) return;
    
    fetch(`/api/company-active-keys/${companyNumber}`)
    .then(response => response.json())
    .then(data => {
        const activeKeysList = document.getElementById('activeKeysList');
        
        if (data.error) {
            activeKeysList.innerHTML = `<p>No active licenses found</p>`;
            return;
        }
        
        if (data.activeModules && data.activeModules.length > 0) {
            activeKeysList.innerHTML = data.activeModules.map(module => 
                `<div style="color: green; margin: 5px 0;"><i class="fas fa-check-circle"></i> ${module} - Active</div>`
            ).join('');
        } else {
            activeKeysList.innerHTML = `<p>No active licenses found</p>`;
        }
    })
    .catch(error => {
        console.error('Error loading active keys:', error);
    });
}

// Helper function to get file extension from MIME type
function getExtension(mimeType) {
  switch(mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'video/mp4':
      return 'mp4';
    default:
      return 'bin';
  }
}

// Add this to your server code after the other endpoints
app.post('/api/company-profile', (req, res) => {
    const data = req.body;
    
    // Check if company already exists
    masterDb.get('SELECT * FROM CompanyProfile LIMIT 1', [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        let sql;
        let params;
        
        if (row) {
            // Update existing company
            sql = `
                UPDATE CompanyProfile SET
                companyName = ?,
                companyAddress = ?,
                companyCity = ?,
                companyState = ?,
                CompanyZipCode = ?,
                companyFirstName = ?,
                companyLastName = ?,
                companyPhoneNumber = ?,
                companyEmail = ?
                WHERE id = ?
            `;
            params = [
                data.companyName,
                data.companyAddress,
                data.companyCity,
                data.companyState || 'TX',
                data.CompanyZipCode,
                data.companyFirstName,
                data.companyLastName,
                data.companyPhoneNumber,
                data.companyEmail,
                row.id
            ];
        } else {
            // Insert new company
            sql = `
                INSERT INTO CompanyProfile (
                    companyName,
                    companyNumber,
                    companyAddress,
                    companyCity,
                    companyState,
                    CompanyZipCode,
                    companyFirstName,
                    companyLastName,
                    companyPhoneNumber,
                    companyEmail
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            // Generate a unique company number if not provided
            const companyNumber = data.companyNumber || `COMP-${Date.now()}`;
            
            params = [
                data.companyName,
                companyNumber,
                data.companyAddress,
                data.companyCity,
                data.companyState || 'TX',
                data.CompanyZipCode,
                data.companyFirstName,
                data.companyLastName,
                data.companyPhoneNumber,
                data.companyEmail
            ];
        }
        
        masterDb.run(sql, params, function(err) {
            if (err) {
                console.error('Error saving company profile:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Return the company number
            res.json({ 
                message: 'Company profile saved successfully',
                companyNumber: data.companyNumber || row?.companyNumber || `COMP-${Date.now()}`
            });
        });
    });
});

// Add a GET endpoint to retrieve company profile
app.get('/api/company-profile', (req, res) => {
    masterDb.get('SELECT * FROM CompanyProfile LIMIT 1', [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.json({ error: 'No company profile found' });
        }
        
        res.json(row);
    });
});

// Create CompanyProfile table if it doesn't exist
masterDb.run(`CREATE TABLE IF NOT EXISTS CompanyProfile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyName TEXT,
    companyNumber TEXT UNIQUE,
    companyAddress TEXT,
    companyCity TEXT,
    companyState TEXT,
    CompanyZipCode TEXT,
    companyFirstName TEXT,
    companyLastName TEXT,
    companyPhoneNumber TEXT,
    companyEmail TEXT
)`);
// Validate company key endpoint
app.post('/api/validate-company-key', (req, res) => {
    const { companyNumber, keyToValidate } = req.body;
    
    if (!companyNumber || !keyToValidate) {
        return res.status(400).json({ 
            valid: false, 
            message: 'Company number and key are required' 
        });
    }
    
    // Query to check all possible key fields
    const query = `
        SELECT 
            customerKeys1, customerKeys2, customerKeys3, 
            customerKeys4, customerKeys5, customerKeys6 
        FROM CompanyDataKeys 
        WHERE companyNumber = ?
    `;
    
    masterDb.get(query, [companyNumber], (err, row) => {
        if (err) {
            console.error('Key validation error:', err);
            return res.status(500).json({ 
                valid: false, 
                message: 'Error validating key' 
            });
        }
        
        if (!row) {
            return res.status(404).json({ 
                valid: false, 
                message: 'Company not found' 
            });
        }
        
        // Check if the key exists in any of the key fields
        const keyFields = ['customerKeys1', 'customerKeys2', 'customerKeys3', 
                          'customerKeys4', 'customerKeys5', 'customerKeys6'];
        
        let keyFound = false;
        let keyPrefix = '';
        
        for (const field of keyFields) {
            if (row[field] === keyToValidate) {
                keyFound = true;
                // Extract the prefix (first 2-3 characters)
                keyPrefix = keyToValidate.substring(0, 3);
                break;
            }
        }
        
        if (keyFound) {
            // Determine the module based on prefix
            let module = '';
            let status = 'active';
            
            if (keyPrefix.startsWith('RGA')) {
                module = 'Roof/Gutters/Attic';
            } else if (keyPrefix.startsWith('FP')) {
                module = 'Fencing/Painting';
                status = 'coming_soon';
            } else if (keyPrefix.startsWith('PH')) {
                module = 'Plumbing/Handyman';
                status = 'coming_soon';
            } else if (keyPrefix.startsWith('LP')) {
                module = 'Landscaping/Pool Service';
                status = 'coming_soon';
            } else if (keyPrefix.startsWith('REM')) {
                module = 'Remodeling';
                status = 'coming_soon';
            } else if (keyPrefix.startsWith('TA')) {
                module = 'Tech/Audio';
                status = 'coming_soon';
            } else {
                module = 'Unknown Module';
            }
            
            // Store the validated key in the company profile
            storeValidatedKey(companyNumber, keyToValidate, module);
            
            return res.json({ 
                valid: true, 
                module: module,
                status: status,
                message: `License key for ${module} is valid` 
            });
        } else {
            return res.json({ 
                valid: false, 
                message: 'Invalid license key' 
            });
        }
    });
});

// Helper function to store validated key
function storeValidatedKey(companyNumber, key, module) {
    // First find an empty key slot
    masterDb.get(
        'SELECT companyValidKey1, companyValidKey2, companyValidKey3, companyValidKey4, companyValidKey5, companyValidKey6 FROM CompanyProfile WHERE companyNumber = ?',
        [companyNumber],
        (err, row) => {
            if (err || !row) {
                console.error('Error retrieving company profile:', err);
                return;
            }
            
            // Check if key already exists
            const keyFields = ['companyValidKey1', 'companyValidKey2', 'companyValidKey3', 
                              'companyValidKey4', 'companyValidKey5', 'companyValidKey6'];
            const moduleFields = ['companyValidModule1', 'companyValidModule2', 'companyValidModule3',
                                 'companyValidModule4', 'companyValidModule5', 'companyValidModule6'];
            
            for (let i = 0; i < keyFields.length; i++) {
                if (row[keyFields[i]] === key) {
                    // Key already exists, no need to store again
                    return;
                }
            }
            
            // Find first empty slot
            let emptyKeyField = null;
            let emptyModuleField = null;
            
            for (let i = 0; i < keyFields.length; i++) {
                if (!row[keyFields[i]]) {
                    emptyKeyField = keyFields[i];
                    emptyModuleField = moduleFields[i];
                    break;
                }
            }
            
            if (emptyKeyField && emptyModuleField) {
                // Update the company profile with the new key and module
                const updateSql = `
                    UPDATE CompanyProfile 
                    SET ${emptyKeyField} = ?,
                        ${emptyModuleField} = ?
                    WHERE companyNumber = ?
                `;
                
                masterDb.run(updateSql, [key, module, companyNumber], (err) => {
                    if (err) {
                        console.error('Error storing validated key:', err);
                    }
                });
            }
        }
    );
}

// Get active keys for a company
app.get('/api/company-active-keys/:companyNumber', (req, res) => {
    const { companyNumber } = req.params;
    
    if (!companyNumber) {
        return res.status(400).json({ error: 'Company number is required' });
    }
    
    const query = `
        SELECT 
            companyValidModule1, companyValidModule2, companyValidModule3,
            companyValidModule4, companyValidModule5, companyValidModule6
        FROM CompanyProfile 
        WHERE companyNumber = ?
    `;
    
    masterDb.get(query, [companyNumber], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        // Collect all active modules
        const activeModules = [];
        const moduleFields = ['companyValidModule1', 'companyValidModule2', 'companyValidModule3',
                             'companyValidModule4', 'companyValidModule5', 'companyValidModule6'];
        
        for (const field of moduleFields) {
            if (row[field]) {
                activeModules.push(row[field]);
            }
        }
        
        res.json({ activeModules });
    });
});

// API endpoint to get customer media
app.get('/api/customer-media', (req, res) => {
  const { customerNumber } = req.query;
  const topics = req.query['topics[]'] || [];
  
  // Convert to array if single value
  const topicArray = Array.isArray(topics) ? topics : [topics];
  
  if (!customerNumber) {
    return res.status(400).json({ error: 'Customer number is required' });
  }
  
  // Prepare response object
  const result = {
    documents: [],
    images: [],
    videos: []
  };
  
  // Get documents
  db.all(`SELECT * FROM RGAdocs WHERE customerNumber = ?`, [customerNumber], (err, docRows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error fetching documents' });
    }
    
    // Process document results
    if (docRows && docRows.length > 0) {
      docRows.forEach(row => {
        // Check each topic field
        if (topicArray.includes('Roof') && row.docRoof) {
          result.documents.push({
            id: row.rowid,
            topic: 'Roof',
            description: row.docRoofDesc,
            customerView: row.docRoofCustomerView,
            internalView: row.docRoofInternalView,
            filename: `roof_doc_${row.rowid}.pdf` // Example filename
          });
        }
        
        if (topicArray.includes('Gutter') && row.docGutter) {
          result.documents.push({
            id: row.rowid,
            topic: 'Gutter',
            description: row.docGutterDesc,
            customerView: row.docGutterCustomerView,
            internalView: row.docGutterInternalView,
            filename: `gutter_doc_${row.rowid}.pdf`
          });
        }
        
        if (topicArray.includes('Attic') && row.docAttic) {
          result.documents.push({
            id: row.rowid,
            topic: 'Attic',
            description: row.docAtticDesc,
            customerView: row.docAtticCustomerView,
            internalView: row.docAtticInternalView,
            filename: `attic_doc_${row.rowid}.pdf`
          });
        }
      });
    }
    
    // Get images
    db.all(`SELECT * FROM RGAimages WHERE customerNumber = ?`, [customerNumber], (err, imgRows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error fetching images' });
      }
      
      // Process image results
      if (imgRows && imgRows.length > 0) {
        imgRows.forEach(row => {
          if (topicArray.includes('Roof') && row.imageRoof) {
            result.images.push({
              id: row.rowid,
              topic: 'Roof',
              description: row.imageRoofDesc,
              customerView: row.imageRoofCustomerView,
              internalView: row.imageRoofInternalView,
              filename: `roof_image_${row.rowid}.jpg`
            });
          }
          
          if (topicArray.includes('Gutter') && row.imageGutter) {
            result.images.push({
              id: row.rowid,
              topic: 'Gutter',
              description: row.imageGutterDesc,
              customerView: row.imageGutterCustomerView,
              internalView: row.imageGutterInternalView,
              filename: `gutter_image_${row.rowid}.jpg`
            });
          }
          
          if (topicArray.includes('Attic') && row.imageAttic) {
            result.images.push({
              id: row.rowid,
              topic: 'Attic',
              description: row.imageAtticDesc,
              customerView: row.imageAtticCustomerView,
              internalView: row.imageAtticInternalView,
              filename: `attic_image_${row.rowid}.jpg`
            });
          }
        });
      }
      
      // Get videos
      db.all(`SELECT * FROM RGAvideos WHERE customerNumber = ?`, [customerNumber], (err, videoRows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error fetching videos' });
        }
        
        // Process video results
        if (videoRows && videoRows.length > 0) {
          videoRows.forEach(row => {
            if (topicArray.includes('Roof') && row.videoRoof) {
              result.videos.push({
                id: row.rowid,
                topic: 'Roof',
                description: row.videoRoofDesc,
                customerView: row.videoRoofCustomerView,
                internalView: row.videoRoofInternalView,
                filename: `roof_video_${row.rowid}.mp4`
              });
            }
            
            if (topicArray.includes('Gutter') && row.videoGutter) {
              result.videos.push({
                id: row.rowid,
                topic: 'Gutter',
                description: row.videoGutterDesc,
                customerView: row.videoGutterCustomerView,
                internalView: row.videoGutterInternalView,
                filename: `gutter_video_${row.rowid}.mp4`
              });
            }
            
            if (topicArray.includes('Attic') && row.videoAttic) {
              result.videos.push({
                id: row.rowid,
                topic: 'Attic',
                description: row.videoAtticDesc,
                customerView: row.videoAtticCustomerView,
                internalView: row.videoAtticInternalView,
                filename: `attic_video_${row.rowid}.mp4`
              });
            }
          });
        }
        
        // Send the complete result
        res.json(result);
      });
    });
  });
});

// API endpoint to get media file
app.get('/api/media/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const { customerNumber } = req.query;
  
  if (!id || !customerNumber) {
    return res.status(400).json({ error: 'Media ID and customer number are required' });
  }
  
  let table, column;
  let contentType;
  
  switch (type) {
    case 'document':
      table = 'RGAdocs';
      contentType = 'application/pdf';
      break;
    case 'image':
      table = 'RGAimages';
      contentType = 'image/jpeg';
      break;
    case 'video':
      table = 'RGAvideos';
      contentType = 'video/mp4';
      break;
    default:
      return res.status(400).json({ error: 'Invalid media type' });
  }
  
  // Query to get the specific media file
  db.get(`SELECT * FROM ${table} WHERE rowid = ? AND customerNumber = ?`, [id, customerNumber], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    // Determine which blob field to use based on the topic in the filename
    let blob;
    if (type === 'document') {
      if (row.docRoof) blob = row.docRoof;
      else if (row.docGutter) blob = row.docGutter;
      else if (row.docAttic) blob = row.docAttic;
    } else if (type === 'image') {
      if (row.imageRoof) blob = row.imageRoof;
      else if (row.imageGutter) blob = row.imageGutter;
      else if (row.imageAttic) blob = row.imageAttic;
    } else if (type === 'video') {
      if (row.videoRoof) blob = row.videoRoof;
      else if (row.videoGutter) blob = row.videoGutter;
      else if (row.videoAttic) blob = row.videoAttic;
    }
    
    if (!blob) {
      return res.status(404).json({ error: 'Media content not found' });
    }
    
    res.set('Content-Type', contentType);
    res.send(blob);
  });
});


// Delete client endpoint
app.delete('/api/client/:id', (req, res) => {
    const recordId = req.params.id;
    
    // First get the street address to delete associated notes
    db.get('SELECT streetAddress FROM ClientProfile WHERE rowid = ?', [recordId], (err, row) => {
        if (err) {
            console.error('Error finding record:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        const streetAddress = row.streetAddress;
        
        // Begin transaction
        db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
                console.error('Transaction error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Delete notes associated with the address
            db.run('DELETE FROM NotesLog WHERE streetAddress = ?', [streetAddress], (err) => {
                if (err) {
                    console.error('Error deleting notes:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                // Delete the client record
                db.run('DELETE FROM ClientProfile WHERE rowid = ?', [recordId], function(err) {
                    if (err) {
                        console.error('Error deleting client:', err);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }
                    
                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        return res.status(404).json({ error: 'Record not found' });
                    }
                    
                    // Commit the transaction
                    db.run('COMMIT', (err) => {
                        if (err) {
                            console.error('Commit error:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        
                        console.log(`Record ${recordId} and associated notes deleted`);
                        res.json({ message: 'Record and associated notes deleted successfully' });
                    });
                });
            });
        });
    });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});