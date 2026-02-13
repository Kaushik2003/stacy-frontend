#!/usr/bin/env node

/**
 * HTTPS Setup Script for Next.js Development Server
 * Generates trusted localhost certificates using mkcert
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '..', 'certificates');
const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost.pem');

// Ensure certificates directory exists
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('✓ HTTPS certificates already exist');
  console.log(`  Key: ${keyPath}`);
  console.log(`  Cert: ${certPath}`);
  process.exit(0);
}

console.log('Setting up HTTPS certificates...');

// Check if mkcert is installed
try {
  execSync('mkcert --version', { stdio: 'ignore' });
  console.log('✓ mkcert is installed');
} catch (error) {
  console.error('✗ mkcert is not installed');
  console.error('\nPlease install mkcert first:');
  console.error('  Windows (using Chocolatey): choco install mkcert');
  console.error('  Windows (using Scoop): scoop install mkcert');
  console.error('  macOS: brew install mkcert');
  console.error('  Linux: See https://github.com/FiloSottile/mkcert#installation');
  console.error('\nAfter installing, run: mkcert -install');
  process.exit(1);
}

// Install mkcert CA if not already installed
try {
  execSync('mkcert -install', { stdio: 'inherit' });
  console.log('✓ mkcert CA installed');
} catch (error) {
  console.warn('⚠ Could not install mkcert CA (may already be installed)');
}

// Generate certificates
try {
  console.log('Generating certificates for localhost...');
  execSync(`mkcert -key-file "${keyPath}" -cert-file "${certPath}" localhost 127.0.0.1 ::1`, {
    stdio: 'inherit',
    cwd: certsDir
  });
  console.log('✓ Certificates generated successfully!');
  console.log(`  Key: ${keyPath}`);
  console.log(`  Cert: ${certPath}`);
} catch (error) {
  console.error('✗ Failed to generate certificates');
  console.error(error.message);
  process.exit(1);
}
