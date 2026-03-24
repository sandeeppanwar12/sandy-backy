const { callGroq } = require('../utils/groq');
const { getSchemaContext } = require('../db/schema');
const { getDB } = require('../db/database');

const SQL_SYSTEM_PROMPT = `You are a SQL analyst for an SAP Order-to-Cash (O2C) system.
Your ONLY job is to answer questions about the following SQLite database.

DATABASE SCHEMA:
{SCHEMA}

RELATIONSHIP GUIDE:
- business_partners.businessPartner = sales_order_headers.soldToParty (customer who placed the order)
- business_partners.businessPartner = billing_document_cancellations.soldToParty
- sales_order_headers.salesOrder = sales_order_items.salesOrder
- sales_order_items.material = product_descriptions.product
- sales_order_items.productionPlant = plants.plant
- billing_document_cancellations.accountingDocument = payments_accounts_receivable.accountingDocument
- payments_accounts_receivable.clearingAccountingDocument = journal_entry_items_accounts_receivable.accountingDocument
- billing_document_cancellations.soldToParty = business_partners.businessPartner

RULES:
1. You MUST respond ONLY with valid JSON — no markdown, no code fences, no extra text.
   Exact format: { "sql": "SELECT ...", "answer_template": "brief explanation" }
2. If the question is NOT about this SAP O2C dataset, respond with:
   { "error": "This system only answers questions about the SAP Order-to-Cash dataset." }
3. Use only table names listed in the schema. Never invent tables.
4. Always use double quotes around table names that contain underscores.
5. Always include a LIMIT (max 50) unless the user asks for counts.
6. For "trace flow" questions, use JOINs to connect the full chain.
7. Never answer general knowledge or off-topic questions.`;

const SUMMARY_SYSTEM_PROMPT = `You are a concise data analyst. Answer questions directly based on SQL query results.
Be specific with numbers and names. Never add commentary outside of answering the question directly.`;

async function queryWithLLM(userMessage, history = []) {
  const schema = getSchemaContext();
  const systemWithSchema = SQL_SYSTEM_PROMPT.replace('{SCHEMA}', schema);

  let fullUserMessage = userMessage;
  if (history.length > 0) {
    const historyText = history
      .slice(-6)
      .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n');
    fullUserMessage = `Prior conversation:\n${historyText}\n\nCurrent question: ${userMessage}`;
  }

  const rawText = await callGroq(systemWithSchema, fullUserMessage, 1000);

  // Strip markdown code fences just in case
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM did not return valid JSON. Got: ' + rawText);

  return JSON.parse(jsonMatch[0]);
}

async function handleQuery(req, res) {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const llmResult = await queryWithLLM(message, history);

    if (llmResult.error) {
      return res.json({ answer: llmResult.error, isGuardrail: true, sql: null, rows: [] });
    }

    const { sql } = llmResult;
    const db = getDB();

    let rows = [];
    let execError = null;
    try {
      rows = db.prepare(sql).all();
    } catch (e) {
      execError = e.message;
    }

    if (execError) {
      return res.json({
        answer: `I generated a query but it failed to execute: ${execError}`,
        sql,
        rows: [],
        error: execError
      });
    }

    const summaryPrompt = `The user asked: "${message}"
SQL executed: ${sql}
Total rows returned: ${rows.length}
First 10 rows:
${JSON.stringify(rows.slice(0, 10), null, 2)}

Provide a clear, concise natural language answer. Be specific with numbers and names.
If no rows returned, say "No records found matching that criteria."`;

    const naturalAnswer = await callGroq(SUMMARY_SYSTEM_PROMPT, summaryPrompt, 600);

    const highlightIds = new Set();
    for (const row of rows) {
      if (row.salesOrder)         highlightIds.add(`so_${row.salesOrder}`);
      if (row.soldToParty)        highlightIds.add(`bp_${row.soldToParty}`);
      if (row.businessPartner)    highlightIds.add(`bp_${row.businessPartner}`);
      if (row.billingDocument)    highlightIds.add(`bill_${row.billingDocument}`);
      if (row.deliveryDocument)   highlightIds.add(`del_${row.deliveryDocument}`);
      if (row.accountingDocument) highlightIds.add(`pay_${row.accountingDocument}`);
      if (row.material)           highlightIds.add(`mat_${row.material}`);
    }

    res.json({
      answer: naturalAnswer,
      sql,
      rows: rows.slice(0, 50),
      rowCount: rows.length,
      highlightIds: Array.from(highlightIds),
    });

  } catch (e) {
    console.error('Query error:', e);
    const msg = e.message || 'Unknown error';
    const status = msg.includes('429') ? 429 : msg.includes('401') ? 401 : 500;
    res.status(status).json({ error: msg });
  }
}

module.exports = { handleQuery };
