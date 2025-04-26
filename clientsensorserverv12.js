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
app.use(express.static(path.join(__dirname, '..', 'Sensors'))); // Keep your existing static path

// Add these new static paths
app.use(express.static(path.join(__dirname, 'public'))); // Serve from public folder
app.use(express.static(path.join(__dirname))); // Serve from current directory
// Serve the main entry form

app.get(['/', '/Sensors'], (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Sensors', 'clientsensor.html'));
});

app.get('/fencePaintingSection.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fencePaintingSection.html'));
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

app.get('/api/customer-docs/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  if (!customerNumber) {
    return res.status(400).json({ error: 'Customer number is required' });
  }

  // Fetch all rows for the given customer number
  db.all(
    `SELECT customerNumber, 
            docRoof as roofDoc, docRoofDesc as roofDesc, docRoofFilename as roofFilename,
            docRoofCustomerView as roofCustomerView, docRoofInternalView as roofInternalView,
            docGutter as gutterDoc, docGutterDesc as gutterDesc, docGutterFilename as gutterFilename,
            docGutterCustomerView as gutterCustomerView, docGutterInternalView as gutterInternalView,
            docAttic as atticDoc, docAtticDesc as atticDesc, docAtticFilename as atticFilename,
            docAtticCustomerView as atticCustomerView, docAtticInternalView as atticInternalView
     FROM RGAdocs 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, rows) => {
      if (err) {
        console.error('Database error when fetching docs:', err);
        return res.status(500).json({ error: 'Database error when fetching documents' });
      }

      if (!rows || rows.length === 0) {
        return res.json({ docs: [] }); // Return empty array if no documents found
      }

      const docs = [];

      // Process each row and add documents to the response
      rows.forEach(row => {
        if (row.roofDoc) {
          docs.push({
            id: `${row.customerNumber}-roof`,
            category: 'Roof',
            filename: row.roofFilename || 'Roof Document',
            description: row.roofDesc || 'Roof Document',
            customerView: row.roofCustomerView,
            internalView: row.roofInternalView
          });
        }

        if (row.gutterDoc) {
          docs.push({
            id: `${row.customerNumber}-gutter`,
            category: 'Gutter',
            filename: row.gutterFilename || 'Gutter Document',
            description: row.gutterDesc || 'Gutter Document',
            customerView: row.gutterCustomerView,
            internalView: row.gutterInternalView
          });
        }

        if (row.atticDoc) {
          docs.push({
            id: `${row.customerNumber}-attic`,
            category: 'Attic',
            filename: row.atticFilename || 'Attic Document',
            description: row.atticDesc || 'Attic Document',
            customerView: row.atticCustomerView,
            internalView: row.atticInternalView
          });
        }
      });

      return res.json({ docs }); // Return all documents in response
    }
  );
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
  
  // Capitalize first letter of category
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

  // Database column configuration
  const mediaConfig = {
    Document: { table: 'RGAdocs', prefix: 'doc', mime: 'application/pdf' },
    Image: { table: 'RGAimages', prefix: 'image', mime: 'image/jpeg' },
    Video: { table: 'RGAvideos', prefix: 'video', mime: 'video/mp4' }
  };

  const config = mediaConfig[mediaType];
  if (!config) return res.status(400).json({ error: "Invalid media type" });

  // Use formatted category for column names
  const columnName = `${config.prefix}${formattedCategory}`;
  const filenameColumn = `${columnName}Filename`;

  // Modified query to find the specific row with the document
  const query = `
    SELECT ${columnName} as fileData, ${filenameColumn} as filename 
    FROM ${config.table} 
    WHERE customerNumber = ? AND ${columnName} IS NOT NULL
    LIMIT 1
  `;

  db.get(
    query,
    [customerNumber],
    (err, row) => {
      if (err) {
        console.error(`Database error: ${err.message}`);
        return res.status(500).json({ error: "Database error" });
      }

      if (!row?.fileData) {
        return res.status(404).json({ error: "File not found" });
      }

      // Set proper MIME type
      res.setHeader('Content-Type', config.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${row.filename || formattedCategory}"`);
      res.send(Buffer.from(row.fileData));
    }
  );
});

app.post('/api/update-file-view', (req, res) => {
  const { mediaType, category, fileId, customerNumber, viewType, value, filename } = req.body;
  
  if (!mediaType || !category || !customerNumber || !viewType || !filename) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }
  
  // Determine the table and column names based on mediaType and category
  let tableName, viewColumn, filenameColumn;
  
  // Format category to ensure proper capitalization
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  
  switch(mediaType) {
    case 'Document':
      tableName = 'RGAdocs';
      viewColumn = viewType === 'customer' ? `doc${formattedCategory}CustomerView` : `doc${formattedCategory}InternalView`;
      filenameColumn = `doc${formattedCategory}Filename`;
      break;
    case 'Image':
      tableName = 'RGAimages';
      viewColumn = viewType === 'customer' ? `image${formattedCategory}CustomerView` : `image${formattedCategory}InternalView`;
      filenameColumn = `image${formattedCategory}Filename`;
      break;
    case 'Video':
      tableName = 'RGAvideos';
      viewColumn = viewType === 'customer' ? `video${formattedCategory}CustomerView` : `video${formattedCategory}InternalView`;
      filenameColumn = `video${formattedCategory}Filename`;
      break;
    default:
      return res.status(400).json({ success: false, error: 'Invalid media type' });
  }
  
  // Update the database - using BOTH customerNumber AND filename to identify the correct row
  db.run(
    `UPDATE ${tableName} SET ${viewColumn} = ? WHERE customerNumber = ? AND ${filenameColumn} = ?`,
    [value, customerNumber, filename],
    function(err) {
      if (err) {
        console.error(`Database error updating view setting:`, err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      console.log(`Update result: ${this.changes} rows changed`);
      
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'File not found or no changes made' });
      }
      
      res.json({ success: true });
    }
  );
});

