/**
 * GCS Connection Test Script
 * Tests Google Cloud Storage connectivity and credentials
 */
import { Storage } from '@google-cloud/storage';
import { config } from '../config';
import logger from './logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function testGCSConnection() {
  console.log('\n=== Testing GCS Connection ===\n');
  
  // Check configuration
  console.log('Configuration:');
  console.log('  Project ID:', config.gcp.projectId);
  console.log('  Bucket:', config.storage.bucket);
  console.log('  Service Account Key Path:', config.gcp.serviceAccountKey);
  console.log('  GOOGLE_APPLICATION_CREDENTIALS env:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log();

  // Check if service account key file exists
  if (config.gcp.serviceAccountKey) {
    const keyPath = path.resolve(config.gcp.serviceAccountKey);
    console.log('Checking service account key file:');
    console.log('  Resolved path:', keyPath);
    
    if (fs.existsSync(keyPath)) {
      console.log('  ✓ File exists');
      try {
        const keyContent = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        console.log('  ✓ Valid JSON');
        console.log('  Project ID from key:', keyContent.project_id);
        console.log('  Client Email:', keyContent.client_email);
      } catch (error) {
        console.log('  ✗ Invalid JSON:', error instanceof Error ? error.message : error);
      }
    } else {
      console.log('  ✗ File does not exist');
    }
    console.log();
  }

  // Initialize Storage client
  console.log('Initializing Storage client...');
  let storage: Storage;
  try {
    storage = new Storage({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.serviceAccountKey,
    });
    console.log('✓ Storage client initialized\n');
  } catch (error) {
    console.error('✗ Failed to initialize Storage client:');
    console.error('  Error:', error);
    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
    }
    return;
  }

  // Test 1: Check if bucket exists
  console.log('Test 1: Check if bucket exists...');
  try {
    const bucket = storage.bucket(config.storage.bucket);
    const [exists] = await bucket.exists();
    if (exists) {
      console.log('✓ Bucket exists and is accessible\n');
    } else {
      console.log('✗ Bucket does not exist\n');
      return;
    }
  } catch (error) {
    console.error('✗ Failed to check bucket existence:');
    console.error('  Error type:', typeof error);
    console.error('  Error:', error);
    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
      console.error('  Name:', error.name);
    }
    // Log all enumerable properties
    if (error && typeof error === 'object') {
      console.error('  Error properties:', Object.keys(error));
      console.error('  Full error object:', JSON.stringify(error, null, 2));
    }
    return;
  }

  // Test 2: List files in bucket (first 5)
  console.log('Test 2: List files in bucket...');
  try {
    const bucket = storage.bucket(config.storage.bucket);
    const [files] = await bucket.getFiles({ maxResults: 5 });
    console.log(`✓ Found ${files.length} files (showing max 5):`);
    files.forEach(file => {
      console.log(`  - ${file.name}`);
    });
    console.log();
  } catch (error) {
    console.error('✗ Failed to list files:');
    console.error('  Error:', error);
    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
    }
    if (error && typeof error === 'object') {
      console.error('  Full error object:', JSON.stringify(error, null, 2));
    }
    console.log();
  }

  // Test 3: Upload a test file
  console.log('Test 3: Upload test file...');
  const testFileName = `test-connection-${Date.now()}.txt`;
  const testFilePath = path.join(os.tmpdir(), testFileName);
  const testContent = `GCS Connection Test\nTimestamp: ${new Date().toISOString()}`;
  
  try {
    // Create test file
    fs.writeFileSync(testFilePath, testContent);
    console.log(`  Created test file: ${testFilePath}`);

    // Upload to GCS
    const bucket = storage.bucket(config.storage.bucket);
    const gcsPath = `tests/${testFileName}`;
    
    await bucket.upload(testFilePath, {
      destination: gcsPath,
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
    });
    
    console.log(`✓ Successfully uploaded file to: gs://${config.storage.bucket}/${gcsPath}\n`);

    // Test 4: Download the file back
    console.log('Test 4: Download test file...');
    const downloadPath = path.join(os.tmpdir(), `downloaded-${testFileName}`);
    await bucket.file(gcsPath).download({ destination: downloadPath });
    const downloadedContent = fs.readFileSync(downloadPath, 'utf8');
    
    if (downloadedContent === testContent) {
      console.log('✓ Successfully downloaded and verified file content\n');
    } else {
      console.log('✗ Downloaded content does not match\n');
    }

    // Test 5: Delete the test file
    console.log('Test 5: Delete test file...');
    await bucket.file(gcsPath).delete();
    console.log('✓ Successfully deleted test file\n');

    // Clean up local files
    fs.unlinkSync(testFilePath);
    fs.unlinkSync(downloadPath);
    console.log('✓ Cleaned up local test files\n');

    console.log('=== All tests passed! GCS connection is working. ===\n');
  } catch (error) {
    console.error('✗ Failed during file operations:');
    console.error('  Error type:', typeof error);
    console.error('  Error constructor:', error?.constructor?.name);
    console.error('  Error:', error);
    
    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
      console.error('  Name:', error.name);
    }
    
    // Log all properties
    if (error && typeof error === 'object') {
      console.error('  Error properties:', Object.keys(error));
      try {
        console.error('  Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('  Could not stringify error');
      }
    }
    
    // Clean up test file if it exists
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run the test
testGCSConnection().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

