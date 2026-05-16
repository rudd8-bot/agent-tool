import { readFileSync } from 'fs';
import { join } from 'path';

function loadAgents() {
  const filePath = join(process.cwd(), 'models.json');
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  return Array.isArray(data) ? data : (data.agents || []);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: SSE 스트림 (Claude MCP 핸드셰이크) ──────────────
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    // MCP 표준 initialize 응답
    send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    send({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'agent-tool', version: '1.0.0' },
      },
    });

    // tools/list
    send({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          {
            name: 'get_models',
            description: '등록된 AI 에이전트 전체 목록 반환. 이름·강점·약점·단독/조합 사용법 포함.',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
          {
            name: 'get_model',
            description: '특정 AI 에이전트 상세 정보 반환.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '에이전트 ID (예: claude, chatgpt, manus, claudecode)' },
              },
              required: ['id'],
            },
          },
        ],
      },
    });

    const ping = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => clearInterval(ping));
    return;
  }

  // ── POST: JSON-RPC 2.0 요청 처리 ──────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const { jsonrpc, id, method, params } = body;

    const reply = (result) => res.status(200).json({ jsonrpc: '2.0', id, result });
    const replyErr = (code, message) =>
      res.status(200).json({ jsonrpc: '2.0', id, error: { code, message } });

    try {
      // initialize
      if (method === 'initialize') {
        return reply({
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'agent-tool', version: '1.0.0' },
        });
      }

      // tools/list
      if (method === 'tools/list') {
        return reply({
          tools: [
            {
              name: 'get_models',
              description: '등록된 AI 에이전트 전체 목록 반환. 이름·강점·약점·단독/조합 사용법 포함.',
              inputSchema: { type: 'object', properties: {}, required: [] },
            },
            {
              name: 'get_model',
              description: '특정 AI 에이전트 상세 정보 반환.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: '에이전트 ID (예: claude, chatgpt, manus, claudecode)' },
                },
                required: ['id'],
              },
            },
          ],
        });
      }

      // tools/call
      if (method === 'tools/call') {
        const toolName = params?.name;
        const toolInput = params?.arguments || {};
        const agents = loadAgents();

        if (toolName === 'get_models') {
          const summary = agents.map(m => ({
            id: m.id,
            name: m.name,
            tagName: m.tagName,
            role: m.role,
            best_for: m.best_for || [],
            avoid_for: m.avoid_for || [],
            strengths: m.strengths,
            weaknesses: m.weaknesses,
            alone: m.alone,
            combo: m.combo,
            combo_trigger: m.combo_trigger || null,
            warn: m.warn || null,
          }));
          return reply({
            content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
          });
        }

        if (toolName === 'get_model') {
          const { id } = toolInput;
          if (!id) return replyErr(-32602, 'id 파라미터가 필요합니다.');
          const model = agents.find(m => m.id === id);
          if (!model) return replyErr(-32602, `에이전트 ID "${id}"를 찾을 수 없습니다.`);
          return reply({
            content: [{ type: 'text', text: JSON.stringify(model, null, 2) }],
          });
        }

        return replyErr(-32601, `알 수 없는 툴: ${toolName}`);
      }

      // notifications (응답 불필요)
      if (method && method.startsWith('notifications/')) {
        return res.status(204).end();
      }

      return replyErr(-32601, `지원하지 않는 메서드: ${method}`);

    } catch (err) {
      console.error('MCP error:', err.message);
      return replyErr(-32603, 'Internal server error');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
