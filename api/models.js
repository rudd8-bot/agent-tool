import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = join(process.cwd(), 'models.json');
    const data = readFileSync(filePath, 'utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(JSON.parse(data));
  } catch (err) {
    console.error('models.json read error:', err);
    return res.status(500).json({ error: 'Failed to load models data' });
  }
}
