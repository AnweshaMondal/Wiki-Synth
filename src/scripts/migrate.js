const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Database migration script
 * Handles database schema changes and data migrations
 */

const migrations = [
  {
    version: '2.0.0',
    description: 'Add enhanced user fields and subscription data',
    up: async () => {
      // Add default subscription data to existing users
      await mongoose.connection.collection('users').updateMany(
        { subscription: { $exists: false } },
        {
          $set: {
            subscription: {
              plan: 'free',
              status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            preferences: {
              defaultSummaryStyle: 'wikipedia',
              defaultSummaryLength: 'medium',
              language: 'english',
              emailNotifications: {
                marketing: true,
                security: true,
                usage: true
              }
            },
            usage: {
              totalCalls: 0,
              monthlyReset: new Date(),
              monthlyCalls: 0
            }
          }
        }
      );
      logger.info('Updated existing users with new subscription fields');
    },
    down: async () => {
      // Remove new fields if rollback needed
      await mongoose.connection.collection('users').updateMany(
        {},
        {
          $unset: {
            subscription: '',
            preferences: '',
            usage: ''
          }
        }
      );
      logger.info('Removed subscription fields from users');
    }
  },
  {
    version: '2.0.1',
    description: 'Update API call schema with new tracking fields',
    up: async () => {
      // Add default values for new API call fields
      await mongoose.connection.collection('apicalls').updateMany(
        { responseStatus: { $exists: false } },
        {
          $set: {
            responseStatus: 'success',
            method: 'POST',
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          }
        }
      );
      logger.info('Updated existing API calls with new tracking fields');
    },
    down: async () => {
      await mongoose.connection.collection('apicalls').updateMany(
        {},
        {
          $unset: {
            responseStatus: '',
            method: '',
            tokensUsed: '',
            requestData: '',
            responseTime: '',
            responseSize: ''
          }
        }
      );
      logger.info('Removed new tracking fields from API calls');
    }
  }
];

/**
 * Get current database version
 */
async function getCurrentVersion() {
  try {
    const result = await mongoose.connection.collection('migrations').findOne(
      {},
      { sort: { version: -1 } }
    );
    return result ? result.version : '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

/**
 * Record migration in database
 */
async function recordMigration(migration) {
  await mongoose.connection.collection('migrations').insertOne({
    version: migration.version,
    description: migration.description,
    executedAt: new Date()
  });
}

/**
 * Run pending migrations
 */
async function runMigrations() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const currentVersion = await getCurrentVersion();
    logger.info(`Current database version: ${currentVersion}`);

    const pendingMigrations = migrations.filter(
      migration => migration.version > currentVersion
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Running ${pendingMigrations.length} migration(s)`);

    for (const migration of pendingMigrations) {
      logger.info(`Running migration ${migration.version}: ${migration.description}`);
      
      try {
        await migration.up();
        await recordMigration(migration);
        logger.info(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        logger.error(`Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    logger.info('All migrations completed successfully');

  } catch (error) {
    logger.error('Migration process failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Rollback to specific version
 */
async function rollbackToVersion(targetVersion) {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const currentVersion = await getCurrentVersion();
    logger.info(`Current database version: ${currentVersion}`);

    if (targetVersion >= currentVersion) {
      logger.info('Target version is not older than current version');
      return;
    }

    const migrationsToRollback = migrations
      .filter(migration => migration.version > targetVersion && migration.version <= currentVersion)
      .reverse(); // Rollback in reverse order

    if (migrationsToRollback.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    logger.info(`Rolling back ${migrationsToRollback.length} migration(s)`);

    for (const migration of migrationsToRollback) {
      logger.info(`Rolling back migration ${migration.version}: ${migration.description}`);
      
      try {
        if (migration.down) {
          await migration.down();
        }
        
        // Remove migration record
        await mongoose.connection.collection('migrations').deleteOne({
          version: migration.version
        });
        
        logger.info(`Migration ${migration.version} rolled back successfully`);
      } catch (error) {
        logger.error(`Rollback of migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    logger.info('Rollback completed successfully');

  } catch (error) {
    logger.error('Rollback process failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const targetVersion = process.argv[3];

  switch (command) {
    case 'up':
      runMigrations().catch(process.exit);
      break;
    case 'down':
      if (!targetVersion) {
        console.error('Target version required for rollback');
        process.exit(1);
      }
      rollbackToVersion(targetVersion).catch(process.exit);
      break;
    default:
      console.log('Usage:');
      console.log('  node migrate.js up              - Run pending migrations');
      console.log('  node migrate.js down <version>  - Rollback to specific version');
      process.exit(1);
  }
}

module.exports = {
  runMigrations,
  rollbackToVersion,
  getCurrentVersion
};
