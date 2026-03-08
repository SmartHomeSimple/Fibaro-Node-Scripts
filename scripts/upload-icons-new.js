#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const readline = require('readline');

// --- UI Enhancements ---
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        cyan: "\x1b[36m",
        magenta: "\x1b[35m",
        white: "\x1b[37m",
    }
};

const icons = {
    question: '❓',
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    upload: '📤',
    verify: '🔍',
    warning: '⚠️'
};

const projectRoot = process.cwd();
const iconsDir = path.join(projectRoot, '_icons');
const configPath = path.join(projectRoot, 'fibaro.config.json');
const iconConfigPath = path.join(iconsDir, '_config.json');

/**
 * Prompts the user for input.
 * @param {string} query The question to ask.
 * @returns {Promise<string>} The user's answer.
 */
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

/**
 * Makes an API request to the Fibaro Home Center.
 * @param {object} config - Fibaro connection configuration.
 * @param {string} method - HTTP method.
 * @param {string} apiPath - The API endpoint path.
 * @param {Buffer|string} [data] - The data to send.
 * @param {string} [contentType] - The content type of the request.
 * @returns {Promise<any>} A promise that resolves with the response data.
 */
function fibaroRequest(config, method, apiPath, data, contentType = 'application/json') {
    return new Promise((resolve, reject) => {
        const { host, username, password, protocol } = config;
        const lib = protocol === 'https' ? https : http;
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

        const options = {
            hostname: host,
            path: apiPath,
            method: method,
            headers: {
                'Authorization': auth,
                'Content-Type': contentType,
                'X-Fibaro-Version': 2,
            },
            rejectUnauthorized: false
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = lib.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(responseBody ? JSON.parse(responseBody) : {});
                    } else {
                        const error = new Error(`Fibaro API Error: ${res.statusCode} ${res.statusMessage}\n${responseBody}`);
                        error.responseBody = responseBody;
                        reject(error);
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse JSON response: ${error.message}\nResponse: ${responseBody}`));
                }
            });
        });

        req.on('error', (error) => reject(new Error(`Request failed: ${error.message}`)));
        if (data) {
            req.write(data);
        }
        req.end();
    });
}

/**
 * Gets the list of all uploaded icons from Fibaro HC.
 * @param {object} config - Fibaro connection configuration.
 * @returns {Promise<Array>} Array of icon objects.
 */
async function getUploadedIcons(config) {
    return new Promise((resolve, reject) => {
        const { host, username, password, protocol } = config;
        const lib = protocol === 'https' ? https : http;
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        const apiPath = '/api/icons?deviceType=com.fibaro.genericDevice';

        const options = {
            hostname: host,
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': auth,
            },
            rejectUnauthorized: false
        };

        const req = lib.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed || []);
                    } catch (error) {
                        reject(new Error(`Failed to parse icons response: ${error.message}`));
                    }
                } else {
                    const error = new Error(`Fibaro API Error: ${res.statusCode} ${res.statusMessage}`);
                    error.responseBody = responseBody;
                    reject(error);
                }
            });
        });

        req.on('error', (error) => reject(new Error(`Request failed: ${error.message}`)));
        req.end();
    });
}

/**
 * Gets all devices from Fibaro HC.
 * @param {object} config - Fibaro connection configuration.
 * @returns {Promise<Array>} Array of device objects.
 */
async function getAllDevices(config) {
    return new Promise((resolve, reject) => {
        const { host, username, password, protocol } = config;
        const lib = protocol === 'https' ? https : http;
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        const apiPath = '/api/devices';

        const options = {
            hostname: host,
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': auth,
            },
            rejectUnauthorized: false
        };

        const req = lib.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed || []);
                    } catch (error) {
                        reject(new Error(`Failed to parse devices response: ${error.message}`));
                    }
                } else {
                    const error = new Error(`Fibaro API Error: ${res.statusCode} ${res.statusMessage}`);
                    error.responseBody = responseBody;
                    reject(error);
                }
            });
        });

        req.on('error', (error) => reject(new Error(`Request failed: ${error.message}`)));
        req.end();
    });
}

/**
 * Updates a device's icon.
 * @param {object} config - Fibaro connection configuration.
 * @param {number} deviceId - The device ID.
 * @param {number} iconId - The icon ID to set.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function updateDeviceIcon(config, deviceId, iconId) {
    return new Promise((resolve, reject) => {
        const { host, username, password, protocol } = config;
        const lib = protocol === 'https' ? https : http;
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        const apiPath = `/api/devices/${deviceId}`;
        const payload = JSON.stringify({ properties: { deviceIcon: iconId } });

        const fullUrl = `${protocol}://${host}${apiPath}`;
        console.log(`${colors.dim}[DEBUG] PUT ${fullUrl}${colors.reset}`);
        console.log(`${colors.dim}[DEBUG] Payload: ${payload}${colors.reset}`);

        const options = {
            hostname: host,
            path: apiPath,
            method: 'PUT',
            headers: {
                'Authorization': auth,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
            rejectUnauthorized: false
        };

        const req = lib.request(options, (res) => {
            let responseBody = '';
            console.log(`${colors.dim}[DEBUG] Response Status: ${res.statusCode}${colors.reset}`);
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                console.log(`${colors.dim}[DEBUG] Response Body: ${responseBody.substring(0, 200)}${colors.reset}`);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    const error = new Error(`Failed to update device icon: ${res.statusCode} ${res.statusMessage}`);
                    error.responseBody = responseBody;
                    reject(error);
                }
            });
        });

        req.on('error', (error) => reject(new Error(`Request failed: ${error.message}`)));
        req.write(payload);
        req.end();
    });
}