// API endpoint to get customer images
app.get('/api/customer-images/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  db.all(
    `SELECT customerNumber, 
            imageRoof as roofImage, imageRoofDesc as roofDesc, imageRoofFilename as roofFilename,
            imageRoofCustomerView as roofCustomerView, imageRoofInternalView as roofInternalView,
            imageGutter as gutterImage, imageGutterDesc as gutterDesc, imageGutterFilename as gutterFilename,
            imageGutterCustomerView as gutterCustomerView, imageGutterInternalView as gutterInternalView,
            imageAttic as atticImage, imageAtticDesc as atticDesc, imageAtticFilename as atticFilename,
            imageAtticCustomerView as atticCustomerView, imageAtticInternalView as atticInternalView
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
            description: row.roofDesc || 'Roof Image',
            customerView: row.roofCustomerView,
            internalView: row.roofInternalView
          });
        }
        if (row.gutterImage) {
          images.push({
            id: row.customerNumber + '_gutter',
            category: 'Gutter',
            filename: row.gutterFilename || 'Gutter Image',
            description: row.gutterDesc || 'Gutter Image',
            customerView: row.gutterCustomerView,
            internalView: row.gutterInternalView
          });
        }
        if (row.atticImage) {
          images.push({
            id: row.customerNumber + '_attic',
            category: 'Attic',
            filename: row.atticFilename || 'Attic Image',
            description: row.atticDesc || 'Attic Image',
            customerView: row.atticCustomerView,
            internalView: row.atticInternalView
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
            videoRoofCustomerView as roofCustomerView, videoRoofInternalView as roofInternalView,
            videoGutter as gutterVideo, videoGutterDesc as gutterDesc, videoGutterFilename as gutterFilename,
            videoGutterCustomerView as gutterCustomerView, videoGutterInternalView as gutterInternalView,
            videoAttic as atticVideo, videoAtticDesc as atticDesc, videoAtticFilename as atticFilename,
            videoAtticCustomerView as atticCustomerView, videoAtticInternalView as atticInternalView
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
            description: row.roofDesc || 'Roof Video',
            customerView: row.roofCustomerView,
            internalView: row.roofInternalView
          });
        }
        if (row.gutterVideo) {
          videos.push({
            id: row.customerNumber + '_gutter',
            category: 'Gutter',
            filename: row.gutterFilename || 'Gutter Video',
            description: row.gutterDesc || 'Gutter Video',
            customerView: row.gutterCustomerView,
            internalView: row.gutterInternalView
          });
        }
        if (row.atticVideo) {
          videos.push({
            id: row.customerNumber + '_attic',
            category: 'Attic',
            filename: row.atticFilename || 'Attic Video',
            description: row.atticDesc || 'Attic Video',
            customerView: row.atticCustomerView,
            internalView: row.atticInternalView
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

    console.log('Received data:', data);
    console.log('Referral fields:', {
    fpFirstName: data.fpFirstName,
    fpLastName: data.fpLastName,
    fpPhoneNumber: data.fpPhoneNumber,
    fpEmail: data.fpEmail
  });    

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
                        roofSales = ?,
                        gutterSales = ?,
                        fenceType = ?,
                        fenceMaterial = ?,
                        fenceHeight = ?,
                        fenceColor = ?,
                        fenceStyle = ?,
                        fenceOwnerStatus = ?,
                        fenceInstallDate = ?,
                        fenceWarrantyExp = ?,
                        fenceSalesRep = ?,
                        paintingType = ?,
                        paintingColor = ?,
                        paintingBrand = ?,
                        paintingFinish = ?,
                        paintingAreaPainted = ?,
                        paintingOwnerStatus = ?,
                        paintingDate = ?,
                        paintingWarrantyExp = ?,
                        paintingSalesRep = ?,  
                        fpFirstName = ?,
                        fpLastName = ?,
                        fpPhoneNumber = ?,
                        fpEmail = ?,                      
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
                    data.roofSales,
                    data.gutterSales,
                    data.fenceType,
                    data.fenceMaterial,
                    data.fenceHeight,
                    data.fenceColor,
                    data.fenceStyle,
                    data.fenceOwnerStatus,
                    data.fenceInstallDate,
                    data.fenceWarrantyExp,
                    data.fenceSalesRep,
                    data.paintingType,
                    data.paintingColor,
                    data.paintingBrand,
                    data.paintingFinish,
                    data.paintingAreaPainted,
                    data.paintingOwnerStatus,
                    data.paintingDate,
                    data.paintingWarrantyExp,
                    data.paintingSalesRep,
                    data.fpFirstName,
                    data.fpLastName,
                    data.fpPhoneNumber,
                    data.fpEmail,
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
                        gutterClientType, gutterInstallDate, gutterWarrantyExpiration,
                        referralFirstName, referralLastName, referralPhone, referralEmail,
                        roofSales, gutterSales,
                        fenceType, fenceMaterial, fenceHeight, fenceColor, fenceStyle,
                        fenceOwnerStatus, fenceInstallDate, fenceWarrantyExp, fenceSalesRep,
                        paintingType, paintingColor, paintingBrand, paintingFinish,
                        paintingAreaPainted, paintingOwnerStatus, paintingDate,
                        paintingWarrantyExp, paintingSalesRep,
                        fpFirstName, fpLastName, fpPhoneNumber, fpEmail
                    ) VALUES (${Array(86).fill('?').join(', ')})
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
                    data.gutterSize,
                    data.gutterColor,
                    data.gutterBrand,
                    data.gutterClientType,
                    data.gutterInstallDate,
                    data.gutterWarrantyExpiration,
                    data.referralFirstName,
                    data.referralLastName,
                    data.referralPhone,
                    data.referralEmail,
                    data.roofSales,
                    data.gutterSales,
                    data.fenceType,
                    data.fenceMaterial,
                    data.fenceHeight,
                    data.fenceColor,
                    data.fenceStyle,
                    data.fenceOwnerStatus,
                    data.fenceInstallDate,
                    data.fenceWarrantyExp,
                    data.fenceSalesRep,
                    data.paintingType,
                    data.paintingColor,
                    data.paintingBrand,
                    data.paintingFinish,
                    data.paintingAreaPainted,
                    data.paintingOwnerStatus,
                    data.paintingDate,
                    data.paintingWarrantyExp,
                    data.paintingSalesRep,
                    data.fpFirstName,
                    data.fpLastName,
                    data.fpPhoneNumber,
                    data.fpEmail
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

// Add a new endpoint specifically for updating referral fields
app.post('/api/update-fp-referral', (req, res) => {
  const data = req.body;
  console.log('Received referral data:', data);
  
  if (!data.recordId) {
    return res.json({ success: false, message: 'No record ID provided' });
  }
  
  // Direct SQL update for just the referral fields
  const updateSql = `
    UPDATE ClientProfile 
    SET fpFirstName = ?,
        fpLastName = ?,
        fpPhoneNumber = ?,
        fpEmail = ?
    WHERE rowid = ?
  `;
  
  const params = [
    data.fpFirstName || '',
    data.fpLastName || '',
    data.fpPhoneNumber || '',
    data.fpEmail || '',
    data.recordId
  ];
  
  db.run(updateSql, params, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.json({ success: false, message: err.message });
    }
    
    console.log(`Row ${data.recordId} updated with referral data`);
    return res.json({ success: true, message: 'Referral data updated successfully' });
  });
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
// API endpoint to upload media
app.post('/api/upload-media', upload.single('file'), (req, res) => {
  const { topic, mediaType, description, customerView, internalView, customerNumber } = req.body;
  const file = req.file;
  
  if (!file || !topic || !mediaType || !customerNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let tableName, columnName, descColumn, filenameColumn, customerViewColumn, internalViewColumn;
  
  switch(mediaType) {
    case 'Document':
      tableName = 'RGAdocs';
      columnName = `doc${topic}`;
      descColumn = `doc${topic}Desc`;
      filenameColumn = `doc${topic}Filename`;
      customerViewColumn = `doc${topic}CustomerView`;
      internalViewColumn = `doc${topic}InternalView`;
      break;
    case 'Image':
      tableName = 'RGAimages';
      columnName = `image${topic}`;
      descColumn = `image${topic}Desc`;
      filenameColumn = `image${topic}Filename`;
      customerViewColumn = `image${topic}CustomerView`;
      internalViewColumn = `image${topic}InternalView`;
      break;
    case 'Video':
      tableName = 'RGAvideos';
      columnName = `video${topic}`;
      descColumn = `video${topic}Desc`;
      filenameColumn = `video${topic}Filename`;
      customerViewColumn = `video${topic}CustomerView`;
      internalViewColumn = `video${topic}InternalView`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid media type' });
  }

  const custView = customerView === 'true' || customerView === '1' ? 1 : 0;
  const intView = internalView === 'true' || internalView === '1' ? 1 : 0;
  let originalFilename = file.originalname;
  
  // Check if a file with the same name already exists
  db.get(
    `SELECT ${filenameColumn} FROM ${tableName} WHERE customerNumber = ? AND ${filenameColumn} = ?`,
    [customerNumber, originalFilename],
    (err, row) => {
      if (err) {
        console.error(`Database error when checking for existing file:`, err);
        return res.status(500).json({ error: 'Database error when checking for existing file' });
      }
      
      // If a file with the same name exists, modify the filename
      if (row) {
        // Parse the filename to add a number
        const lastDotIndex = originalFilename.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex !== -1 ? originalFilename.substring(0, lastDotIndex) : originalFilename;
        const extension = lastDotIndex !== -1 ? originalFilename.substring(lastDotIndex) : '';
        
        // Function to check if a filename with a specific counter exists
        const checkFilenameWithCounter = (counter) => {
          return new Promise((resolve, reject) => {
            const newFilename = `${nameWithoutExt}(${counter})${extension}`;
            db.get(
              `SELECT ${filenameColumn} FROM ${tableName} WHERE customerNumber = ? AND ${filenameColumn} = ?`,
              [customerNumber, newFilename],
              (err, row) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({ exists: !!row, filename: newFilename });
                }
              }
            );
          });
        };
        
        // Find an available filename with counter
        const findAvailableFilename = async () => {
          let counter = 1;
          let result;
          
          do {
            try {
              result = await checkFilenameWithCounter(counter);
              if (!result.exists) {
                return result.filename;
              }
              counter++;
            } catch (err) {
              console.error('Error checking filename:', err);
              // If there's an error, return a default unique filename
              return `${nameWithoutExt}(${Date.now()})${extension}`;
            }
          } while (counter < 100); // Limit to prevent infinite loops
          
          // If we've tried 100 times, use timestamp to ensure uniqueness
          return `${nameWithoutExt}(${Date.now()})${extension}`;
        };
        
        // Find an available filename and then save the file
        findAvailableFilename().then(uniqueFilename => {
          originalFilename = uniqueFilename;
          saveFileToDatabase();
        }).catch(err => {
          console.error('Error finding unique filename:', err);
          return res.status(500).json({ error: 'Error finding unique filename' });
        });
      } else {
        // No duplicate, proceed with original filename
        saveFileToDatabase();
      }
    }
  );
  
  // Function to save the file to the database
  function saveFileToDatabase() {
    db.run(
      `INSERT OR REPLACE INTO ${tableName} (customerNumber, ${columnName}, ${descColumn}, ${filenameColumn}, ${customerViewColumn}, ${internalViewColumn}) VALUES (?, ?, ?, ?, ?, ?)`,
      [customerNumber, file.buffer, description, originalFilename, custView, intView],
      function(err) {
        if (err) {
          console.error(`Database error when uploading to ${tableName}:`, err);
          return res.status(500).json({ error: 'Database error when uploading media' });
        }
        
        res.json({ 
          success: true, 
          filename: originalFilename,
          message: originalFilename !== file.originalname ? 
            `File renamed to ${originalFilename} to avoid duplicate` : 
            'File uploaded successfully'
        });
      }
    );
  }
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

function logDatabaseWrites(query, params) {
  if (query.includes('UPDATE CompanyDataKeys') && query.includes('keys1Valid')) {
    console.log('LICENSE UPDATE DETECTED:');
    console.log('Query:', query);
    console.log('Params:', params);
    console.trace(); // Print stack trace to see where this is being called from
  }
}

// Apply this to all database write operations
const originalRun = masterDb.run;
masterDb.run = function(query, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }
  
  logDatabaseWrites(query, params);
  return originalRun.call(this, query, params, callback);
};
/*
masterDb.run(`UPDATE CompanyDataKeys SET 
  keys1Valid = 0, 
  keys2Valid = 0, 
  keys3Valid = 0,
  keys4Valid = 0, 
  keys5Valid = 0, 
  keys6Valid = 0 
  WHERE companyNumber = 'BCS331682'`, (err) => {
  if (err) {
    console.error('Error resetting validation fields:', err);
  } else {
    console.log('Validation fields reset to 0 for BCS331682');
  }
});
*/
// Route to validate company number and fetch license keys
app.post('/validate-company', (req, res) => {
    const { companyNumber } = req.body;
    
    if (!companyNumber) {
        return res.json({ valid: false, message: 'Company number is required' });
    }
    
    // Log the request for debugging
    console.log('Validating company number:', companyNumber);
    
    // First, get the license keys
    masterDb.get(
        `SELECT * FROM CompanyDataKeys WHERE companyNumber = ?`,
        [companyNumber],
        (err, keysRow) => {
            if (err) {
                console.error('Error querying CompanyDataKeys:', err.message);
                return res.json({ valid: false, message: 'Database error: ' + err.message });
            }
            
            if (!keysRow) {
                console.log('No company found with number:', companyNumber);
                return res.json({ valid: false, message: 'Invalid company number' });
            }
            
            // Now get the company profile data
            masterDb.get(
                `SELECT * FROM CompanyProfile WHERE companyNumber = ?`,
                [companyNumber],
                (err, profileRow) => {
                    if (err) {
                        console.error('Error querying CompanyProfile:', err.message);
                        return res.json({ valid: false, message: 'Database error: ' + err.message });
                    }
                    
                    // Combine the data
                    const combinedData = {
                        ...profileRow,
                        keys1Valid: keysRow.keys1Valid,
                        keys2Valid: keysRow.keys2Valid,
                        keys3Valid: keysRow.keys3Valid,
                        keys4Valid: keysRow.keys4Valid,
                        keys5Valid: keysRow.keys5Valid,
                        keys6Valid: keysRow.keys6Valid
                    };
                    
                    console.log('Combined company data:', combinedData);
                    
                    // Return all the data
                    return res.json({
                        valid: true,
                        companyData: combinedData,
                        companyNumber: companyNumber,
                        keys1Valid: keysRow.keys1Valid,
                        keys2Valid: keysRow.keys2Valid,
                        keys3Valid: keysRow.keys3Valid,
                        keys4Valid: keysRow.keys4Valid,
                        keys5Valid: keysRow.keys5Valid,
                        keys6Valid: keysRow.keys6Valid
                    });
                }
            );
        }
    );
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

// API endpoint to validate license keys
app.post('/api/validate-license', (req, res) => {
  const { companyNumber, licenseKey, licenseType } = req.body;
  
  if (!companyNumber || !licenseKey || !licenseType) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  
  console.log(`Validating license for company ${companyNumber}, type: ${licenseType}, key: ${licenseKey}`);
  
  // Map license type to the corresponding database fields
  const keyFieldMap = {
    'roof-gutter-attic': { keyField: 'customerKeys1', validField: 'keys1Valid' },
    'fencing-painting': { keyField: 'customerKeys2', validField: 'keys2Valid' },
    'plumbing-handyman': { keyField: 'customerKeys3', validField: 'keys3Valid' },
    'landscaping-pool': { keyField: 'customerKeys4', validField: 'keys4Valid' },
    'remodeling': { keyField: 'customerKeys5', validField: 'keys5Valid' },
    'tech-audio': { keyField: 'customerKeys6', validField: 'keys6Valid' }
  };
  
  const { keyField, validField } = keyFieldMap[licenseType] || {};
  
  if (!keyField || !validField) {
    return res.status(400).json({ success: false, error: 'Invalid license type' });
  }
  
  // Check if the license key matches what's in the database
  masterDb.get(
    `SELECT ${keyField} FROM CompanyDataKeys WHERE companyNumber = ?`,
    [companyNumber],
    (err, row) => {
      if (err) {
        console.error('Database error when validating license:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      // If company doesn't exist, create a new record with all validations set to 0
      if (!row) {
        console.log(`Company ${companyNumber} not found, creating new record`);
        
        // Create default record with ALL validation fields set to 0
        masterDb.run(
          `INSERT INTO CompanyDataKeys (
            companyNumber, 
            customerKeys1, customerKeys2, customerKeys3, customerKeys4, customerKeys5, customerKeys6,
            keys1Valid, keys2Valid, keys3Valid, keys4Valid, keys5Valid, keys6Valid
          ) VALUES (?, '', '', '', '', '', '', 0, 0, 0, 0, 0, 0)`,
          [companyNumber],
          function(insertErr) {
            if (insertErr) {
              console.error('Error creating company record:', insertErr);
              return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            // After creating record, proceed with validation
            validateLicenseKey(companyNumber, licenseKey, licenseType, keyField, validField, res);
          }
        );
        return;
      }
      
      // If company exists, proceed with validation
      validateLicenseKey(companyNumber, licenseKey, licenseType, keyField, validField, res, row[keyField]);
    }
  );
  
  // Helper function to validate license key and update database
  function validateLicenseKey(companyNumber, licenseKey, licenseType, keyField, validField, res, storedKey = '') {
    console.log(`Validating key: "${licenseKey}" against stored key: "${storedKey}"`);
    
    if (licenseKey === storedKey) {
      // License key is valid, update the validation field
      masterDb.run(
        `UPDATE CompanyDataKeys SET ${validField} = 1 WHERE companyNumber = ?`,
        [companyNumber],
        function(err) {
          if (err) {
            console.error('Database error when updating license validation:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
          }
          
          console.log(`License validated successfully for ${companyNumber}, ${licenseType}`);
          return res.json({ 
            success: true, 
            message: 'License key validated successfully' 
          });
        }
      );
    } else {
      console.log(`Invalid license key for ${companyNumber}, ${licenseType}`);
      return res.json({ 
        success: false, 
        error: 'Invalid license key' 
      });
    }
  }
});

// API endpoint to check if a company has access to a specific feature
app.get('/api/check-feature-access/:companyNumber/:feature', (req, res) => {
  const { companyNumber, feature } = req.params;
  
  if (!companyNumber || !feature) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }
  
  // Map feature to the corresponding validation field
  const featureFieldMap = {
    'roof-gutter-attic': 'keys1Valid',
    'fencing-painting': 'keys2Valid',
    'plumbing-handyman': 'keys3Valid',
    'landscaping-pool': 'keys4Valid',
    'remodeling': 'keys5Valid',
    'tech-audio': 'keys6Valid'
  };
  
  const validField = featureFieldMap[feature];
  
  if (!validField) {
    return res.status(400).json({ success: false, error: 'Invalid feature' });
  }
  
  // Check if the company has access to the feature
  masterDb.get(
    `SELECT ${validField} FROM CompanyDataKeys WHERE companyNumber = ?`,
    [companyNumber],
    (err, row) => {
      if (err) {
        console.error('Database error when checking feature access:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ success: false, error: 'Company not found' });
      }
      
      const hasAccess = row[validField] === 1;
      
      return res.json({ 
        success: true, 
        hasAccess: hasAccess 
      });
    }
  );
});


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
    
console.log(`Checking active keys for company: ${companyNumber}`);
    const query = `
        SELECT 
            keys1Valid, keys2Valid, keys3Valid,
            keys4Valid, keys5Valid, keys6Valid
        FROM CompanyDataKeys 
        WHERE companyNumber = ?
    `;
    
    masterDb.get(query, [companyNumber], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
  // Log the row data for debugging
        console.log('Database row:', row);
        const activeModules = [];
        
        if (Number(row.keys1Valid) === 1) activeModules.push('Roof/Gutter/Attic');
        if (Number(row.keys2Valid) === 1) activeModules.push('Fencing/Painting');
        if (Number(row.keys3Valid) === 1) activeModules.push('Plumbing/Handyman');
        if (Number(row.keys4Valid) === 1) activeModules.push('Landscaping/Pool Service');
        if (Number(row.keys5Valid) === 1) activeModules.push('Remodeling');
        if (Number(row.keys6Valid) === 1) activeModules.push('Tech/Audio');
        
        console.log('Active modules:', activeModules);
        
        res.json({ activeModules });
    });
});

app.get('/api/check-feature-access/:companyNumber/:featureType', (req, res) => {
    const { companyNumber, featureType } = req.params;
    
    if (!companyNumber || !featureType) {
        return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    
    const featureFieldMap = {
        'roof-gutter-attic': 'keys1Valid',
        'fencing-painting': 'keys2Valid',
        'plumbing-handyman': 'keys3Valid',
        'landscaping-pool': 'keys4Valid',
        'remodeling': 'keys5Valid',
        'tech-audio': 'keys6Valid'
    };
    
    const validField = featureFieldMap[featureType];
    
    if (!validField) {
        return res.status(400).json({ success: false, error: 'Invalid feature type' });
    }
    
    masterDb.get(
        `SELECT ${validField} FROM CompanyDataKeys WHERE companyNumber = ?`,
        [companyNumber],
        (err, row) => {
            if (err) {
                console.error('Database error when checking feature access:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (!row) {
                return res.status(404).json({ success: false, error: 'Company not found' });
            }
            
            const hasAccess = row[validField] === 1;
            
            return res.json({ 
                success: true, 
                hasAccess: hasAccess 
            });
        }
    );
});

// Route to validate company number and fetch license keys
app.post('/validate-company', (req, res) => {
    const { companyNumber } = req.body;
    
    if (!companyNumber) {
        return res.json({ valid: false, message: 'Company number is required' });
    }
    
    // Log the request for debugging
    console.log('Validating company number:', companyNumber);
    
    // Query the CompanyDataKeys table using the correct column names
    masterDb.get(
        `SELECT 
            companyNumber, 
            keys1Valid, 
            keys2Valid, 
            keys3Valid, 
            keys4Valid, 
            keys5Valid, 
            keys6Valid 
        FROM 
            CompanyDataKeys 
        WHERE 
            companyNumber = ?`,
        [companyNumber],
        (err, row) => {
            if (err) {
                console.error('Error querying database:', err.message);
                return res.json({ valid: false, message: 'Database error: ' + err.message });
            }
            
            if (!row) {
                console.log('No company found with number:', companyNumber);
                return res.json({ valid: false, message: 'Invalid company number' });
            }
            
            console.log('Found company data:', row);
            
            // Return the license keys with their correct column names
            return res.json({
                valid: true,
                companyNumber: row.companyNumber,
                keys1Valid: row.keys1Valid || '0',
                keys2Valid: row.keys2Valid || '0',
                keys3Valid: row.keys3Valid || '0',
                keys4Valid: row.keys4Valid || '0',
                keys5Valid: row.keys5Valid || '0',
                keys6Valid: row.keys6Valid || '0'
            });
        }
    );
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

app.delete('/api/delete-media/:mediaType/:category/:customerNumber/:filename', (req, res) => {
  const { mediaType, category, customerNumber, filename } = req.params;
  
  // Capitalize first letter of category
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

  // Database column configuration
  const mediaConfig = {
    Document: { table: 'RGAdocs', prefix: 'doc' },
    Image: { table: 'RGAimages', prefix: 'image' },
    Video: { table: 'RGAvideos', prefix: 'video' }
  };

  const config = mediaConfig[mediaType];
  if (!config) return res.status(400).json({ success: false, error: "Invalid media type" });

  // Use formatted category for column names
  const columnName = `${config.prefix}${formattedCategory}`;
  const filenameColumn = `${columnName}Filename`;
  const descColumn = `${columnName}Desc`;
  const customerViewColumn = `${columnName}CustomerView`;
  const internalViewColumn = `${columnName}InternalView`;

  // Update query to set all related columns to NULL where the customerNumber and filename match
  const query = `
    UPDATE ${config.table} 
    SET ${columnName} = NULL, 
        ${filenameColumn} = NULL, 
        ${descColumn} = NULL,
        ${customerViewColumn} = NULL,
        ${internalViewColumn} = NULL
    WHERE customerNumber = ? AND ${filenameColumn} = ?
  `;

  db.run(query, [customerNumber, filename], function(err) {
    if (err) {
      console.error(`Database error: ${err.message}`);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    res.json({ success: true });
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

db.run(`CREATE TABLE IF NOT EXISTS fpNotesLog (
    fpNoteId INTEGER PRIMARY KEY AUTOINCREMENT,
    fpStreetAddress TEXT NOT NULL,
    fpTimestamp TEXT NOT NULL,
    fpNote TEXT NOT NULL,
    fpAuthor TEXT,
    fpCreatedAt TEXT,
    fpCustomerNumber TEXT NOT NULL,
    FOREIGN KEY (fpStreetAddress) REFERENCES ClientProfile(streetAddress),
    FOREIGN KEY (fpCustomerNumber) REFERENCES ClientProfile(customerNumber)
)`)

// FP Notes endpoints
app.post('/api/fp-notes', (req, res) => {
    const { fpStreetAddress, fpNote, fpTimestamp, fpAuthor, fpCreatedAt, fpCustomerNumber } = req.body;
    console.log('Adding FP note:', { fpStreetAddress, fpNote, fpTimestamp, fpCustomerNumber });
    
    db.run(`INSERT INTO fpNotesLog (fpStreetAddress, fpNote, fpTimestamp, fpAuthor, fpCreatedAt, fpCustomerNumber) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        [fpStreetAddress, fpNote, fpTimestamp, fpAuthor || '', fpCreatedAt || new Date().toISOString(), fpCustomerNumber],
        (err) => {
            if (err) {
                console.error('Error saving FP note:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'FP Note saved successfully' });
        });
});

