import { readFileSync } from 'fs';
import { join } from 'path';

function loadModels() {
  const filePath = join(process.cwd(), 'models.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

const MCP_INFO = {
  name: 'agent-tool',
  version: '1.0.0',
  description: 'AI 에이전트 비교 도구 — 모델 데이터 조회',
};

const TOOLS = [
  {
    name: 'get_models',
    description: '등록된 AI 에이전트 전체 목록을 반환합니다. 각 모델의 이름, 유형, 강점, 약점, 단독/조합 사용법을 포함합니다.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_model',
    description: '특정 AI 에이전트의 상세 정보를 반환합니다. 페르소나, 의견, 경고 포함.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '모델 ID. 예: claude, chatgpt, perplexity, gemini, manus, genspark_ws, genspark_ai, operator, claudecode',
        },
      },
      required: ['id'],
    },
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // SSE endpoint (GET) — MCP handshake
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send server info
    res.write(`data: ${JSON.stringify({ type: 'server_info', ...MCP_INFO })}\n\n`);
    // Send tools list
    res.write(`data: ${JSON.stringify({ type: 'tools_list', tools: TOOLS })}\n\n`);

    // Keep alive ping every 20s
    const ping = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    }, 20000);

    req.on('close', () => clearInterval(ping));
    return;
  }

  // POST — tool call
  if (req.method === 'POST') {
    const { tool, input = {} } = req.body || {};

    if (!tool) {
      return res.status(400).json({ error: 'tool 필드가 필요합니다.' });
    }

    try {
      const models = loadModels();

      if (tool === 'get_models') {
        const summary = models.map(m => ({
          id: m.id,
          name: m.name,
          tagName: m.tagName,
          role: m.role,
          strengths: m.strengths,
          weaknesses: m.weaknesses,
          alone: m.alone,
          combo: m.combo,
          warn: m.warn || null,
        }));
        return res.status(200).json({ result: summary });
      }

      if (tool === 'get_model') {
        const { id } = input;
        if (!id) return res.status(400).json({ error: 'input.id가 필요합니다.' });
        const model = models.find(m => m.id === id);
        if (!model) return res.status(404).json({ error: `모델 ID "${id}"를 찾을 수 없습니다.` });
        return res.status(200).json({ result: model });
      }

      return res.status(404).json({ error: `알 수 없는 툴: ${tool}` });

    } catch (err) {
      console.error('MCP handler error:', err);
      return res.status(500).json({ error: 'MCP 처리 중 오류', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
