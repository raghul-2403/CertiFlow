
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S., the assistant inside CertiFlow,
a college event and certificate management application.

Be helpful, accurate, concise, and professional.

CertiFlow manages events, feedback, certificates,
Google Forms synchronization, and email delivery.

Important rules:
- Never invent event statistics or participant records.
- You do not currently have access to live event data.
- Do not claim to have created, edited, or deleted anything.
- Help coordinators understand and plan their work.
- Never request passwords, API keys, or private credentials.
- If information is unavailable, say so clearly.
`;

async function requestJSON(url, key, body, provider) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider === 'groq'
          ? { Authorization: `Bearer ${key}` }
          : { 'x-goog-api-key': key }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${provider} HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function askGemini(messages) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) throw new Error('Gemini key missing');

  const data = await requestJSON(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    key,
    {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: messages.map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: 700,
      },
    },
    'gemini'
  );

  const answer = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (!answer) throw new Error('Gemini returned no text');

  return answer;
}

async function askGroq(messages) {
  const key = process.env.GROQ_API_KEY;

  if (!key) throw new Error('Groq key missing');

  const data = await requestJSON(
    'https://api.groq.com/openai/v1/chat/completions',
    key,
    {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(message => ({
          role: message.role,
          content: message.content,
        })),
      ],
      max_completion_tokens: 700,
    },
    'groq'
  );

  const answer = data.choices?.[0]?.message?.content?.trim();

  if (!answer) throw new Error('Groq returned no text');

  return answer;
}

export async function askJarvis(messages) {
  try {
    const reply = await askGemini(messages);
    return { reply, provider: 'gemini' };
  } catch (error) {
    console.warn(
      'J.A.R.V.I.S. primary provider unavailable:',
      error.message
    );
  }

  try {
    const reply = await askGroq(messages);
    return { reply, provider: 'groq' };
  } catch (error) {
    console.warn(
      'J.A.R.V.I.S. backup provider unavailable:',
      error.message
    );
  }

  throw new Error('Both AI providers are currently unavailable.');
}
