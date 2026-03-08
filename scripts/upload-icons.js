const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const readline = require('readline');

// --- UI Enhancements (from upload.js) ---
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        cyan: "\x1b[36m",
        magenta: "\x1b[35m",
    }
};

const icons = {
    question: '❓',
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    upload: '📤'
};

const projectRoot = path.join(__dirname, '..');
const unpackedDir = path.join(projectRoot, '_unpacked');
const configPath = path.join(projectRoot, 'fibaro.config.json');

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
 * Uploads icons for a Quick App.
 */
async function uploadIcons() {
    if (!fs.existsSync(configPath)) {
        console.error(`${icons.error} Error: Configuration file not found at ${colors.fg.yellow}${configPath}${colors.reset}`);
        return;
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.host || !config.username || !config.password) {
            console.error(`${icons.error} Error: fibaro.config.json is incomplete.`);
            return;
        }
    } catch (error) {
        console.error(`${icons.error} Error parsing fibaro.config.json: ${error.message}`);
        return;
    }

    try {
        const availableQuickApps = fs.readdirSync(unpackedDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .filter(dirent => fs.existsSync(path.join(unpackedDir, dirent.name, 'quickapp.json')))
            .map(dirent => dirent.name);

        if (availableQuickApps.length === 0) {
            console.error(`${icons.error} No Quick Apps found in the '${colors.fg.yellow}${unpackedDir}${colors.reset}' directory.`);
            return;
        }

        console.log(`\n${icons.upload} Available Quick Apps to upload icons for:`);
        availableQuickApps.forEach((qaName, index) => {
            console.log(`  ${colors.bright}${index + 1}.${colors.reset} ${colors.fg.cyan}${qaName}${colors.reset}`);
        });

        let selectedIndex;
        while (true) {
            const answer = await askQuestion(`\n${icons.question} Enter the number of the Quick App (1-${availableQuickApps.length}): `);
            selectedIndex = parseInt(answer, 10) - 1;
            if (selectedIndex >= 0 && selectedIndex < availableQuickApps.length) {
                break;
            }
            console.log(`${colors.fg.red}Invalid selection. Please enter a number within the range.${colors.reset}`);
        }
        const quickAppName = availableQuickApps[selectedIndex];
        const quickAppPath = path.join(unpackedDir, quickAppName);

        console.log(`\nYou selected: "${quickAppName}"\n`);

        const allFiles = fs.readdirSync(quickAppPath);
        const iconFile = allFiles.find(f => f.endsWith('.svg') || f.endsWith('.png'));

        if (!iconFile) {
            console.log(`${icons.info} No .svg or .png icon file found in the root of ${colors.fg.yellow}${quickAppPath}${colors.reset}.`);
            return;
        }

        console.log(`${colors.fg.magenta}Found icon: ${colors.fg.cyan}${iconFile}${colors.reset}. Starting upload...`);

        const quickAppJsonPath = path.join(quickAppPath, 'quickapp.json');
        const quickAppJson = JSON.parse(fs.readFileSync(quickAppJsonPath, 'utf-8'));

        try {
            console.log(`  ${icons.upload} Uploading ${colors.fg.cyan}${iconFile}${colors.reset}...`);

            const iconFilePath = path.join(quickAppPath, iconFile);
            const fileContent = fs.readFileSync(iconFilePath);
            const fileExtension = path.extname(iconFile).substring(1);

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
                `Content-Disposition: form-data; name="icon"; filename="${iconFile}"`,
                `Content-Type: image/${fileExtension === 'svg' ? 'svg+xml' : fileExtension}`,
                '',
            ].join('\r\n');

            const endBoundary = `\r\n--${boundary}--\r\n`;
            const fullBody = Buffer.concat([Buffer.from(body + '\r\n'), fileContent, Buffer.from(endBoundary)]);

            const response = await fibaroRequest(
                config,
                'POST',
                '/api/icons',
                fullBody,
                `multipart/form-data; boundary=${boundary}`
            );

             if (response && response.id) {
                 console.log(`    ${icons.success} Success! Icon uploaded with ID: ${colors.fg.green}${response.id}${colors.reset}`);
                 quickAppJson.icon = response.id;

                 // Save the updated quickapp.json
                 fs.writeFileSync(quickAppJsonPath, JSON.stringify(quickAppJson, null, 2), 'utf-8');
                 console.log(`\n${icons.success} Updated ${colors.fg.yellow}quickapp.json${colors.reset} with new icon ID.`);
                 console.log(`\n${icons.info} To apply the new icon, re-upload the Quick App using the main upload script.`);
             } else {
                 throw new Error('Response did not contain an icon ID.');
             }
        } catch (error) {
            console.error(`    ${icons.error} Failed to upload ${iconFile}: ${error.message}`);
            if (error.responseBody) {
                console.error('    Response Body:', error.responseBody);
            }
        }

    } catch (error) {
        console.error(`\n${icons.error} An error occurred during the process:`, error.message);
        if (error.responseBody) {
            console.error('Response Body:', error.responseBody);
        }
    }
}

uploadIcons();