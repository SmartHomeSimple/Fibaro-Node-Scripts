#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const packedDir = path.join(projectRoot, '_packed');
const unpackedDir = path.join(projectRoot, '_unpacked');

/**
 * Unpacks a single .fqa file.
 * @param {string} fqaFilePath - The full path to the .fqa file.
 */
function unpackFile(fqaFilePath) {
    if (!fs.existsSync(fqaFilePath)) {
        console.error(`File not found: ${fqaFilePath}`);
        return;
    }

    try {
        console.log(`\nUnpacking ${fqaFilePath}...`);
        const fqaContent = fs.readFileSync(fqaFilePath, 'utf-8');
        const fqaData = JSON.parse(fqaContent);

        const outputDirName = path.basename(fqaFilePath, '.fqa');
        const outputDir = path.join(unpackedDir, outputDirName);

        fs.mkdirSync(outputDir, { recursive: true });

        const filesMetadata = [];

        if (fqaData.files && Array.isArray(fqaData.files)) {
            fqaData.files.forEach(file => {
                const { content, ...metadata } = file;
                if (file.name && typeof content === 'string') {
                    const luaFilePath = path.join(outputDir, `${file.name}.lua`);
                    fs.writeFileSync(luaFilePath, content, 'utf-8');
                    console.log(`  -> Unpacked: ${luaFilePath}`);
                    filesMetadata.push(metadata);
                } else {
                    console.warn(`  -> Warning: Skipping file with invalid format in ${fqaFilePath}:`, file);
                }
            });
        }

        // Separate files from the main JSON structure
        const { files, ...quickAppJson } = fqaData;
        // Store metadata about files for packing in a temporary property
        quickAppJson._files = filesMetadata;

        const quickAppJsonPath = path.join(outputDir, 'quickapp.json');
        fs.writeFileSync(quickAppJsonPath, JSON.stringify(quickAppJson, null, 2), 'utf-8');
        console.log(`  -> Created metadata file: ${quickAppJsonPath}`);
        console.log(`Unpack complete. Files are in ${outputDir}`);
    } catch (error) {
        console.error(`An error occurred during unpacking of ${fqaFilePath}:`, error);
    }
}

function unpackAll() {
    if (!fs.existsSync(packedDir)) {
        console.log(`Packed directory not found: ${packedDir}. Nothing to unpack.`);
        return;
    }

    const fqaFiles = fs.readdirSync(packedDir).filter(file => file.endsWith('.fqa'));
    fqaFiles.forEach(fileName => unpackFile(path.join(packedDir, fileName)));
}

unpackAll();