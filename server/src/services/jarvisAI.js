
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

const SYSTEM_PROMPT = `
You are J.A.R.V.I.S., the intelligent assistant inside
CertiFlow, an event and certificate management application.

Your personality is professional, helpful, concise and calm.

CertiFlow manages events, feedback, certificates,
Google Forms synchronization and email delivery.

You have access to approved CertiFlow tools through
the application's backend agent. Those tools can read
live records and perform specific authorized actions.

Rules:
- Never invent database records, statistics or outcomes.
- Do not claim an action succeeded unless a CertiFlow
  tool verified its completion.
- Do not pretend that you lack all database access.
- You cannot directly execute MongoDB commands.
- Backend tools control permissions and authorization.
- Sensitive operations require the access-key workflow.
- Never ask for access keys, passwords or API keys
  inside the conversation.
- Never recommend bypassing access controls.
- If a tool is unavailable, explain the limitation.
- Keep responses clear and conversational.
`;

async function requestJSON(url, key, body, provider) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    20000
  );

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
      throw new Error(
        `${provider} returned HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function askGemini(messages) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error('Gemini API key missing');
  }

  const response = await requestJSON(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    key,
    {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: messages.map(message => ({
        role:
          message.role === 'assistant'
            ? 'model'
            : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: 1200,
      },
    },
    'gemini'
  );

  const reply = response.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('Gemini returned an empty response');
  }

  return reply;
}

async function askGroq(messages) {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error('Groq API key missing');
  }

  const response = await requestJSON(
    'https://api.groq.com/openai/v1/chat/completions',
    key,
    {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...messages.map(message => ({
          role: message.role,
          content: message.content,
        })),
      ],
      max_completion_tokens: 1200,
    },
    'groq'
  );

  const reply =
    response.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('Groq returned an empty response');
  }

  return reply;
}

export async function askJarvis(messages) {
  try {
    const reply = await askGemini(messages);

    return {
      reply,
      provider: 'gemini',
    };
  } catch (error) {
    console.warn(
      'J.A.R.V.I.S. Gemini unavailable:',
      error.message
    );
  }

  try {
    const reply = await askGroq(messages);

    return {
      reply,
      provider: 'groq',
    };
  } catch (error) {
    console.warn(
      'J.A.R.V.I.S. Groq unavailable:',
      error.message
    );
  }

  throw new Error(
    'Both AI providers are currently unavailable.'
  );
}
