/**
 * GCP Setup Script
 * Automates creation of required GCP resources
 */
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';

dotenv.config();

const PROJECT_ID = process.env.GCP_PROJECT_ID!;
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const BUCKET_NAME = process.env.GCS_BUCKET!;

async function setupGCP() {
  console.log('Starting GCP setup...');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Location: ${LOCATION}`);

  try {
    // 1. Setup Cloud Storage
    console.log('\n1. Setting up Cloud Storage...');
    const storage = new Storage({ projectId: PROJECT_ID });

    const [bucketExists] = await storage.bucket(BUCKET_NAME).exists();
    if (!bucketExists) {
      await storage.createBucket(BUCKET_NAME, {
        location: LOCATION,
        storageClass: 'STANDARD',
      });
      console.log(`✓ Bucket created: ${BUCKET_NAME}`);
    } else {
      console.log(`✓ Bucket already exists: ${BUCKET_NAME}`);
    }

    // Set CORS configuration
    await storage.bucket(BUCKET_NAME).setCorsConfiguration([
      {
        origin: ['*'],
        method: ['GET', 'HEAD'],
        responseHeader: ['Content-Type'],
        maxAgeSeconds: 3600,
      },
    ]);
    console.log('✓ CORS configured');

    // Set lifecycle policy
    await storage.bucket(BUCKET_NAME).setMetadata({
      lifecycle: {
        rule: [
          {
            action: { type: 'Delete' },
            condition: { age: 90 },
          },
        ],
      },
    });
    console.log('✓ Lifecycle policy configured (90 days)');

    // 2. Setup Firestore
    console.log('\n2. Setting up Firestore...');
    const firestore = new Firestore({ projectId: PROJECT_ID });

    // Test connection
    await firestore.collection('_setup_test').doc('test').set({ timestamp: new Date() });
    await firestore.collection('_setup_test').doc('test').delete();
    console.log('✓ Firestore connected and working');

    // 3. Vertex AI Setup
    console.log('\n3. Verifying Vertex AI access...');
    const vertexai = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });

    // Test Vertex AI access
    const model = vertexai.getGenerativeModel({ model: 'gemini-1.5-pro' });
    console.log('✓ Vertex AI configured');

    console.log('\n✅ GCP setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Create a Vertex AI Vector Search index (see documentation)');
    console.log('2. Update VECTOR_INDEX_ID and VECTOR_INDEX_ENDPOINT in .env');
    console.log('3. Run: npm install');
    console.log('4. Run: npm run dev');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

setupGCP();
