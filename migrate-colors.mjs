import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

// Add colors column (JSON array of strings)
try {
  await conn.execute("ALTER TABLE posts ADD COLUMN `colors` json NOT NULL DEFAULT ('[]')");
  console.log('✓ colors column added');
} catch (e) {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('ℹ colors column already exists');
  } else {
    console.error('colors error:', e.message);
  }
}

// Verify serviceId was added
try {
  const [rows] = await conn.execute("SHOW COLUMNS FROM posts LIKE 'serviceId'");
  if (rows.length > 0) {
    console.log('✓ serviceId column exists');
  } else {
    console.log('✗ serviceId column missing');
  }
} catch (e) {
  console.error('check error:', e.message);
}

// Verify colors was added
try {
  const [rows] = await conn.execute("SHOW COLUMNS FROM posts LIKE 'colors'");
  if (rows.length > 0) {
    console.log('✓ colors column exists');
  } else {
    console.log('✗ colors column missing — trying alternative syntax');
    await conn.execute("ALTER TABLE posts ADD COLUMN `colors` text NOT NULL DEFAULT '[]'");
    console.log('✓ colors column added as text');
  }
} catch (e) {
  console.error('verify error:', e.message);
}

await conn.end();
console.log('Migration complete.');
