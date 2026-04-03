const { generateGeminiText } = require('../_lib/gemini');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const text = await generateGeminiText({
      prompt: 'Generate one short, comforting, uplifting sentence suitable for someone experiencing memory loss.',
      systemInstruction: 'Return only one plain sentence, warm and reassuring.',
    });
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'AI quote request failed' });
  }
};
