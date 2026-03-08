#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const projectRoot = process.cwd();
const unpackedDir = path.join(projectRoot, '_unpacked');
const packedDir = path.join(projectRoot, '_packed');

/**
 * Packs a single directory from _unpacked into a .fqa file.
 * Asks a question and waits for user input from the console.
 * @param {string} query The question to display to the user.
 * @returns {Promise<string>} A promise that resolves with the user's answer.
 */
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.trim().toLowerCase());
    }));
}

/**
 * Packs a single directory from _unpacked into a .fqa file.
 * @param {string} sourceDirPath - The full path to the directory to pack.
 */
async function packDirectory(sourceDirPath) {
    const quickAppJsonPath = path.join(sourceDirPath, 'quickapp.json');

    if (!fs.existsSync(quickAppJsonPath)) {
        console.warn(`Warning: quickapp.json not found in ${sourceDirPath}, skipping.`);
        return;
    }

    try {
        console.log(`\nPacking ${sourceDirPath}...`);
        const quickAppJsonContent = fs.readFileSync(quickAppJsonPath, 'utf-8');
        const quickAppJson = JSON.parse(quickAppJsonContent);

        // Find all .lua files in the directory
        const allLuaFiles = fs.readdirSync(sourceDirPath).filter(f => f.endsWith('.lua'));
        const existingFileNames = new Set((quickAppJson._files || []).map(f => f.name));

        // Identify new files and add them to quickAppJson._files
        for (const luaFile of allLuaFiles) {
            const fileName = path.basename(luaFile, '.lua');
            if (!existingFileNames.has(fileName)) {
                console.log(`  -> Discovered new file: ${luaFile}`);
                const newFileMetadata = { name: fileName, type: 'lua', isMain: false, isOpen: false };
                quickAppJson._files = quickAppJson._files || [];
                quickAppJson._files.push(newFileMetadata);
            }
        }

        const packedFiles = [];
        const filesToRemove = [];

        if (quickAppJson._files && Array.isArray(quickAppJson._files)) {
            for (const fileMetadata of quickAppJson._files) {
                const luaFilePath = path.join(sourceDirPath, `${fileMetadata.name}.lua`);
                if (fs.existsSync(luaFilePath)) {
                    const content = fs.readFileSync(luaFilePath, 'utf-8');
                    packedFiles.push({ ...fileMetadata, content: content.replace(/\r\n/g, '\n') });
                    console.log(`  -> Packed: ${luaFilePath}`);
                } else {
                    console.warn(`  -> Warning: Lua file not found for '${fileMetadata.name}' at ${luaFilePath}`);
                    const answer = await askQuestion('     Remove this file reference from the packed quickapp? (y/n): ');
                    if (answer === 'y' || answer === 'yes') {
                        filesToRemove.push(fileMetadata.name);
                        console.log(`     -> Marked '${fileMetadata.name}' for removal from the file list.`);
                    } else {
                        console.log('     -> Skipping file, but reference will be kept.');
                    }
                }
            }
        }

        quickAppJson._files = (quickAppJson._files || []).filter(f => !filesToRemove.includes(f.name));

        // Update quickapp.json with new/removed files before packing
        const finalQuickAppJson = { ...quickAppJson };
        delete finalQuickAppJson.files; // Ensure files array from old format is not carried over

        const fqaData = { ...quickAppJson, files: packedFiles };
        const fqaContent = JSON.stringify(fqaData);

        if (!fs.existsSync(packedDir)) {
            fs.mkdirSync(packedDir, { recursive: true });
        }

        const sourceDirName = path.basename(sourceDirPath);
        const fqaFileName = `${sourceDirName}.fqa`;
        const fqaFilePath = path.join(packedDir, fqaFileName);
        fs.writeFileSync(fqaFilePath, fqaContent, 'utf-8');

        // Also update the source quickapp.json to reflect changes
        fs.writeFileSync(quickAppJsonPath, JSON.stringify(finalQuickAppJson, null, 2), 'utf-8');

        console.log(`\nPack complete. Output file: ${fqaFilePath}`);
    } catch (error) {
        console.error(`An error occurred during packing of ${sourceDirPath}:`, error);
    }
}

async function packAll() {
    if (!fs.existsSync(unpackedDir)) {
        console.log(`Unpacked directory not found: ${unpackedDir}. Nothing to pack.`);
        return;
    }

    const sourceDirs = fs.readdirSync(unpackedDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const dirName of sourceDirs) {
        await packDirectory(path.join(unpackedDir, dirName));
    }
}

packAll();