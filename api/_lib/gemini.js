const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const extractGeminiText = (body) =>
  body?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim() || '';

async function generateGeminiText({ prompt, systemInstruction }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Missing server GEMINI_API_KEY');
    err.statusCode = 503;
    throw err;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body?.error?.message || `Gemini request failed (${response.status})`);
    err.statusCode = response.status;
    throw err;
  }

  const text = extractGeminiText(body);

  if (!text) {
    const err = new Error('Gemini returned empty content');
    err.statusCode = 502;
    throw err;
  }

  return text;
}

module.exports = { generateGeminiText };
