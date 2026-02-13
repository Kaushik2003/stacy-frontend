#!/usr/bin/env node

/**
 * Check HTTPS setup before starting dev server
 * Verifies mkcert installation for trusted certificates
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '..', 'certificates');
const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost.pem');

// Check if custom certificates exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('✓ Using custom HTTPS certificates');
  process.exit(0);
}

// Check if mkcert is installed (for auto-generated trusted certs)
try {
  execSync('mkcert --version', { stdio: 'ignore' });
  console.log('✓ mkcert is installed - Next.js will generate trusted certificates');
} catch (error) {
  console.warn('⚠ mkcert is not installed');
  console.warn('  Next.js will generate self-signed certificates (browser may show "Not secure")');
  console.warn('  To fix: Install mkcert and run "mkcert -install"');
  console.warn('  See: frontend/HTTPS_SETUP.md for instructions');
}

process.exit(0);
