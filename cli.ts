#!/usr/bin/env node
/**
 * RexaCloud CLI Tool
 * Administrative Command Line Interface for terminal-driven server management.
 * Used by installer.sh and system administrators to provision admins, generate keys, and test integrations.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { authService } from './backend/services/authService.js';
import { pterodactylAdmin } from './backend/services/pterodactylAdmin.js';
import { config, updateDynamicConfig } from './backend/config.js';
import { dbSettings } from './backend/db/index.js';

function prompt(query: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function handleAdminCreate() {
  console.log('\n======================================================');
  console.log('   RexaCloud Panel — Initial Administrator Setup');
  console.log('======================================================\n');

  let username = '';
  while (!username) {
    username = await prompt('Enter Administrator Username: ');
    if (username.length < 3) {
      console.log('Error: Username must be at least 3 characters long.');
      username = '';
    }
  }

  let email = '';
  while (!email) {
    email = await prompt('Enter Administrator Email Address: ');
    if (!email.includes('@') || !email.includes('.')) {
      console.log('Error: Please enter a valid email address.');
      email = '';
    }
  }

  let password = '';
  while (!password) {
    password = await prompt('Enter Secure Password (min 8 characters): ');
    if (password.length < 8) {
      console.log('Error: Password must be at least 8 characters long.');
      password = '';
      continue;
    }
    const confirm = await prompt('Confirm Password: ');
    if (password !== confirm) {
      console.log('Error: Passwords do not match. Please try again.');
      password = '';
    }
  }

  try {
    const existing = authService.findDbUserByUsernameOrEmail(username) || authService.findDbUserByUsernameOrEmail(email);
    if (existing) {
      console.log(`\n[!] Error: An account with username "${username}" or email "${email}" already exists.`);
      process.exit(1);
    }

    const newAdmin = authService.createAdminUser({
      username,
      email,
      password,
    });

    console.log('\n[✔] SUCCESS: Initial Administrator account provisioned successfully in database!');
    console.log(`    - ID:       ${newAdmin.id}`);
    console.log(`    - Username: ${newAdmin.username}`);
    console.log(`    - Email:    ${newAdmin.email}`);
    console.log(`    - Role:     ${newAdmin.role.toUpperCase()}`);
    console.log('\nYou can now log in securely through the web portal using these credentials.\n');
  } catch (err: any) {
    console.error('\n[X] Failed to create administrator account:', err.message);
    process.exit(1);
  }
}

async function handleKeyGenerate() {
  const secret = crypto.randomBytes(32).toString('hex');
  console.log(`\n[✔] Generated Cryptographic Session Secret:\n\n    ${secret}\n`);

  // Write to database settings
  dbSettings.set('JWT_SECRET', secret);

  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (content.includes('JWT_SECRET=')) {
      content = content.replace(/JWT_SECRET=.*/g, `JWT_SECRET="${secret}"`);
    } else {
      content += `\nJWT_SECRET="${secret}"\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('[✔] Updated JWT_SECRET in .env file.');
  }
}

async function handlePterodactylTest() {
  console.log('\nTesting Pterodactyl Integration Diagnostics...');
  console.log(`Panel URL: ${config.pterodactylUrl || '(not configured)'}`);

  const status = await pterodactylAdmin.testConnection();
  console.log('\nResults:');
  console.log(`- Configured:           ${status.configured ? 'YES' : 'NO'}`);
  console.log(`- Client API Connected: ${status.clientApiConnected ? 'YES (Reachable)' : 'NO'}`);
  console.log(`- App API Connected:    ${status.appApiConnected ? 'YES (Reachable)' : 'NO'}`);
  console.log(`- Latency:              ${status.latencyMs} ms`);
  if (status.errorMessage) {
    console.log(`- Diagnostics:          ${status.errorMessage}`);
  }
  console.log('');
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'admin:create':
      await handleAdminCreate();
      break;

    case 'key:generate':
      await handleKeyGenerate();
      break;

    case 'pterodactyl:test':
      await handlePterodactylTest();
      break;

    default:
      console.log('RexaCloud Administrative CLI');
      console.log('Usage: npm run cli <command>');
      console.log('\nAvailable Commands:');
      console.log('  admin:create       Create an initial administrator account');
      console.log('  key:generate       Generate and write a new session secret');
      console.log('  pterodactyl:test   Test live Pterodactyl Panel API reachability');
      break;
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
