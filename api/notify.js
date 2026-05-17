// api/notify.js
// 카카오톡 나에게 보내기 알림 엔드포인트
// 사용: POST /api/notify { "step": 5, "message": "설계서 검토 필요" }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.KAKAO_ACCESS_TOKEN;
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'KAKAO_ACCESS_TOKEN 환경변수 없음' });
  }

  const { step, message } = req.body;

  const stepLabels = {
    5: '5단계: 설계서 검토 필요',
    9: '9단계: 루프 판단 필요'
  };

  const text = message || stepLabels[step] || `${step}단계 도달`;
  const fullText = `🔔 워크플로우 알림\n\n${text}\n\n지금 확인하세요.`;

  // 1차: 현재 토큰으로 시도
  let result = await sendKakaoMessage(accessToken, fullText);

  // 토큰 만료 시 리프레시 후 재시도
  if (result.status === 401 && refreshToken) {
    const newToken = await refreshAccessToken(refreshToken);
    if (newToken) {
      result = await sendKakaoMessage(newToken, fullText);
    }
  }

  if (result.ok) {
    return res.status(200).json({ success: true, message: '카카오톡 발송 완료' });
  } else {
    return res.status(500).json({ error: '카카오톡 발송 실패', detail: result.body });
  }
}

async function sendKakaoMessage(token, text) {
  const templateObject = JSON.stringify({
    object_type: 'text',
    text: text,
    link: { web_url: 'https://agent-tool-seven.vercel.app' }
  });

  const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `template_object=${encodeURIComponent(templateObject)}`
  });

  const body = await response.json();
  return { ok: response.ok, status: response.status, body };
}

async function refreshAccessToken(refreshToken) {
  const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;

  if (!REST_API_KEY) return null;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: REST_API_KEY,
    refresh_token: refreshToken,
    ...(CLIENT_SECRET && { client_secret: CLIENT_SECRET })
  });

  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token || null;
}
