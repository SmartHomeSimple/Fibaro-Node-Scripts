#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const projectRoot = process.cwd();
const configDir = path.join(projectRoot, '.fibaro-config');
const targetFile = path.join(projectRoot, 'fibaro.config.json');

// Get all JSON config files in the .fibaro-config folder
function getConfigOptions() {
  if (!fs.existsSync(configDir)) {
    return [];
  }

  const items = fs.readdirSync(configDir, { withFileTypes: true });
  return items
    .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.json'))
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
    console.error(`No config options found in ${configDir}.`);
    console.error('Add JSON files like .fibaro-config/home.json or .fibaro-config/garden.json.');
    process.exit(1);
  }

  console.log(`\nAvailable configurations in ${configDir}:`);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });

  const answer = await askQuestion('\nSelect a configuration (enter number or name): ');

  let selectedConfig;

  // Check if user entered a number
  const num = parseInt(answer, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    selectedConfig = options[num - 1];
  } else {
    const normalizedAnswer = answer.toLowerCase().endsWith('.json') ? answer : `${answer}.json`;
    const exactMatch = options.find(option => option.toLowerCase() === normalizedAnswer.toLowerCase());
    if (exactMatch) {
      selectedConfig = exactMatch;
    }
  }

  if (!selectedConfig) {
    console.error(`Invalid selection: "${answer}"`);
    process.exit(1);
  }

  const sourceFile = path.join(configDir, selectedConfig);

  // Check if the config file exists
  if (!fs.existsSync(sourceFile)) {
    console.error(`Configuration file not found: ${sourceFile}`);
    process.exit(1);
  }

  // Copy the file
  try {
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`\n✓ Successfully copied ${selectedConfig} to fibaro.config.json`);
  } catch (error) {
    console.error(`Error copying file: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
