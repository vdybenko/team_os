import { migrateToS3 } from './store.js';

try {
  const counts = await migrateToS3({ from: process.argv[2] });
  console.log(JSON.stringify(counts));
} catch (error) {
  console.error(error.$metadata ? `S3 migration failed: ${error.name} (HTTP ${error.$metadata.httpStatusCode})` : error.message);
  process.exitCode = 1;
}