app.get('/api/fp-notes/:address', (req, res) => {
    const address = req.params.address;
    console.log('Fetching FP notes for address:', address);
    
    db.all(`SELECT * FROM fpNotesLog 
            WHERE fpStreetAddress = ? 
            ORDER BY fpTimestamp DESC`,
        [address],
        (err, rows) => {
            if (err) {
                console.error('Error fetching FP notes:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
});

// Modify the delete client endpoint to also delete FP notes
app.delete('/api/client/:id', (req, res) => {
    const recordId = req.params.id;
    
    // First get the street address to delete associated notes
    db.get('SELECT streetAddress, customerNumber FROM ClientProfile WHERE rowid = ?', [recordId], (err, row) => {
        if (err) {
            console.error('Error finding record:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        const streetAddress = row.streetAddress;
        const customerNumber = row.customerNumber;
        
        // Begin transaction
        db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
                console.error('Transaction error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Delete RGA notes associated with the address
            db.run('DELETE FROM NotesLog WHERE streetAddress = ?', [streetAddress], (err) => {
                if (err) {
                    console.error('Error deleting RGA notes:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                // Delete FP notes associated with the address
                db.run('DELETE FROM fpNotesLog WHERE fpStreetAddress = ?', [streetAddress], (err) => {
                    if (err) {
                        console.error('Error deleting FP notes:', err);
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
});

// Create fpDocs table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS fpDocs (
    customerNumber TEXT,
    docFence BLOB,
    docFenceDesc TEXT,
    docFenceFilename TEXT,
    docFenceCustomerView TEXT DEFAULT '0',
    docFenceInternalView TEXT DEFAULT '1',
    docPaint BLOB,
    docPaintDesc TEXT,
    docPaintFilename TEXT,
    docPaintCustomerView TEXT DEFAULT '0',
    docPaintInternalView TEXT DEFAULT '1'
)`);

// Create fpImages table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS fpImages (
    customerNumber TEXT,
    imageFence BLOB,
    imageFenceDesc TEXT,
    imageFenceFilename TEXT,
    imageFenceCustomerView TEXT DEFAULT '0',
    imageFenceInternalView TEXT DEFAULT '1',
    imagePaint BLOB,
    imagePaintDesc TEXT,
    imagePaintFilename TEXT,
    imagePaintCustomerView TEXT DEFAULT '0',
    imagePaintInternalView TEXT DEFAULT '1'
)`);

// Create fpVideos table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS fpVideos (
    customerNumber TEXT,
    videoFence BLOB,
    videoFenceDesc TEXT,
    videoFenceFilename TEXT,
    videoFenceCustomerView TEXT DEFAULT '0',
    videoFenceInternalView TEXT DEFAULT '1',
    videoPaint BLOB,
    videoPaintDesc TEXT,
    videoPaintFilename TEXT,
    videoPaintCustomerView TEXT DEFAULT '0',
    videoPaintInternalView TEXT DEFAULT '1'
)`);

// API endpoint to get customer FP documents
app.get('/api/fp-customer-docs/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  db.all(
    `SELECT customerNumber, 
            docFence as fenceDoc, docFenceDesc as fenceDesc, docFenceFilename as fenceFilename,
            docFenceCustomerView as fenceCustomerView, docFenceInternalView as fenceInternalView,
            docPaint as paintDoc, docPaintDesc as paintDesc, docPaintFilename as paintFilename,
            docPaintCustomerView as paintCustomerView, docPaintInternalView as paintInternalView
     FROM fpDocs 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, rows) => {
      if (err) {
        console.error('Database error when fetching FP docs:', err);
        return res.status(500).json({ error: 'Database error when fetching documents' });
      }

      const docs = [];
      
      rows.forEach(row => {
        if (row.fenceDoc) {
          docs.push({
            id: row.customerNumber + '_fence',
            category: 'Fence',
            filename: row.fenceFilename || 'Fence Document',
            description: row.fenceDesc || 'Fence Document',
            customerView: row.fenceCustomerView,
            internalView: row.fenceInternalView
          });
        }
        if (row.paintDoc) {
          docs.push({
            id: row.customerNumber + '_paint',
            category: 'Paint',
            filename: row.paintFilename || 'Paint Document',
            description: row.paintDesc || 'Paint Document',
            customerView: row.paintCustomerView,
            internalView: row.paintInternalView
          });
        }
      });

      return res.json({ docs });
    }
  );
});

// API endpoint to get customer FP images
app.get('/api/fp-customer-images/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  db.all(
    `SELECT customerNumber, 
            imageFence as fenceImage, imageFenceDesc as fenceDesc, imageFenceFilename as fenceFilename,
            imageFenceCustomerView as fenceCustomerView, imageFenceInternalView as fenceInternalView,
            imagePaint as paintImage, imagePaintDesc as paintDesc, imagePaintFilename as paintFilename,
            imagePaintCustomerView as paintCustomerView, imagePaintInternalView as paintInternalView
     FROM fpImages 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, rows) => {
      if (err) {
        console.error('Database error when fetching FP images:', err);
        return res.status(500).json({ error: 'Database error when fetching images' });
      }

      const images = [];
      
      rows.forEach(row => {
        if (row.fenceImage) {
          images.push({
            id: row.customerNumber + '_fence',
            category: 'Fence',
            filename: row.fenceFilename || 'Fence Image',
            description: row.fenceDesc || 'Fence Image',
            customerView: row.fenceCustomerView,
            internalView: row.fenceInternalView
          });
        }
        if (row.paintImage) {
          images.push({
            id: row.customerNumber + '_paint',
            category: 'Paint',
            filename: row.paintFilename || 'Paint Image',
            description: row.paintDesc || 'Paint Image',
            customerView: row.paintCustomerView,
            internalView: row.paintInternalView
          });
        }
      });

      return res.json({ images });
    }
  );
});

// API endpoint to get customer FP videos
app.get('/api/fp-customer-videos/:customerNumber', (req, res) => {
  const customerNumber = req.params.customerNumber;

  db.all(
    `SELECT customerNumber, 
            videoFence as fenceVideo, videoFenceDesc as fenceDesc, videoFenceFilename as fenceFilename,
            videoFenceCustomerView as fenceCustomerView, videoFenceInternalView as fenceInternalView,
            videoPaint as paintVideo, videoPaintDesc as paintDesc, videoPaintFilename as paintFilename,
            videoPaintCustomerView as paintCustomerView, videoPaintInternalView as paintInternalView
     FROM fpVideos 
     WHERE customerNumber = ?`,
    [customerNumber],
    (err, rows) => {
      if (err) {
        console.error('Database error when fetching FP videos:', err);
        return res.status(500).json({ error: 'Database error when fetching videos' });
      }

      const videos = [];
      
      rows.forEach(row => {
        if (row.fenceVideo) {
          videos.push({
            id: row.customerNumber + '_fence',
            category: 'Fence',
            filename: row.fenceFilename || 'Fence Video',
            description: row.fenceDesc || 'Fence Video',
            customerView: row.fenceCustomerView,
            internalView: row.fenceInternalView
          });
        }
        if (row.paintVideo) {
          videos.push({
            id: row.customerNumber + '_paint',
            category: 'Paint',
            filename: row.paintFilename || 'Paint Video',
            description: row.paintDesc || 'Paint Video',
            customerView: row.paintCustomerView,
            internalView: row.paintInternalView
          });
        }
      });

      return res.json({ videos });
    }
  );
});

// API endpoint to download FP media
app.get('/api/fp-download-media/:mediaType/:category/:customerNumber', (req, res) => {
  const { mediaType, category, customerNumber } = req.params;
  
  // Capitalize first letter of category
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

  // Database column configuration
  const mediaConfig = {
    Document: { table: 'fpDocs', prefix: 'doc', mime: 'application/pdf' },
    Image: { table: 'fpImages', prefix: 'image', mime: 'image/jpeg' },
    Video: { table: 'fpVideos', prefix: 'video', mime: 'video/mp4' }
  };

  const config = mediaConfig[mediaType];
  if (!config) return res.status(400).json({ error: "Invalid media type" });

  // Use formatted category for column names
  const columnName = `${config.prefix}${formattedCategory}`;
  const filenameColumn = `${columnName}Filename`;

  // Query to find the specific row with the document
  const query = `
    SELECT ${columnName} as fileData, ${filenameColumn} as filename 
    FROM ${config.table} 
    WHERE customerNumber = ? AND ${columnName} IS NOT NULL
    LIMIT 1
  `;

  db.get(
    query,
    [customerNumber],
    (err, row) => {
      if (err) {
        console.error(`Database error: ${err.message}`);
        return res.status(500).json({ error: "Database error" });
      }

      if (!row?.fileData) {
        return res.status(404).json({ error: "File not found" });
      }

      // Set proper MIME type
      res.setHeader('Content-Type', config.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${row.filename || formattedCategory}"`);
      res.send(Buffer.from(row.fileData));
    }
  );
});

// API endpoint to update FP file view settings
app.post('/api/fp-update-file-view', (req, res) => {
  const { mediaType, category, fileId, customerNumber, viewType, value, filename } = req.body;
  
  if (!mediaType || !category || !customerNumber || !viewType || !filename) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }
  
  // Determine the table and column names based on mediaType and category
  let tableName, viewColumn, filenameColumn;
  
  // Format category to ensure proper capitalization
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  
  switch(mediaType) {
    case 'Document':
      tableName = 'fpDocs';
      viewColumn = viewType === 'customer' ? `doc${formattedCategory}CustomerView` : `doc${formattedCategory}InternalView`;
      filenameColumn = `doc${formattedCategory}Filename`;
      break;
    case 'Image':
      tableName = 'fpImages';
      viewColumn = viewType === 'customer' ? `image${formattedCategory}CustomerView` : `image${formattedCategory}InternalView`;
      filenameColumn = `image${formattedCategory}Filename`;
      break;
    case 'Video':
      tableName = 'fpVideos';
      viewColumn = viewType === 'customer' ? `video${formattedCategory}CustomerView` : `video${formattedCategory}InternalView`;
      filenameColumn = `video${formattedCategory}Filename`;
      break;
    default:
      return res.status(400).json({ success: false, error: 'Invalid media type' });
  }
  
  // Update the database - using BOTH customerNumber AND filename to identify the correct row
  db.run(
    `UPDATE ${tableName} SET ${viewColumn} = ? WHERE customerNumber = ? AND ${filenameColumn} = ?`,
    [value, customerNumber, filename],
    function(err) {
      if (err) {
        console.error(`Database error updating view setting:`, err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      console.log(`Update result: ${this.changes} rows changed`);
      
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'File not found or no changes made' });
      }
      
      res.json({ success: true });
    }
  );
});

// API endpoint to upload FP media
app.post('/api/fp-upload-media', upload.single('file'), (req, res) => {
  const { topic, mediaType, description, customerView, internalView, customerNumber } = req.body;
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  if (!topic || !mediaType || !customerNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Format topic to ensure proper capitalization (Fence or Paint)
  const formattedTopic = topic.charAt(0).toUpperCase() + topic.slice(1).toLowerCase();
  
  // Determine table and column names based on mediaType and topic
  let tableName, dataColumn, descColumn, filenameColumn, customerViewColumn, internalViewColumn;
  
  switch(mediaType) {
    case 'Document':
      tableName = 'fpDocs';
      dataColumn = `doc${formattedTopic}`;
      descColumn = `doc${formattedTopic}Desc`;
      filenameColumn = `doc${formattedTopic}Filename`;
      customerViewColumn = `doc${formattedTopic}CustomerView`;
      internalViewColumn = `doc${formattedTopic}InternalView`;
      break;
    case 'Image':
      tableName = 'fpImages';
      dataColumn = `image${formattedTopic}`;
      descColumn = `image${formattedTopic}Desc`;
      filenameColumn = `image${formattedTopic}Filename`;
      customerViewColumn = `image${formattedTopic}CustomerView`;
      internalViewColumn = `image${formattedTopic}InternalView`;
      break;
    case 'Video':
      tableName = 'fpVideos';
      dataColumn = `video${formattedTopic}`;
      descColumn = `video${formattedTopic}Desc`;
      filenameColumn = `video${formattedTopic}Filename`;
      customerViewColumn = `video${formattedTopic}CustomerView`;
      internalViewColumn = `video${formattedTopic}InternalView`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid media type' });
  }
  
  // Check if a record already exists for this customer
  db.get(`SELECT customerNumber FROM ${tableName} WHERE customerNumber = ?`, [customerNumber], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (row) {
      // Update existing record
      const updateQuery = `UPDATE ${tableName} SET 
        ${dataColumn} = ?, 
        ${descColumn} = ?, 
        ${filenameColumn} = ?,
        ${customerViewColumn} = ?,
        ${internalViewColumn} = ?
        WHERE customerNumber = ?`;
      
      db.run(updateQuery, 
        [file.buffer, description, file.originalname, customerView, internalView, customerNumber],
        function(err) {
          if (err) {
            console.error('Error updating media:', err);
            return res.status(500).json({ error: 'Error updating media' });
          }
          
          res.json({ success: true, message: 'Media updated successfully' });
        }
      );
    } else {
      // Insert new record
      const columns = ['customerNumber', dataColumn, descColumn, filenameColumn, customerViewColumn, internalViewColumn];
      const placeholders = columns.map(() => '?').join(', ');
      
      const insertQuery = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      db.run(insertQuery,
        [customerNumber, file.buffer, description, file.originalname, customerView, internalView],
        function(err) {
          if (err) {
            console.error('Error saving media:', err);
            return res.status(500).json({ error: 'Error saving media' });
          }
          
          res.json({ success: true, message: 'Media saved successfully' });
        }
      );
    }
  });
});

// API endpoint to delete FP media
app.delete('/api/fp-delete-media/:mediaType/:category/:customerNumber/:filename', (req, res) => {
  const { mediaType, category, customerNumber, filename } = req.params;
  
  // Format category to ensure proper capitalization
  const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  
  // Determine table and column names based on mediaType and category
  let tableName, dataColumn, descColumn, filenameColumn, customerViewColumn, internalViewColumn;
  
  switch(mediaType) {
    case 'Document':
      tableName = 'fpDocs';
      dataColumn = `doc${formattedCategory}`;
      descColumn = `doc${formattedCategory}Desc`;
      filenameColumn = `doc${formattedCategory}Filename`;
      customerViewColumn = `doc${formattedCategory}CustomerView`;
      internalViewColumn = `doc${formattedCategory}InternalView`;
      break;
    case 'Image':
      tableName = 'fpImages';
      dataColumn = `image${formattedCategory}`;
      descColumn = `image${formattedCategory}Desc`;
      filenameColumn = `image${formattedCategory}Filename`;
      customerViewColumn = `image${formattedCategory}CustomerView`;
      internalViewColumn = `image${formattedCategory}InternalView`;
      break;
    case 'Video':
      tableName = 'fpVideos';
      dataColumn = `video${formattedCategory}`;
      descColumn = `video${formattedCategory}Desc`;
      filenameColumn = `video${formattedCategory}Filename`;
      customerViewColumn = `video${formattedCategory}CustomerView`;
      internalViewColumn = `video${formattedCategory}InternalView`;
      break;
    default:
      return res.status(400).json({ error: 'Invalid media type' });
  }
  
  // Update the record to clear the media fields
  const updateQuery = `UPDATE ${tableName} SET 
    ${dataColumn} = NULL, 
    ${descColumn} = NULL, 
    ${filenameColumn} = NULL,
    ${customerViewColumn} = '0',
    ${internalViewColumn} = '1'
    WHERE customerNumber = ? AND ${filenameColumn} = ?`;
  
  db.run(updateQuery, [customerNumber, filename], function(err) {
    if (err) {
      console.error('Error deleting media:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ success: true, message: 'Media deleted successfully' });
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});