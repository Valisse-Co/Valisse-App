import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

// Check if colors column already exists
const [colCheck] = await conn.execute("SHOW COLUMNS FROM posts LIKE 'colors'");
if (colCheck.length > 0) {
  console.log('ℹ colors column already exists');
} else {
  // TiDB: use text with default '[]' (no JSON_ARRAY() function)
  try {
    await conn.execute("ALTER TABLE posts ADD COLUMN `colors` text NOT NULL DEFAULT '[]'");
    console.log('✓ colors column added as text');
  } catch (e) {
    console.error('colors error:', e.message);
  }
}

// Check serviceId
const [svcCheck] = await conn.execute("SHOW COLUMNS FROM posts LIKE 'serviceId'");
if (svcCheck.length > 0) {
  console.log('✓ serviceId column exists');
} else {
  try {
    await conn.execute("ALTER TABLE posts ADD COLUMN `serviceId` int");
    console.log('✓ serviceId column added');
  } catch (e) {
    console.error('serviceId error:', e.message);
  }
}

await conn.end();
console.log('Done.');
