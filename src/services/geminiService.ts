const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || '/api/ai').replace(/\/$/, '');

export const missingApiKeyError = 'AI features are unavailable right now. Configure GEMINI_API_KEY on the server and restart.';
export const isGeminiConfigured = true;

const callAiEndpoint = async (
  path: string,
  payload: Record<string, unknown>,
  timeoutMs: number = 12000
): Promise<string> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AI_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (typeof body?.error === 'string') {
        throw new Error(body.error);
      }
      throw new Error(`AI request failed (${response.status})`);
    }

    if (typeof body?.text !== 'string' || !body.text.trim()) {
      throw new Error('AI service returned an empty response.');
    }

    return body.text;
  } finally {
    clearTimeout(timer);
  }
};

export const getAICompanionChatResponse = async (prompt: string): Promise<string> => {
  try {
    return await callAiEndpoint('/companion', { prompt });
  } catch (error) {
    console.error('Error getting AI response:', error);
    return "I'm sorry, I seem to be having a little trouble thinking right now. Let's try again in a moment.";
  }
};

export const getAIComfortingQuote = async (): Promise<string> => {
  try {
    return await callAiEndpoint('/quote', {});
  } catch (error) {
    console.error('Error getting AI quote:', error);
    return 'Every day is a new beginning.';
  }
};