/**
 * Downloads an icon from Fibaro HC for verification.
 * @param {object} config - Fibaro connection configuration.
 * @param {string} iconSetName - The icon set name.
 * @param {string} fileExtension - The file extension.
 * @returns {Promise<Buffer|null>} The icon content or null on failure.
 */
async function downloadIcon(config, iconSetName, fileExtension) {
    return new Promise((resolve, reject) => {
        const { host, username, password, protocol } = config;
        const lib = protocol === 'https' ? https : http;
        const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        const iconPath = `/assets/userIcons/devices/${iconSetName}/${iconSetName}.${fileExtension}`;

        const options = {
            hostname: host,
            path: iconPath,
            method: 'GET',
            headers: {
                'Authorization': auth,
            },
            rejectUnauthorized: false
        };

        const req = lib.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => { chunks.push(chunk); });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(Buffer.concat(chunks));
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.end();
    });
}

/**
 * Checks if an icon with the same content already exists.
 * @param {object} config - Fibaro connection configuration.
 * @param {Buffer} fileContent - The content of the icon to check.
 * @param {string} fileExtension - The file extension.
 * @returns {Promise<object|null>} The existing icon object or null if not found.
 */
async function findDuplicateIcon(config, fileContent, fileExtension) {
    const uploadedIcons = await getUploadedIcons(config);
    const matchingExtIcons = uploadedIcons.filter(icon => icon.fileExtension === fileExtension);

    for (const icon of matchingExtIcons) {
        const existingContent = await downloadIcon(config, icon.iconSetName, icon.fileExtension);
        if (existingContent && existingContent.equals(fileContent)) {
            return icon;
        }
    }
    return null;
}

/**
 * Uploads a single icon file to Fibaro HC.
 * @param {object} config - Fibaro connection configuration.
 * @param {string} iconFilePath - Path to the icon file.
 * @param {string} iconFileName - Name of the icon file.
 * @param {boolean} checkDuplicates - Whether to check for duplicates before uploading.
 * @returns {Promise<object|null>} The upload response or null on failure.
 */
