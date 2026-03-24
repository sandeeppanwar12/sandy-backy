const { getDB } = require('./database');

function getSchemaContext() {
  const db = getDB();
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
  const lines = [];
  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all();
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get().c;
    const colNames = cols.map(c => c.name).join(', ');
    lines.push(`${name} (${count} rows) → columns: ${colNames}`);
  }
  return lines.join('\n');
}

module.exports = { getSchemaContext };
