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

      const geminiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://jvelasvar.github.io/sentiment'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [{
          role: 'user',
          content: `Eres un API que solo devuelve JSON. Sin texto adicional, sin markdown, sin backticks.

Analiza el sentimiento de este texto: "${phrase}"

Devuelve exactamente este formato JSON:
{"sentimiento":"positivo","confianza":85,"emocion":"alegría","intensidad":"alta","palabras_clave":["palabra1","palabra2"],"razon":"explicación breve"}

Valores para sentimiento: positivo, negativo, neutro, mixto, sorpresa
Valores para intensidad: baja, media, alta
confianza: número 0-100`
        }],
        temperature: 0.1,
        max_tokens: 300
      })
    });
    const geminiData = await geminiRes.json();
    console.log('OpenRouter raw:', JSON.stringify(geminiData));
    const raw = geminiData.choices?.[0]?.message?.content || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    console.log('Clean JSON:', clean);
    let analysis;
    try {
      analysis = JSON.parse(clean);
    } catch(parseErr) {
      console.error('Parse error:', parseErr, 'Raw:', clean);
      return res.status(500).json({ error: 'Error al parsear respuesta', raw: clean });
    }

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

export const config = { api: { bodyParser: true } };