async function uploadIcon(config, iconFilePath, iconFileName, checkDuplicates = true) {
    try {
        const fileContent = fs.readFileSync(iconFilePath);
        const fileExtension = path.extname(iconFileName).substring(1);

        // Check for duplicates before uploading
        if (checkDuplicates) {
            const duplicate = await findDuplicateIcon(config, fileContent, fileExtension);
            if (duplicate) {
                console.log(`    ${icons.info} ${colors.fg.yellow}Duplicate found:${colors.reset} Icon already exists with ID ${duplicate.id} (${duplicate.iconSetName})`);
                return { id: duplicate.id, isDuplicate: true, iconSetName: duplicate.iconSetName };
            }
        }

        const boundary = `----WebKitFormBoundary${Math.random().toString(16).substr(2)}`;
        const body = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="type"',
            '',
            'device',
            `--${boundary}`,
            'Content-Disposition: form-data; name="deviceTemplate"',
            '',
            'com.fibaro.genericDevice',
            `--${boundary}`,
            `Content-Disposition: form-data; name="icon"; filename="${iconFileName}"`,
            `Content-Type: image/${fileExtension === 'svg' ? 'svg+xml' : fileExtension}`,
            '',
        ].join('\r\n');

        const middleBoundary = `\r\n--${boundary}\r\n`;
        const fileExtensionPart = [
            'Content-Disposition: form-data; name="fileExtension"',
            '',
            fileExtension,
        ].join('\r\n');

        const endBoundary = `\r\n--${boundary}--\r\n`;
        const fullBody = Buffer.concat([
            Buffer.from(body + '\r\n'),
            fileContent,
            Buffer.from(middleBoundary),
            Buffer.from(fileExtensionPart),
            Buffer.from(endBoundary)
        ]);

        const response = await fibaroRequest(
            config,
            'POST',
            '/api/icons',
            fullBody,
            `multipart/form-data; boundary=${boundary}`
        );

        if (response) {
            response.fileContent = fileContent;
            response.fileExtension = fileExtension;
        }

        return response;
    } catch (error) {
        console.error(`    ${icons.error} Upload failed: ${error.message}`);
        if (error.responseBody) {
            console.error(`    ${colors.dim}Response: ${error.responseBody}${colors.reset}`);
        }
        return null;
    }
}

/**
 * Verifies if an icon was uploaded successfully by downloading and comparing content.
 * @param {object} config - Fibaro connection configuration.
 * @param {number} iconId - The icon ID to verify.
 * @param {Buffer} originalContent - The original file content.
 * @param {string} fileExtension - The file extension.
 * @returns {Promise<boolean>} True if verified, false otherwise.
 */
async function verifyIconUpload(config, iconId, originalContent, fileExtension) {
    try {
        const uploadedIcons = await getUploadedIcons(config);
        const foundIcon = uploadedIcons.find(icon => icon.id === iconId);

        if (!foundIcon) {
            console.log(`    ${icons.warning} ${colors.fg.yellow}Warning:${colors.reset} Icon ID ${iconId} not found in icon list`);
            return false;
        }

        // Download the icon and compare content
        const downloadedContent = await downloadIcon(config, foundIcon.iconSetName, foundIcon.fileExtension);

        if (!downloadedContent) {
            console.log(`    ${icons.warning} ${colors.fg.yellow}Warning:${colors.reset} Could not download icon for verification`);
            return false;
        }

        const contentMatch = downloadedContent.equals(originalContent);

        if (contentMatch) {
            console.log(`    ${icons.verify} ${colors.fg.green}Verified:${colors.reset} Icon ID ${iconId} (${foundIcon.iconSetName}) - Content matches`);
            return true;
        } else {
            console.log(`    ${icons.warning} ${colors.fg.yellow}Warning:${colors.reset} Icon exists but content doesn't match`);
            return false;
        }
    } catch (error) {
        console.error(`    ${icons.error} Verification failed: ${error.message}`);
        return false;
    }
}

/**
 * Main function to upload icons from the _icons folder.
 */
