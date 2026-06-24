import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

// Check if colors column already exists
const [colCheck] = await conn.execute("SHOW COLUMNS FROM posts LIKE 'colors'");
if (colCheck.length > 0) {
  console.log('ℹ colors column already exists');
} else {
  // TiDB: TEXT/JSON can't have default values — add nullable, handle in app layer
  try {
    await conn.execute("ALTER TABLE posts ADD COLUMN `colors` json NULL");
    console.log('✓ colors column added as json nullable');
  } catch (e) {
    console.error('colors json error:', e.message, '— trying text');
    try {
      await conn.execute("ALTER TABLE posts ADD COLUMN `colors` text NULL");
      console.log('✓ colors column added as text nullable');
    } catch (e2) {
      console.error('colors text error:', e2.message);
    }
  }
}

// Check serviceId
const [svcCheck] = await conn.execute("SHOW COLUMNS FROM posts LIKE 'serviceId'");
if (svcCheck.length > 0) {
  console.log('✓ serviceId column exists');
} else {
  try {
    await conn.execute("ALTER TABLE posts ADD COLUMN `serviceId` int NULL");
    console.log('✓ serviceId column added');
  } catch (e) {
    console.error('serviceId error:', e.message);
  }
}

await conn.end();
console.log('Done.');
