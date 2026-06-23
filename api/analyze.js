export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { phrase } = req.body;
    if (!phrase) return res.status(400).json({ error: 'Falta el campo phrase' });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Eres un analizador de sentimientos. Analiza el siguiente texto y responde ÚNICAMENTE con un objeto JSON válido, sin backticks ni texto extra, con exactamente estos campos:
{"sentimiento":"positivo|negativo|neutro|mixto|sorpresa","confianza":0-100,"emocion":"emoción principal en español","intensidad":"baja|media|alta","palabras_clave":["array","de","palabras"],"razon":"explicación breve en español"}

Texto a analizar: ${phrase}`
            }]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        })
      }
    );

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.status(200).json(analysis);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