async function uploadIconsFromFolder() {
    console.log(`\n${colors.bright}${colors.fg.cyan}=== Fibaro Icon Uploader ===${colors.reset}\n`);

    // Check if config exists
    if (!fs.existsSync(configPath)) {
        console.error(`${icons.error} Error: Configuration file not found at ${colors.fg.yellow}${configPath}${colors.reset}`);
        return;
    }

    // Load config
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.host || !config.username || !config.password) {
            console.error(`${icons.error} Error: fibaro.config.json is incomplete.`);
            return;
        }
        console.log(`${icons.info} Connected to: ${colors.fg.cyan}${config.host}${colors.reset}\n`);
    } catch (error) {
        console.error(`${icons.error} Error parsing fibaro.config.json: ${error.message}`);
        return;
    }

    // Check if _icons directory exists
    if (!fs.existsSync(iconsDir)) {
        console.error(`${icons.error} Error: Icons directory not found at ${colors.fg.yellow}${iconsDir}${colors.reset}`);
        return;
    }

    // Get all icon files (svg, png, jpg, jpeg)
    const iconFiles = fs.readdirSync(iconsDir)
        .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.svg', '.png', '.jpg', '.jpeg'].includes(ext);
        });

    if (iconFiles.length === 0) {
        console.log(`${icons.info} No icon files found in ${colors.fg.yellow}${iconsDir}${colors.reset}`);
        console.log(`${colors.dim}Supported formats: .svg, .png, .jpg, .jpeg${colors.reset}`);
        return;
    }

    console.log(`${icons.info} Found ${colors.bright}${iconFiles.length}${colors.reset} icon file(s) in ${colors.fg.yellow}_icons${colors.reset} folder:\n`);
    iconFiles.forEach((file, index) => {
        const filePath = path.join(iconsDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`  ${colors.bright}${index + 1}.${colors.reset} ${colors.fg.cyan}${file}${colors.reset} ${colors.dim}(${sizeKB} KB)${colors.reset}`);
    });

    // Ask user what to do
    console.log(`\n${colors.bright}Options:${colors.reset}`);
    console.log(`  ${colors.bright}1.${colors.reset} Upload all icons`);
    console.log(`  ${colors.bright}2.${colors.reset} Upload specific icon`);
    console.log(`  ${colors.bright}3.${colors.reset} List uploaded icons (verify only)`);
    console.log(`  ${colors.bright}4.${colors.reset} Exit\n`);

    const choice = await askQuestion(`${icons.question} Enter your choice (1-4): `);

    switch (choice) {
        case '1':
            await uploadAllIcons(config, iconFiles);
            break;
        case '2':
            await uploadSpecificIcon(config, iconFiles);
            break;
        case '3':
            await listUploadedIcons(config);
            break;
        case '4':
            console.log(`${icons.info} Exiting...`);
            return;
        default:
            console.log(`${icons.error} Invalid choice. Exiting.`);
            return;
    }
}

/**
 * Uploads all icons from the _icons folder.
 * @param {object} config - Fibaro connection configuration.
 * @param {Array<string>} iconFiles - Array of icon file names.
 */
async function uploadAllIcons(config, iconFiles) {
    console.log(`\n${colors.bright}${icons.upload} Starting bulk upload...${colors.reset}\n`);

    const results = {
        success: [],
        failed: [],
        verified: []
    };

    for (let i = 0; i < iconFiles.length; i++) {
        const file = iconFiles[i];
        const filePath = path.join(iconsDir, file);

        console.log(`[${i + 1}/${iconFiles.length}] Uploading ${colors.fg.cyan}${file}${colors.reset}...`);

        const response = await uploadIcon(config, filePath, file);

        if (response && response.id) {
            if (response.isDuplicate) {
                console.log(`    ${icons.info} ${colors.fg.yellow}Skipped (duplicate)${colors.reset} - Icon ID: ${colors.bright}${response.id}${colors.reset}`);
                results.success.push({ file, id: response.id, isDuplicate: true });
            } else {
                console.log(`    ${icons.success} ${colors.fg.green}Success!${colors.reset} Icon ID: ${colors.bright}${response.id}${colors.reset}`);
                results.success.push({ file, id: response.id });

                // Verify the upload
                const verified = await verifyIconUpload(config, response.id, response.fileContent, response.fileExtension);
                if (verified) {
                    results.verified.push({ file, id: response.id });
                }
            }
        } else {
            console.log(`    ${icons.error} ${colors.fg.red}Failed${colors.reset}`);
            results.failed.push(file);
        }

        console.log(''); // Empty line for readability
    }

    // Summary
    console.log(`\n${colors.bright}${colors.fg.cyan}=== Upload Summary ===${colors.reset}\n`);
    console.log(`${icons.success} Successfully uploaded: ${colors.fg.green}${results.success.length}${colors.reset}`);
    console.log(`${icons.verify} Verified: ${colors.fg.green}${results.verified.length}${colors.reset}`);
    console.log(`${icons.error} Failed: ${colors.fg.red}${results.failed.length}${colors.reset}\n`);

    if (results.success.length > 0) {
        console.log(`${colors.bright}Uploaded Icons:${colors.reset}`);
        results.success.forEach(({ file, id }) => {
            const verifiedMark = results.verified.some(v => v.id === id) ? icons.verify : icons.warning;
            console.log(`  ${verifiedMark} ${file} → ID: ${colors.bright}${id}${colors.reset}`);
        });
        console.log('');
    }

    if (results.failed.length > 0) {
        console.log(`${colors.bright}Failed Uploads:${colors.reset}`);
        results.failed.forEach(file => {
            console.log(`  ${icons.error} ${file}`);
        });
        console.log('');
    }

    // Ask if user wants to assign icons to devices
    if (results.success.length > 0) {
        const assignChoice = await askQuestion(`\n${icons.question} Do you want to assign these icons to devices now? (y/n): `);
        if (assignChoice.toLowerCase() === 'y' || assignChoice.toLowerCase() === 'yes') {
            await assignUploadedIconsToDevices(config, results.success);
        }
    }
}

