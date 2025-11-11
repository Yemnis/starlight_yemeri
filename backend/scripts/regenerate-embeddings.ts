/**
 * Regenerate embeddings for all scenes using the fixed Vertex AI API
 * This script deletes old (fallback) embeddings and creates new ones
 */
import { Firestore } from '@google-cloud/firestore';
import { config } from '../src/config';
import { EmbeddingService } from '../src/services/embedding.service';
import logger from '../src/utils/logger';
import { Scene } from '../src/types';

async function regenerateEmbeddings() {
  const firestore = new Firestore({
    projectId: config.gcp.projectId,
    databaseId: config.firestore.database,
  });

  const embeddingService = new EmbeddingService();

  try {
    // Get all scenes
    const scenesSnapshot = await firestore.collection('scenes').get();
    const totalScenes = scenesSnapshot.size;

    logger.info(`Found ${totalScenes} scenes to process`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const sceneDoc of scenesSnapshot.docs) {
      const scene = {
        id: sceneDoc.id,
        ...sceneDoc.data(),
      } as Scene;

      processed++;
      logger.info(`Processing scene ${processed}/${totalScenes}: ${scene.id}`);

      try {
        // Delete old embedding
        const oldEmbeddingId = `emb_${scene.id}`;
        try {
          await embeddingService.deleteEmbedding(oldEmbeddingId);
          logger.info(`Deleted old embedding for scene ${scene.id}`);
        } catch (err) {
          logger.warn(`No old embedding found for scene ${scene.id}`);
        }

        // Generate new embedding
        const { embeddingId } = await embeddingService.processScene(scene);

        succeeded++;
        logger.info(`✓ Successfully regenerated embedding for scene ${scene.id} (${succeeded}/${totalScenes})`);

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        failed++;
        logger.error(`✗ Failed to regenerate embedding for scene ${scene.id}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Embedding regeneration complete', {
      total: totalScenes,
      succeeded,
      failed,
    });

    process.exit(0);
  } catch (error) {
    logger.error('Fatal error during embedding regeneration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

regenerateEmbeddings();
