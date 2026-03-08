#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const configDir = path.join(__dirname, '..', 'config');
const targetFile = path.join(__dirname, '..', 'fibaro.config.json');

// Get all subdirectories in the config folder
function getConfigOptions() {
  const items = fs.readdirSync(configDir, { withFileTypes: true });
  return items
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .sort();
}

// Create readline interface for user input
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  const options = getConfigOptions();

  if (options.length === 0) {
    console.error('No config options found in the config folder.');
    process.exit(1);
  }

  console.log('\nAvailable configurations:');
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });

  const answer = await askQuestion('\nSelect a configuration (enter number or name): ');

  let selectedConfig;

  // Check if user entered a number
  const num = parseInt(answer, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    selectedConfig = options[num - 1];
  } else if (options.includes(answer)) {
    selectedConfig = answer;
  } else {
    console.error(`Invalid selection: "${answer}"`);
    process.exit(1);
  }

  const sourceFile = path.join(configDir, selectedConfig, 'fibaro.config.json');

  // Check if the config file exists
  if (!fs.existsSync(sourceFile)) {
    console.error(`Configuration file not found: ${sourceFile}`);
    process.exit(1);
  }

  // Copy the file
  try {
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`\n✓ Successfully copied ${selectedConfig}/fibaro.config.json to fibaro.config.json`);
  } catch (error) {
    console.error(`Error copying file: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
