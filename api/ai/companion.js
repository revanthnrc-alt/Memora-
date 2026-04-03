const { generateGeminiText } = require('../_lib/gemini');

const companionSystemInstruction = `You are Digi, an AI companion for a person with dementia. Your core purpose is to provide comfort, gentle engagement, and a sense of calm. Follow these rules strictly:
1. Personality: Be extremely patient, friendly, positive, and reassuring. Always use a gentle and warm tone.
2. Simplicity: Keep responses very short and use simple everyday words.
3. Patience: If users repeat themselves, respond kindly as if it is the first time.
4. Empathy: Validate feelings gently and avoid harsh corrections.
5. Encouragement: Do not test memory; offer gentle prompts and reassuring questions.
6. Engagement: Ask one simple supportive question at a time.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const prompt = `${req.body?.prompt || ''}`.trim();
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const text = await generateGeminiText({ prompt, systemInstruction: companionSystemInstruction });
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'AI companion request failed' });
  }
};
