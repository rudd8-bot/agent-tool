export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // APP_SECRET 검증
  const secret = req.headers['x-app-secret'];
  if (!secret || secret !== process.env.APP_SECRET) {
    return res.status(403).json({ error: '접근 권한이 없습니다.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await anthropicRes.json();
    if (!anthropicRes.ok) return res.status(anthropicRes.status).json(data);
    return res.status(200).json(data);
  } catch (err) {
    console.error('chat proxy error:', err.message);
    return res.status(500).json({ error: 'Proxy request failed' });
  }
}
