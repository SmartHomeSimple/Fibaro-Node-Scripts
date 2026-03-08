#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const readline = require('readline'); // Import readline for interactive input

// --- UI Enhancements ---
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
    }
};

const icons = {
    question: '❓',
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    upload: '🚀'
};
const projectRoot = path.join(__dirname, '..');
const unpackedDir = path.join(projectRoot, '_unpacked');
const configPath = path.join(projectRoot, 'fibaro.config.json');

/**
 * Prompts the user for input and returns a Promise that resolves with the answer.
 * @param {string} query The question to ask the user.
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
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {string} apiPath - The API endpoint path.
 * @param {object} [data] - The data to send in the request body.
 * @returns {Promise<any>} A promise that resolves with the response data.
 */
function fibaroRequest(config, method, apiPath, data) {
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
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false // Use this if your HC3 has a self-signed certificate
        };

        const req = lib.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(responseBody ? JSON.parse(responseBody) : {});
                    } else {
                        const error = new Error(`Fibaro API Error: ${res.statusCode} ${res.statusMessage}\n${responseBody}`);
                        error.responseBody = responseBody; // Attach response body for more context
                        reject(error);
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse JSON response: ${error.message}\nResponse: ${responseBody}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Finds a Quick App device ID by its name.
 * @param {object} config - Fibaro connection configuration.
 * @param {string} quickAppName - The name of the Quick App to find.
 * @returns {Promise<number|null>} The device ID or null if not found.
 */
async function findQuickAppIdByName(config, quickAppName) {
    console.log(`🔍 Searching for Quick App with name: "${colors.fg.cyan}${quickAppName}${colors.reset}" on Fibaro...`);
    try {
        const devices = await fibaroRequest(config, 'GET', '/api/devices');

        const quickApp = devices.find(d => d.isPlugin && d.name === quickAppName);
        if (quickApp) {
            console.log(`  ${icons.success} Found device with ID: ${colors.fg.green}${quickApp.id}${colors.reset}`);
            return quickApp.id;
        }
        console.log(`  -> Quick App "${quickAppName}" not found by name.\n`);
        return null;
    } catch (error) {
        console.error(`  -> Error searching for Quick App by name: ${error.message}`);
        return null;
    }
}

/**
 * Uploads a Quick App to the Fibaro Home Center.
 */
async function upload() {
    const quickAppNameFromArg = process.argv[2];

    if (!fs.existsSync(configPath)) {
        console.error(`${icons.error} Error: Configuration file not found at ${colors.fg.yellow}${configPath}${colors.reset}`);
        console.error(`  ${icons.info} Please create a fibaro.config.json file.`);
        return;
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.host || !config.username || !config.password) {
            console.error(`${icons.error} Error: fibaro.config.json is incomplete. Please provide host, username, and password.`);
            return;
        }
    } catch (error) {
        console.error(`${icons.error} Error parsing fibaro.config.json: ${error.message}`);
        return;
    }

    let quickAppName;

    try {
        // 1. List available Quick Apps from _unpacked folder
        const availableQuickApps = fs.readdirSync(unpackedDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .filter(dirent => fs.existsSync(path.join(unpackedDir, dirent.name, 'quickapp.json')))
            .map(dirent => dirent.name);

        if (availableQuickApps.length === 0) {
            console.error(`${icons.error} No Quick Apps found in the '${colors.fg.yellow}${unpackedDir}${colors.reset}' directory.`);
            console.error(`  ${icons.info} Please ensure you have unpacked Quick Apps there (e.g., by running "npm run unpack").`);
            return;
        }

        if (quickAppNameFromArg) {
            if (!availableQuickApps.includes(quickAppNameFromArg)) {
                console.error(`${icons.error} Error: Quick App "${quickAppNameFromArg}" not found in ${unpackedDir}.`);
                return;
            }
            quickAppName = quickAppNameFromArg;
        } else {
            console.log(`\n${icons.upload} Available Quick Apps to upload:`);
            availableQuickApps.forEach((qaName, index) => {
                console.log(`  ${colors.bright}${index + 1}.${colors.reset} ${colors.fg.cyan}${qaName}${colors.reset}`);
            });

            let selectedIndex;
            while (true) {
                const answer = await askQuestion(`\n${icons.question} Enter the number of the Quick App to upload (1-${availableQuickApps.length}): `);
                selectedIndex = parseInt(answer, 10) - 1;
                if (selectedIndex >= 0 && selectedIndex < availableQuickApps.length) {
                    break;
                }
                console.log(`${colors.fg.red}Invalid selection. Please enter a number within the range.${colors.reset}`);
            }
            quickAppName = availableQuickApps[selectedIndex];
        }

        const quickAppPath = path.join(unpackedDir, quickAppName);
        console.log(`You selected: "${quickAppName}"\n`);

        // 2. Read quickapp.json and construct the file payload
        const quickAppJsonPath = path.join(quickAppPath, 'quickapp.json');
        const quickAppJson = JSON.parse(fs.readFileSync(quickAppJsonPath, 'utf-8'));

        let deviceId = await findQuickAppIdByName(config, quickAppJson.name);

        let filesToUpload = [];
        for (const fileMeta of (quickAppJson._files || [])) {
            const luaFilePath = path.join(quickAppPath, `${fileMeta.name}.lua`);
            if (!fs.existsSync(luaFilePath)) {
                console.warn(`  -> ${colors.fg.yellow}Warning: File not found, skipping: ${luaFilePath}${colors.reset}`);
                continue;
            }
            const content = fs.readFileSync(luaFilePath, 'utf-8');
            filesToUpload.push({ ...fileMeta, content: content.replace(/\r\n/g, '\n') });
        }

        if (!deviceId) {
            if (quickAppNameFromArg) {
                console.log(`  -> Quick App not found. Creating a new one as we are in watch mode.`);
                // --- Create new Quick App ---
                console.log(`\n${colors.fg.magenta}Creating new Quick App: "${quickAppJson.name}"...${colors.reset}`);
                const fqaData = { ...quickAppJson, files: filesToUpload };
                delete fqaData._files; // Clean up internal property

                const newDevice = await fibaroRequest(config, 'POST', '/api/quickApp', fqaData);
                console.log(`\n${icons.success} Quick App created successfully with ID: ${colors.fg.green}${newDevice.id}${colors.reset}`);
                // No need to restart, creation implies it's running.
                return; // Exit after creation
            } else {
                const answer = await askQuestion(`${icons.question} Quick App "${quickAppJson.name}" not found on Fibaro. Enter its ID to update, or 'N' to create a new one: `);
                if (answer.toLowerCase() === 'n') {
                    // --- Create new Quick App ---
                    console.log(`\n${colors.fg.magenta}Creating new Quick App: "${quickAppJson.name}"...${colors.reset}`);
                    const fqaData = { ...quickAppJson, files: filesToUpload };
                    delete fqaData._files; // Clean up internal property

                    const newDevice = await fibaroRequest(config, 'POST', '/api/quickApp', fqaData);
                    console.log(`\n${icons.success} Quick App created successfully with ID: ${colors.fg.green}${newDevice.id}${colors.reset}`);
                    return; // Exit after creation
                } else {
                    // --- Update existing Quick App by manually entered ID ---
                    deviceId = parseInt(answer, 10);
                    if (isNaN(deviceId)) {
                        console.error(`${icons.error} Invalid Quick App ID provided. Exiting.`);
                        return;
                    }
                }
            }
        } else if (!quickAppNameFromArg) { // Only ask for confirmation if not in watch mode
            const confirmAnswer = await askQuestion(`${icons.question} Quick App "${quickAppJson.name}" found with ID ${deviceId}. Use this ID? (Y/n, or 'new' to create a new one): `);
            const answer = confirmAnswer.toLowerCase();
            if (answer === 'n') {
                const manualId = await askQuestion(`${icons.question} Please enter the correct Quick App ID: `);
                deviceId = parseInt(manualId, 10);
                if (isNaN(deviceId)) {
                    console.error(`${icons.error} Invalid Quick App ID provided. Exiting.`);
                    return;
                }
            } else if (answer === 'new') {
                // --- Create new Quick App ---
                console.log(`\n${colors.fg.magenta}Creating new Quick App: "${quickAppJson.name}"...${colors.reset}`);
                const fqaData = { ...quickAppJson, files: filesToUpload };
                delete fqaData._files; // Clean up internal property

                const newDevice = await fibaroRequest(config, 'POST', '/api/quickApp', fqaData);
                console.log(`\n${icons.success} Quick App created successfully with ID: ${colors.fg.green}${newDevice.id}${colors.reset}`);
                return; // Exit after creation
            }
        }

        console.log(`\n${colors.fg.magenta}Updating files for Quick App ID: ${deviceId}...${colors.reset}`);

        if (!filesToUpload || filesToUpload.length === 0) {
            console.log(`${icons.info} No files to upload found in the quickapp.json \`_files\` array.`);
            return;
        }

        // Before uploading, check if `u_settings.lua` already exists on the device
        try {
            const remoteFiles = await fibaroRequest(config, 'GET', `/api/quickApp/${deviceId}/files`);
            // Build a set of base file names (without .lua) present on the device
            const remoteFileNames = new Set();
            if (Array.isArray(remoteFiles)) {
                remoteFiles.forEach(item => {
                    try {
                        let name = null;
                        if (typeof item === 'string') name = item;
                        else if (item && (item.name || item.fileName || item.file)) name = item.name || item.fileName || item.file;
                        if (name) {
                            name = path.basename(name).toLowerCase();
                            if (name.endsWith('.lua')) name = name.slice(0, -4);
                            remoteFileNames.add(name);
                        }
                    } catch (e) {
                        // ignore parse errors for individual items
                    }
                });
            }

            // If the device already has u_settings, don't upload our local copy
            const hasRemoteUSettings = remoteFileNames.has('u_settings');
            if (hasRemoteUSettings) {
                const beforeCount = filesToUpload.length;
                filesToUpload = filesToUpload.filter(f => (f.name || '').toLowerCase() !== 'u_settings');
                if (filesToUpload.length < beforeCount) {
                    console.log(`${icons.info} Skipping upload of ${colors.fg.yellow}u_settings.lua${colors.reset} because it already exists on the device.`);
                }
            }
        } catch (err) {
            const errMsg = String(err);
            console.warn(`${icons.error} Could not check remote files for existing u_settings.lua: ${errMsg}. Proceeding with upload.`);
        }

        if (!filesToUpload || filesToUpload.length === 0) {
            console.log(`${icons.info} No files to upload after filtering (maybe skipped u_settings.lua).`);
            return;
        }

        await fibaroRequest(config, 'PUT', `/api/quickApp/${deviceId}/files`, filesToUpload);

        console.log(`\n${icons.success} File upload complete.`);
        console.log('🔄 Restarting Quick App to apply changes...');
        await fibaroRequest(config, 'POST', '/api/plugins/restart', { deviceId });
        console.log(`${icons.success} Quick App restarted successfully.`);

    } catch (error) {
        const errMsg = String(error);
        console.error(`\n${icons.error} An error occurred during upload: ${errMsg}`);
        try {
            if (error && typeof error === 'object' && 'responseBody' in error) {
                console.error('Response Body:', error.responseBody);
            }
        } catch (_) {}
    }
}

upload();