/**
 * Re-seeds the Smart Match system defaults.
 * Run with: npx tsx scripts/reseed-smartmatch.mjs
 */
import { seedSmartMatchDefaults } from '../server/smartMatch.ts';

console.log("Seeding Smart Match defaults...");
await seedSmartMatchDefaults();
console.log("Done!");
process.exit(0);
