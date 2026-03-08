#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    fg: {
        yellow: "\x1b[33m",
        cyan: "\x1b[36m",
        magenta: "\x1b[35m",
    }
};

const icons = {
    info: 'ℹ️',
    watching: '👀',
    upload: '🚀'
};

const projectRoot = path.join(__dirname, '..');
const unpackedDir = path.join(projectRoot, '_unpacked');

if (!fs.existsSync(unpackedDir)) {
    console.error(`Directory not found: ${unpackedDir}. Nothing to watch.`);
    process.exit(1);
}

console.log(`\n${icons.watching} ${colors.bright}Watching for file changes in: ${colors.fg.cyan}${unpackedDir}${colors.reset}`);

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

const uploadQueue = new Set();

const processQueue = debounce(() => {
    if (uploadQueue.size === 0) return;

    const appToUpload = uploadQueue.values().next().value; // Get the first (and likely only) item
    uploadQueue.clear();

    console.log(`\n${icons.upload} ${colors.fg.magenta}Change detected in "${appToUpload}". Triggering upload...${colors.reset}`);

    const uploadProcess = spawn('node', [path.join(__dirname, 'upload.js'), appToUpload], {
        stdio: 'inherit', // Show output from the upload script
        shell: true
    });

    uploadProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`\nUpload process for "${appToUpload}" exited with code ${code}.`);
        }
        console.log(`\n${icons.watching} ${colors.bright}Resuming watch...${colors.reset}`);
    });

    uploadProcess.on('error', (err) => {
        console.error(`\nFailed to start upload process for "${appToUpload}":`, err);
        console.log(`\n${icons.watching} ${colors.bright}Resuming watch...${colors.reset}`);
    });
}, 500); // 500ms debounce delay

fs.watch(unpackedDir, { recursive: true }, (eventType, filename) => {
    if (filename) {
        // Determine the Quick App directory from the changed file's path
        const quickAppDir = filename.split(path.sep)[0];
        const quickAppPath = path.join(unpackedDir, quickAppDir);

        if (fs.existsSync(path.join(quickAppPath, 'quickapp.json'))) {
            uploadQueue.add(quickAppDir);
            processQueue();
        }
    }
});