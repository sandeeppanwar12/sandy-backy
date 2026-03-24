const Database = require('better-sqlite3');

let db;

function initDB() {
  if (db) return db; // ✅ prevent re-init

  try {
    // ✅ Use in-memory DB (IMPORTANT for Vercel)
    db = new Database(':memory:');

    db.exec(`
      CREATE TABLE IF NOT EXISTS test (
        id INTEGER PRIMARY KEY,
        name TEXT
      )
    `);

    console.log('✅ In-memory DB initialized');
  } catch (err) {
    console.error('❌ DB Init Error:', err);
    throw err;
  }

  return db;
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { initDB, getDB };
