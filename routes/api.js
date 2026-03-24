const express = require('express');
const router = express.Router();

const { buildGraph, expandNode } = require('../controllers/graphController');
const { handleQuery } = require('../controllers/queryController');
const { getDB } = require('../db/database');
const { GROQ_MODEL } = require('../utils/groq');

// Health check
router.get('/health', (req, res) => {
  const db = getDB();
  res.json({
    status: 'ok',
    llm: 'groq',
    model: GROQ_MODEL,
    tables: db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name)
  });
});

// Full graph data
router.get('/graph', (req, res) => {
  try {
    res.json(buildGraph());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Expand a single node
router.get('/expand/:nodeId', (req, res) => {
  try {
    res.json(expandNode(req.params.nodeId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Schema info
router.get('/schema', (req, res) => {
  try {
    const db = getDB();
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    const schema = {};
    for (const { name } of tables) {
      const cols = db.prepare(`PRAGMA table_info("${name}")`).all();
      const count = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get().c;
      schema[name] = { columns: cols.map(c => c.name), count };
    }
    res.json(schema);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LLM-powered natural language query
router.post('/query', handleQuery);

module.exports = router;
