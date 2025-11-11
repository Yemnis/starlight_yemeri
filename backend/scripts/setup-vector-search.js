/**
 * Vector Search Setup Script
 * Helps verify that all required services are enabled and configured
 */

const https = require('https');
const { config } = require('dotenv');

// Load environment variables
config();

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const APIS_TO_CHECK = [
  'aiplatform.googleapis.com',
  'firestore.googleapis.com',
  'storage.googleapis.com',
];

console.log('\n🔍 Vector Search Setup Verification\n');
console.log('='.repeat(50));

// Check 1: Environment Variables
console.log('\n📋 Checking Environment Variables...');
const requiredEnvVars = [
  'GCP_PROJECT_ID',
  'GCS_BUCKET',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'OPENAI_API_KEY',
];

let envOk = true;
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}: Set`);
  } else {
    console.log(`  ❌ ${varName}: Missing`);
    envOk = false;
  }
});

// Check 2: Service Account File
console.log('\n📄 Checking Service Account File...');
const fs = require('fs');
const path = require('path');

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const keyPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (fs.existsSync(keyPath)) {
    console.log(`  ✅ Service account key found: ${keyPath}`);
    try {
      const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      console.log(`  ✅ Project ID in key: ${keyData.project_id}`);
      console.log(`  ✅ Service account email: ${keyData.client_email}`);
    } catch (err) {
      console.log(`  ⚠️  Could not parse JSON key: ${err.message}`);
    }
  } else {
    console.log(`  ❌ Service account key not found at: ${keyPath}`);
    envOk = false;
  }
}

// Check 3: Project Configuration
console.log('\n🔧 Configuration Summary:');
console.log(`  Project ID: ${PROJECT_ID || 'NOT SET'}`);
console.log(`  Location: ${process.env.GCP_LOCATION || 'NOT SET'}`);
console.log(`  Bucket: ${process.env.GCS_BUCKET || 'NOT SET'}`);
console.log(`  Embedding Model: ${process.env.EMBEDDING_MODEL || 'text-embedding-004 (default)'}`);

// Display API Setup Links
console.log('\n🔗 Enable Required APIs:');
console.log('\n  1. Vertex AI API:');
console.log(`     https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=${PROJECT_ID}`);
console.log('\n  2. Firestore API:');
console.log(`     https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${PROJECT_ID}`);
console.log('\n  3. Cloud Storage API:');
console.log(`     https://console.cloud.google.com/apis/library/storage.googleapis.com?project=${PROJECT_ID}`);

// Display Firestore Setup Link
console.log('\n💾 Create Firestore Database:');
console.log(`     https://console.cloud.google.com/firestore?project=${PROJECT_ID}`);

// Display Storage Setup Link
console.log('\n📦 Create Cloud Storage Bucket:');
console.log(`     https://console.cloud.google.com/storage/browser?project=${PROJECT_ID}`);

// Final Summary
console.log('\n' + '='.repeat(50));
if (envOk) {
  console.log('\n✅ Basic configuration looks good!');
  console.log('\n📝 Next Steps:');
  console.log('  1. Click the links above to enable APIs');
  console.log('  2. Create Firestore database (Native mode, us-central1)');
  console.log('  3. Create Cloud Storage bucket');
  console.log('  4. Run: npm start');
  console.log('\n📖 For detailed instructions, see: VECTOR_SEARCH_SETUP.md\n');
} else {
  console.log('\n❌ Configuration issues found!');
  console.log('\n📝 Action Required:');
  console.log('  1. Copy env.example to .env');
  console.log('  2. Fill in all required values');
  console.log('  3. Place service account key at: ./config/service-account-key.json');
  console.log('  4. Run this script again\n');
}

// Display How Vector Search Works
console.log('\n🎯 How Vector Search Works in Your Backend:\n');
console.log('  When users search:');
console.log('  ┌─────────────────────────────────────────┐');
console.log('  │ User Query: "happy moments with smile" │');
console.log('  └────────────────┬────────────────────────┘');
console.log('                   ↓');
console.log('  ┌────────────────────────────────────┐');
console.log('  │   Query Analyzer (Intelligent)     │');
console.log('  │   Decides: Vector or Traditional   │');
console.log('  └────────┬───────────────────┬───────┘');
console.log('           ↓                   ↓');
console.log('  ┌────────────────┐   ┌──────────────┐');
console.log('  │ Vector Search  │   │ Traditional  │');
console.log('  │ (Semantic)     │   │ (Filtered)   │');
console.log('  └────────┬───────┘   └──────┬───────┘');
console.log('           ↓                   ↓');
console.log('  ┌────────────────────────────────────┐');
console.log('  │   Merged & Ranked Results          │');
console.log('  └────────────────────────────────────┘\n');

console.log('  Vector Search Example:');
console.log('    ✅ "happy moments" → Semantic search');
console.log('    ✅ "people smiling energetically" → Semantic search');
console.log('\n  Traditional Search Example:');
console.log('    ✅ "campaign:abc123" → Filtered search');
console.log('    ✅ "product:iPhone" → Filtered search\n');

