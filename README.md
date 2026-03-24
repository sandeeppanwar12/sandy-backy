# SAP O2C Backend

Express.js + SQLite backend for the SAP Order-to-Cash Graph System.

## Setup

```bash
npm install

# Place the SAP dataset folders inside backend/data/
# Structure: backend/data/sales_order_headers/*.jsonl, etc.

npm start
# Server runs on http://localhost:3001
```

## Environment Variables

None required. Uses Claude API through the frontend proxy.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check + table list |
| GET | /api/graph | Full graph nodes + edges |
| GET | /api/expand/:nodeId | Expand a node's neighbors |
| GET | /api/schema | DB schema for all tables |
| POST | /api/query | Natural language query |

### POST /api/query

```json
{
  "message": "Which customer has the most orders?",
  "history": []
}
```

Response:
```json
{
  "answer": "Customer Nelson, Fitzpatrick and Jordan (320000083) has the most orders with 45 sales orders.",
  "sql": "SELECT soldToParty, COUNT(*) as cnt FROM sales_order_headers GROUP BY soldToParty ORDER BY cnt DESC LIMIT 5",
  "rows": [...],
  "rowCount": 5,
  "highlightIds": ["bp_320000083"]
}
```
