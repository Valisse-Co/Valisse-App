import { getDb } from '../server/db.ts';
import { smartMatchConfigs } from '../drizzle/schema.ts';
import { isNull } from 'drizzle-orm';

const db = await getDb();
const rows = await db.select({ id: smartMatchConfigs.id, cat: smartMatchConfigs.serviceCategory }).from(smartMatchConfigs).where(isNull(smartMatchConfigs.techId));
console.log("Seeded categories:", rows.map(r => `${r.id}: ${r.cat}`).join('\n'));
process.exit(0);
