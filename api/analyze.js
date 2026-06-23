const SUPABASE_URL = 'https://imaoejyuqkmhfepqrrjk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function dbRequest(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method === 'POST' ? 'return=minimal' : ''
    },
    body: body ? JSON.stringify(body) : null
  });
  if (method === 'GET') return res.json();
  return res;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, session } = req.query;

  // GET — leer sesión (presentador)
  if (req.method === 'GET' && action === 'read') {
    const entries = await dbRequest(`entries?session=eq.${session}&order=ts.asc`);
    return res.status(200).json(entries);
  }

  // POST — analizar y guardar (participante)
  if (req.method === 'POST' && action === 'analyze') {
    const { phrase } = req.body;
    if (!phrase) return res.status(400).json({ error: 'Falta phrase' });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Eres un analizador de sentimientos. Analiza el siguiente texto y responde ÚNICAMENTE con un objeto JSON válido, sin backticks ni texto extra:
{"sentimiento":"positivo|negativo|neutro|mixto|sorpresa","confianza":0-100,"emocion":"emoción en español","intensidad":"baja|media|alta","palabras_clave":["array"],"razon":"explicación breve en español"}
Texto: ${phrase}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        })
      }
    );
    const geminiData = await geminiRes.json();
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());

    await dbRequest('entries', 'POST', { session, phrase, analysis, ts: Date.now() });
    return res.status(200).json(analysis);
  }

  // POST — limpiar sesión
  if (req.method === 'POST' && action === 'clear') {
    await dbRequest(`entries?session=eq.${session}`, 'DELETE');
    return res.status(200).json({ ok: true });
  }

  res.status(400).json({ error: 'Acción no válida' });
}