/**
 * Uploads a specific icon selected by the user.
 * @param {object} config - Fibaro connection configuration.
 * @param {Array<string>} iconFiles - Array of icon file names.
 */
async function uploadSpecificIcon(config, iconFiles) {
    let selectedIndex;
    while (true) {
        const answer = await askQuestion(`\n${icons.question} Enter the number of the icon to upload (1-${iconFiles.length}): `);
        selectedIndex = parseInt(answer, 10) - 1;
        if (selectedIndex >= 0 && selectedIndex < iconFiles.length) {
            break;
        }
        console.log(`${colors.fg.red}Invalid selection. Please enter a number between 1 and ${iconFiles.length}.${colors.reset}`);
    }

    const file = iconFiles[selectedIndex];
    const filePath = path.join(iconsDir, file);

    console.log(`\n${icons.upload} Uploading ${colors.fg.cyan}${file}${colors.reset}...\n`);

    const response = await uploadIcon(config, filePath, file);

    if (response && response.id) {
        if (response.isDuplicate) {
            console.log(`${icons.info} ${colors.fg.yellow}Duplicate detected!${colors.reset} This icon already exists with ID: ${colors.bright}${response.id}${colors.reset} (${response.iconSetName})\n`);
        } else {
            console.log(`${icons.success} ${colors.fg.green}Success!${colors.reset} Icon uploaded with ID: ${colors.bright}${response.id}${colors.reset}\n`);

            // Verify the upload
            await verifyIconUpload(config, response.id, response.fileContent, response.fileExtension);
        }

        console.log(`\n${icons.info} You can use this icon ID in your Quick App's ${colors.fg.yellow}quickapp.json${colors.reset} file.`);
    } else {
        console.log(`${icons.error} ${colors.fg.red}Failed to upload icon.${colors.reset}`);
    }
}

/**
 * Lists all icons currently uploaded to Fibaro HC.
 * @param {object} config - Fibaro connection configuration.
 */
async function listUploadedIcons(config) {
    console.log(`\n${icons.verify} Fetching uploaded icons from Fibaro HC...\n`);

    const uploadedIcons = await getUploadedIcons(config);

    if (uploadedIcons.length === 0) {
        console.log(`${icons.info} No icons found or unable to retrieve icon list.`);
        return;
    }

    console.log(`${colors.bright}${colors.fg.cyan}=== Uploaded Icons (${uploadedIcons.length}) ===${colors.reset}\n`);

    uploadedIcons.forEach((icon, index) => {
        console.log(`${colors.bright}${index + 1}.${colors.reset} ID: ${colors.bright}${icon.id}${colors.reset}`);
        if (icon.iconSetName) {
            console.log(`   Name: ${colors.fg.cyan}${icon.iconSetName}${colors.reset}`);
        }
        if (icon.deviceType) {
            console.log(`   Device Type: ${icon.deviceType}`);
        }
        if (icon.fileExtension) {
            console.log(`   Extension: ${icon.fileExtension}`);
            const iconUrl = `${config.protocol}://${config.host}/assets/userIcons/devices/${icon.iconSetName}/${icon.iconSetName}.${icon.fileExtension}`;
            console.log(`   URL: ${colors.dim}${iconUrl}${colors.reset}`);
        }
        console.log('');
    });
}

