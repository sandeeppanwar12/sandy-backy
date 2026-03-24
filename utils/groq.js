const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(systemPrompt, userMessage, maxTokens = 1000) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Check your .env file.');
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })
  });

  if (!response.ok) {
    const err = await response.text();
    let parsed;
    try { parsed = JSON.parse(err); } catch { parsed = null; }
    const code = response.status;
    const msg = parsed?.error?.message || err;

    if (code === 429) throw new Error(`Groq rate limit hit. Please wait a moment and try again. (${msg})`);
    if (code === 401) throw new Error(`Invalid Groq API key. Please check GROQ_API_KEY in your .env file.`);
    throw new Error(`Groq API error (${code}): ${msg}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty response: ' + JSON.stringify(data));
  return text.trim();
}

module.exports = { callGroq, GROQ_MODEL };
