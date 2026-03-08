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
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        cyan: "\x1b[36m",
    }
};

const icons = {
    question: '❓',
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    download: '📥'
};

const projectRoot = process.cwd();
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
            rejectUnauthorized: false // For self-signed certificates
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
                        error.responseBody = responseBody;
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
 * Downloads and unpacks a Quick App from the Fibaro Home Center.
 */
async function download() {
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

    try {
        // 1. Get all devices and filter for Quick Apps
        console.log(`\n${icons.info} Fetching devices from ${config.host}...`);
        const allDevices = await fibaroRequest(config, 'GET', '/api/devices');
        const quickApps = allDevices.filter(d => d.isPlugin === true && d.parentId == 0 && d.name !== "YR Weather");
        console.log(quickApps.map(qa => qa.parentId))

        if (quickApps.length === 0) {
            console.error(`${icons.error} No Quick Apps found on your Fibaro Home Center.`);
            return;
        }

        // 2. Prompt user to select a Quick App
        console.log(`\n${icons.download} Available Quick Apps to download:`);
        quickApps.forEach((qa, index) => {
            console.log(`  ${colors.bright}${index + 1}.${colors.reset} ${colors.fg.cyan}${qa.name}${colors.reset} (ID: ${qa.id})`);
        });

        let selectedIndex;
        while (true) {
            const answer = await askQuestion(`\n${icons.question} Enter the number of the Quick App to download (1-${quickApps.length}): `);
            selectedIndex = parseInt(answer, 10) - 1;
            if (selectedIndex >= 0 && selectedIndex < quickApps.length) {
                break;
            }
            console.log(`${colors.fg.red}Invalid selection. Please enter a number within the range.${colors.reset}`);
        }

        const selectedQA = quickApps[selectedIndex];
        console.log(`You selected: "${selectedQA.name}"\n`);

        // 3. Download the Quick App data
        console.log(`${icons.info} Downloading Quick App data for ID: ${selectedQA.id}...`);
        const fqaData = await fibaroRequest(config, 'GET', `/api/quickApp/export/${selectedQA.id}`);

        // 4. Unpack the files
        const outputDirName = selectedQA.name.replace(/[\s\/\\?%*:|"<>]/g, '_'); // Sanitize name for folder
        const outputDir = path.join(unpackedDir, outputDirName);

        fs.mkdirSync(outputDir, { recursive: true });

        const filesMetadata = [];

        if (fqaData.files && Array.isArray(fqaData.files)) {
            fqaData.files.forEach(file => {
                const { content, ...metadata } = file;
                if (file.name && typeof content === 'string') {
                    const luaFilePath = path.join(outputDir, `${file.name}.lua`);
                    fs.writeFileSync(luaFilePath, content.replace(/\r\n/g, '\n'), 'utf-8');
                    console.log(`  -> ${icons.success} Unpacked: ${luaFilePath}`);
                    filesMetadata.push(metadata);
                } else {
                    console.warn(`  -> ${colors.fg.yellow}Warning: Skipping file with invalid format:`, file, `${colors.reset}`);
                }
            });
        }

        // 5. Create quickapp.json
        const { files, ...quickAppJson } = fqaData;
        quickAppJson._files = filesMetadata; // Store metadata for packing

        const quickAppJsonPath = path.join(outputDir, 'quickapp.json');
        fs.writeFileSync(quickAppJsonPath, JSON.stringify(quickAppJson, null, 2), 'utf-8');
        console.log(`  -> ${icons.success} Created metadata file: ${quickAppJsonPath}`);

        console.log(`\n${icons.success} Download and unpack complete. Files are in ${colors.fg.green}${outputDir}${colors.reset}`);

    } catch (error) {
        console.error(`\n${icons.error} An error occurred during download:`, error.message);
        if (error.responseBody) {
            console.error('Response Body:', error.responseBody);
        }
    }
}

download();