/**
 * Assigns uploaded icons to devices based on _config.json mappings.
 * @param {object} config - Fibaro connection configuration.
 * @param {Array} uploadedIcons - Array of {file, id} objects from upload results.
 */
async function assignUploadedIconsToDevices(config, uploadedIcons) {
    console.log(`\n${icons.info} Loading icon configuration...\n`);

    // Load icon config
    if (!fs.existsSync(iconConfigPath)) {
        console.error(`${icons.error} Error: Icon configuration file not found at ${colors.fg.yellow}${iconConfigPath}${colors.reset}`);
        return;
    }

    let iconConfig;
    try {
        iconConfig = JSON.parse(fs.readFileSync(iconConfigPath, 'utf-8'));
    } catch (error) {
        console.error(`${icons.error} Error parsing _config.json: ${error.message}`);
        return;
    }

    // Get all devices
    console.log(`${icons.info} Fetching devices from Fibaro HC...\n`);
    let devices;
    try {
        devices = await getAllDevices(config);
    } catch (error) {
        console.error(`${icons.error} Failed to fetch devices: ${error.message}`);
        return;
    }

    // Build icon filename to ID map from uploaded icons
    const iconMap = {};
    uploadedIcons.forEach(({ file, id }) => {
        iconMap[file] = id;
    });

    console.log(`${colors.bright}${colors.fg.cyan}=== Assigning Icons to Devices ===${colors.reset}\n`);

    const results = {
        success: [],
        failed: [],
        notFound: []
    };

    for (const mapping of iconConfig) {
        const { deviceName, iconPath } = mapping;
        const iconFileName = path.basename(iconPath);

        // Skip if this icon wasn't in the uploaded batch
        if (!iconMap[iconFileName]) {
            continue;
        }

        console.log(`Processing: ${colors.fg.cyan}${deviceName}${colors.reset}`);

        // Find device by name
        const device = devices.find(d => d.name === deviceName);
        if (!device) {
            console.log(`    ${icons.warning} ${colors.fg.yellow}Device not found${colors.reset}`);
            results.notFound.push(deviceName);
            console.log('');
            continue;
        }

        const iconId = iconMap[iconFileName];

        // Update device icon
        try {
            await updateDeviceIcon(config, device.id, iconId);
            console.log(`    ${icons.success} ${colors.fg.green}Success!${colors.reset} Set icon ${iconId} for device ${device.id}`);
            results.success.push({ device: deviceName, deviceId: device.id, iconId });
        } catch (error) {
            console.log(`    ${icons.error} ${colors.fg.red}Failed:${colors.reset} ${error.message}`);
            results.failed.push(deviceName);
        }

        console.log('');
    }

    // Summary
    console.log(`\n${colors.bright}${colors.fg.cyan}=== Assignment Summary ===${colors.reset}\n`);
    console.log(`${icons.success} Successfully assigned: ${colors.fg.green}${results.success.length}${colors.reset}`);
    console.log(`${icons.warning} Not found: ${colors.fg.yellow}${results.notFound.length}${colors.reset}`);
    console.log(`${icons.error} Failed: ${colors.fg.red}${results.failed.length}${colors.reset}\n`);

    if (results.success.length > 0) {
        console.log(`${colors.bright}Assigned Devices:${colors.reset}`);
        results.success.forEach(({ device, deviceId, iconId }) => {
            console.log(`  ${icons.success} ${device} (ID: ${deviceId}) → Icon: ${iconId}`);
        });
        console.log('');
    }

    if (results.notFound.length > 0) {
        console.log(`${colors.bright}Devices Not Found:${colors.reset}`);
        results.notFound.forEach(item => {
            console.log(`  ${icons.warning} ${item}`);
        });
        console.log('');
    }

    if (results.failed.length > 0) {
        console.log(`${colors.bright}Failed Assignments:${colors.reset}`);
        results.failed.forEach(device => {
            console.log(`  ${icons.error} ${device}`);
        });
        console.log('');
    }
}

// Run the script
uploadIconsFromFolder();
