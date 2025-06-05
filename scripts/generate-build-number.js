#!/usr/bin/env node

/**
 * Generate build number in format MMDDYY-N
 * Where N increments throughout the day
 */

const fs = require('fs');
const path = require('path');

const BUILD_FILE = path.join(__dirname, '..', 'build-number.json');

function generateBuildNumber() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const datePrefix = `${month}${day}${year}`;

  let buildData = { lastDate: '', lastNumber: 0 };
  
  // Read existing build data
  if (fs.existsSync(BUILD_FILE)) {
    try {
      buildData = JSON.parse(fs.readFileSync(BUILD_FILE, 'utf8'));
    } catch (error) {
      console.warn('Could not read build file, starting fresh');
    }
  }

  // Increment or reset build number
  let buildNumber = 1;
  if (buildData.lastDate === datePrefix) {
    buildNumber = buildData.lastNumber + 1;
  }

  const fullBuildNumber = `${datePrefix}-${buildNumber}`;

  // Save updated build data
  const newBuildData = {
    lastDate: datePrefix,
    lastNumber: buildNumber,
    fullBuildNumber,
    timestamp: now.toISOString()
  };

  fs.writeFileSync(BUILD_FILE, JSON.stringify(newBuildData, null, 2));

  console.log(`📦 Build number: ${fullBuildNumber}`);
  console.log(`📅 Generated at: ${now.toLocaleString()}`);

  return fullBuildNumber;
}

// Generate and return build number
const buildNumber = generateBuildNumber();

// Write to environment file for React to use
const buildDate = new Date().toISOString();
const envContent = `REACT_APP_BUILD_NUMBER=${buildNumber}\nREACT_APP_BUILD_DATE=${buildDate}\n`;
fs.writeFileSync(path.join(__dirname, '..', '.env.local'), envContent);

// Write to public/build-info.json for PWA update checking
const buildInfoPath = path.join(__dirname, '..', 'public', 'build-info.json');
const buildInfo = {
  buildNumber: buildNumber,
  buildDate: buildDate,
  version: "1.0.0"
};
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

console.log(`✅ Build number ${buildNumber} written to .env.local`);
console.log(`✅ Build info written to public/build-info.json`);

module.exports = { generateBuildNumber };