import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await createConnection(url);

try {
  // Step 1: rename old slotDate column to avoid conflict
  await conn.query("ALTER TABLE last_minute_slots CHANGE slotDate slotDateOld TIMESTAMP NOT NULL");
  console.log("✓ renamed slotDate → slotDateOld");

  // Step 2: add new columns
  await conn.query("ALTER TABLE last_minute_slots ADD COLUMN slotDate VARCHAR(10) NOT NULL DEFAULT '' AFTER techId");
  await conn.query("ALTER TABLE last_minute_slots ADD COLUMN startTime VARCHAR(5) NOT NULL DEFAULT '09:00' AFTER slotDate");
  await conn.query("ALTER TABLE last_minute_slots ADD COLUMN endTime VARCHAR(5) NOT NULL DEFAULT '17:00' AFTER startTime");
  await conn.query("ALTER TABLE last_minute_slots ADD COLUMN isPushed TINYINT(1) NOT NULL DEFAULT 0 AFTER note");
  await conn.query("ALTER TABLE last_minute_slots ADD COLUMN expiresAt BIGINT NOT NULL DEFAULT 0 AFTER isPushed");
  console.log("✓ added new columns");

  // Step 3: migrate existing data (convert old timestamp to date string)
  await conn.query(`
    UPDATE last_minute_slots
    SET
      slotDate = DATE_FORMAT(slotDateOld, '%Y-%m-%d'),
      startTime = DATE_FORMAT(slotDateOld, '%H:%i'),
      endTime = DATE_FORMAT(DATE_ADD(slotDateOld, INTERVAL duration MINUTE), '%H:%i'),
      expiresAt = UNIX_TIMESTAMP(DATE_ADD(slotDateOld, INTERVAL duration MINUTE)) * 1000
  `);
  console.log("✓ migrated existing rows");

  // Step 4: drop old columns
  await conn.query("ALTER TABLE last_minute_slots DROP COLUMN slotDateOld, DROP COLUMN duration, DROP COLUMN isBooked");
  console.log("✓ dropped old columns");

  // Step 5: verify
  const [rows] = await conn.query("DESCRIBE last_minute_slots");
  console.log("Final schema:", rows.map(r => r.Field).join(", "));
} catch (e) {
  console.error("Migration error:", e.message);
} finally {
  await conn.end();
}
