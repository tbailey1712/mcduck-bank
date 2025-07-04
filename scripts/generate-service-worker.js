#!/usr/bin/env node

/**
 * Generate Firebase Service Worker with Environment Variables
 * This script replaces placeholders in the template with actual environment values
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local file manually
const loadEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
};

// Load environment variables from .env files
loadEnvFile('.env.local');
loadEnvFile('.env');

const generateServiceWorker = () => {
  try {
    console.log('🔧 Generating Firebase Service Worker from template...');

    // Read the template file
    const templatePath = path.join(__dirname, '../public/firebase-messaging-sw.template.js');
    const outputPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    let template = fs.readFileSync(templatePath, 'utf8');

    // Define required environment variables
    const requiredVars = [
      'REACT_APP_FIREBASE_API_KEY',
      'REACT_APP_FIREBASE_AUTH_DOMAIN', 
      'REACT_APP_FIREBASE_PROJECT_ID',
      'REACT_APP_FIREBASE_STORAGE_BUCKET',
      'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
      'REACT_APP_FIREBASE_APP_ID'
    ];

    // Check that all required environment variables are set
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Replace placeholders with actual environment values
    requiredVars.forEach(varName => {
      const placeholder = `%${varName}%`;
      const value = process.env[varName];
      template = template.replace(new RegExp(placeholder, 'g'), value);
    });

    // Write the generated service worker
    fs.writeFileSync(outputPath, template);

    console.log('✅ Firebase Service Worker generated successfully!');
    console.log(`📁 Output: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error generating service worker:', error.message);
    process.exit(1);
  }
};

// Run the generator
generateServiceWorker();