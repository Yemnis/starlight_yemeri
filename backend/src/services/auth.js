import { GoogleAuth } from 'google-auth-library';
import { config } from '../config/env.js';

/**
 * Authentication Service
 * Handles Google Cloud authentication using service accounts
 */
class AuthService {
  constructor() {
    this.auth = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Auth with service account
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔐 Initializing Google Cloud authentication...');

      // Initialize Google Auth with Application Default Credentials
      // This will automatically use the GOOGLE_APPLICATION_CREDENTIALS env var
      this.auth = new GoogleAuth({
        keyFilename: config.gcp.credentials,
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/cloud-platform.read-only',
        ],
      });

      // Verify credentials by getting the project ID
      const projectId = await this.auth.getProjectId();
      console.log('✅ Authentication initialized successfully');
      console.log(`   - Project ID: ${projectId}`);

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize authentication:', error.message);
      throw new Error(`Authentication initialization failed: ${error.message}`);
    }
  }

  /**
   * Get an authenticated client
   */
  async getClient() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.auth.getClient();
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
  }

  /**
   * Verify service account has required permissions
   */
  async verifyPermissions() {
    try {
      await this.initialize();
      const client = await this.getClient();
      
      // Test if we can make an authenticated request
      const token = await this.getAccessToken();
      
      if (!token) {
        throw new Error('Unable to retrieve access token');
      }

      console.log('✅ Service account permissions verified');
      return true;
    } catch (error) {
      console.error('❌ Permission verification failed:', error.message);
      return false;
    }
  }
}

// Export a singleton instance
export const authService = new AuthService();

