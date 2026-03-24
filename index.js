const express = require('express');
const cors = require('cors');

// Load .env
try { require('dotenv').config(); } catch {}

const { initDB } = require('./db/database');
const apiRoutes = require('./routes/api');
const { GROQ_MODEL } = require('./utils/groq');

const app = express();
app.use(cors());
app.use(express.json());

// Mount all API routes
app.use('/api', apiRoutes);

// Start
const PORT = process.env.PORT || 3001;
initDB();
// app.listen(PORT, () => {
//   console.log(`\n🚀 SAP O2C Backend running on http://localhost:${PORT}`);
//   console.log(`   LLM : Groq (${GROQ_MODEL})`);
//   console.log(`   GET  /api/health`);
//   console.log(`   GET  /api/graph`);
//   console.log(`   GET  /api/schema`);
//   console.log(`   POST /api/query`);
//   console.log(`   GET  /api/expand/:nodeId\n`);
// });
