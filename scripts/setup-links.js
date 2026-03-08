#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Setup script to recreate hard links for shared libraries
// This script creates hard links from shared libraries to each project folder
// Hard links ensure all projects reference the same file, preventing duplication

const rootDir = path.resolve(__dirname, '..');
const sharedDir = path.join(rootDir, '_shared');
const unpackedDir = path.join(rootDir, '_unpacked');
const librariesConfigPath = path.join(sharedDir, 'libraries.json');

// Load libraries configuration
let librariesConfig;
try {
    const configContent = fs.readFileSync(librariesConfigPath, 'utf8');
    librariesConfig = JSON.parse(configContent);
} catch (err) {
    console.error(`Error: Failed to load libraries configuration from ${librariesConfigPath}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
}

console.log('Creating hard links for shared libraries...');
console.log('');

let totalLinks = 0;
let failedLinks = 0;

// Process each library and its projects
for (const [libraryFile, projects] of Object.entries(librariesConfig)) {
    const sharedFile = path.join(sharedDir, libraryFile);

    // Check if shared file exists
    if (!fs.existsSync(sharedFile)) {
        console.error(`Warning: Shared library not found: ${sharedFile}`);
        console.error(`Skipping ${libraryFile}...`);
        console.log('');
        continue;
    }

    console.log(`Processing: ${libraryFile}`);
    console.log(`Source: ${sharedFile}`);
    console.log(`Target projects: ${projects.length}`);
    console.log('');

    // Create hard links in each project
    for (const project of projects) {
        const projectFile = path.join(unpackedDir, project, libraryFile);
        const projectDir = path.dirname(projectFile);

        // Ensure parent directory exists
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }

        // Remove existing file if it exists
        if (fs.existsSync(projectFile)) {
            console.log(`  Removing existing: ${project}/${libraryFile}`);
            fs.unlinkSync(projectFile);
        }

        // Create hard link
        try {
            console.log(`  Creating hard link: ${project}/${libraryFile}`);
            fs.linkSync(sharedFile, projectFile);
            totalLinks++;
        } catch (err) {
            console.error(`  Failed to create hard link for ${project}:`, err instanceof Error ? err.message : String(err));
            failedLinks++;
        }
    }

    console.log('');
}

if (failedLinks > 0) {
    console.log(`⚠ Completed with ${failedLinks} error(s). ${totalLinks} hard links created successfully.`);
    process.exit(1);
} else {
    console.log(`✓ All hard links created successfully! (${totalLinks} links created)`);
    console.log('');
    console.log('Note: Hard links appear as regular files in file explorer, but any changes');
    console.log('to one file will be reflected in all linked copies.');
}
