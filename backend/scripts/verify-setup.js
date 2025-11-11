#!/usr/bin/env node

/**
 * Service Account Setup Verification Script
 * 
 * This script verifies that your service account is properly configured
 * and has the necessary permissions to access Google Cloud services.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import { VertexAI } from '@google-cloud/vertexai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const checks = {
  envFile: { name: '📄 .env file exists', status: 'pending' },
  envVars: { name: '🔧 Required environment variables', status: 'pending' },
  keyFile: { name: '🔑 Service account key file', status: 'pending' },
  auth: { name: '🔐 Google Cloud authentication', status: 'pending' },
  vertexAI: { name: '🤖 Vertex AI access', status: 'pending' },
};

function updateCheck(key, status, message = '') {
  checks[key].status = status;
  checks[key].message = message;
}

function printCheck(key) {
  const check = checks[key];
  const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⏳';
  console.log(`${icon} ${check.name}`);
  if (check.message) {
    console.log(`   ${check.message}`);
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying Service Account Setup...\n');

  // Check 1: .env file exists
  const envPath = resolve(__dirname, '../.env');
  if (existsSync(envPath)) {
    updateCheck('envFile', 'pass', 'Found at: ' + envPath);
  } else {
    updateCheck('envFile', 'fail', 'Not found. Copy env.example to .env');
  }
  printCheck('envFile');

  // Check 2: Required environment variables
  const requiredVars = ['GCP_PROJECT_ID', 'GCP_LOCATION', 'GOOGLE_APPLICATION_CREDENTIALS'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length === 0) {
    updateCheck('envVars', 'pass', `All required variables set`);
  } else {
    updateCheck('envVars', 'fail', `Missing: ${missingVars.join(', ')}`);
  }
  printCheck('envVars');

  if (missingVars.length > 0) {
    console.log('\n❌ Setup incomplete. Please configure your .env file.\n');
    process.exit(1);
  }

  // Check 3: Service account key file exists
  const keyPath = resolve(__dirname, '..', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (existsSync(keyPath)) {
    updateCheck('keyFile', 'pass', 'Found at: ' + keyPath);
  } else {
    updateCheck('keyFile', 'fail', 'Not found at: ' + keyPath);
  }
  printCheck('keyFile');

  if (!existsSync(keyPath)) {
    console.log('\n❌ Service account key file not found.');
    console.log('📖 See: backend/SERVICE_ACCOUNT_SETUP.md for instructions\n');
    process.exit(1);
  }

  // Check 4: Google Cloud authentication
  try {
    const auth = new GoogleAuth({
      keyFilename: keyPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const token = await client.getAccessToken();

    if (token.token && projectId) {
      updateCheck('auth', 'pass', `Authenticated as project: ${projectId}`);
    } else {
      updateCheck('auth', 'fail', 'Unable to get access token');
    }
  } catch (error) {
    updateCheck('auth', 'fail', error.message);
  }
  printCheck('auth');

  if (checks.auth.status === 'fail') {
    console.log('\n❌ Authentication failed.');
    console.log('💡 Check that your service account key is valid\n');
    process.exit(1);
  }

  // Check 5: Vertex AI access
  try {
    const vertexAI = new VertexAI({
      project: process.env.GCP_PROJECT_ID,
      location: process.env.GCP_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: process.env.VERTEX_AI_MODEL || 'gemini-1.5-pro',
    });

    // Try a simple test
    const request = {
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
    };

    const response = await model.generateContent(request);
    const result = response.response.candidates[0].content.parts[0].text;

    if (result) {
      updateCheck('vertexAI', 'pass', `Successfully connected to ${process.env.VERTEX_AI_MODEL || 'gemini-1.5-pro'}`);
    } else {
      updateCheck('vertexAI', 'fail', 'No response from model');
    }
  } catch (error) {
    if (error.message.includes('permission')) {
      updateCheck('vertexAI', 'fail', 'Permission denied. Grant "Vertex AI User" role to service account');
    } else if (error.message.includes('API not enabled')) {
      updateCheck('vertexAI', 'fail', 'Enable Vertex AI API: gcloud services enable aiplatform.googleapis.com');
    } else {
      updateCheck('vertexAI', 'fail', error.message);
    }
  }
  printCheck('vertexAI');

  // Summary
  console.log('\n' + '='.repeat(60));
  const allPassed = Object.values(checks).every(c => c.status === 'pass');
  
  if (allPassed) {
    console.log('\n✅ All checks passed! Your setup is ready.\n');
    console.log('🚀 Start the server with: npm run dev\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some checks failed. Please fix the issues above.\n');
    console.log('📖 Documentation:');
    console.log('   - Service Account Setup: backend/SERVICE_ACCOUNT_SETUP.md');
    console.log('   - Full Setup Guide: backend/SETUP_GUIDE.md\n');
    process.exit(1);
  }
}

// Run verification
verifySetup().catch((error) => {
  console.error('\n💥 Verification error:', error.message);
  process.exit(1);
});

