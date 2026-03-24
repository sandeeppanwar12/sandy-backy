const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data.db');
const DATA_DIR = path.join(__dirname, '..', 'data');

let db;

function initDB() {
  const needsSeed = !fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  if (needsSeed) {
    console.log('🌱 Seeding database from JSONL files...');
    seedDatabase();
  } else {
    console.log('✅ Database already exists, skipping seed.');
  }
}

function seedDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error('❌ No data/ directory found. Place SAP JSONL folders inside backend/data/');
    return;
  }

  const dirs = fs.readdirSync(DATA_DIR).filter(d =>
    fs.statSync(path.join(DATA_DIR, d)).isDirectory()
  );

  for (const dir of dirs) {
    const records = [];
    const folder = path.join(DATA_DIR, dir);
    const files = fs.readdirSync(folder).filter(f => f.endsWith('.jsonl'));

    for (const file of files) {
      const lines = fs.readFileSync(path.join(folder, file), 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try { records.push(JSON.parse(trimmed)); } catch {}
      }
    }

    if (!records.length) continue;
    const cols = Object.keys(records[0]);
    const colDefs = cols.map(c => `"${c}" TEXT`).join(', ');
    db.exec(`DROP TABLE IF EXISTS "${dir}"`);
    db.exec(`CREATE TABLE "${dir}" (${colDefs})`);

    const placeholders = cols.map(() => '?').join(', ');
    const insert = db.prepare(`INSERT INTO "${dir}" VALUES (${placeholders})`);
    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        const vals = cols.map(c => {
          const v = row[c];
          return v === null || v === undefined ? null :
            typeof v === 'object' ? JSON.stringify(v) : String(v);
        });
        insert.run(vals);
      }
    });
    insertMany(records);
    console.log(`  ✓ ${dir}: ${records.length} rows`);
  }
}

function getDB() {
  return db;
}

module.exports = { initDB, getDB };
