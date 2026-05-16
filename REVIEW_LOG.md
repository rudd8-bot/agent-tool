# agent-tool 코드 검토 기록

## 발견된 문제

| 파일 | 문제 내용 | 심각도 |
|------|----------|--------|
| `index.html` | `proceedSearch()`에서 Claude API `answer`를 `innerHTML`에 직접 삽입 — XSS 취약점 | 높음 |
| `index.html` | `doSearch()`에서 Claude API `summary`를 `confirmArea.innerHTML`에 직접 삽입 — XSS 취약점 | 높음 |
| `index.html` | `analyzeTask()`에서 Claude API `answer`를 `taResult.innerHTML`에 직접 삽입 — XSS 취약점 | 높음 |
| `updater.html` | `renderResults()`에서 Claude JSON 응답의 `a.source`를 `href` 속성에 검증 없이 삽입 — `javascript:` URL 주입 가능 | 높음 |
| `updater.html` | `renderUpdateItem()`에서 `item.evidence` URL들을 `href`에 검증 없이 삽입 — `javascript:` URL 주입 가능 | 높음 |
| `updater.html` | `renderUpdateItem()`에서 `item.agent_name`, `item.reason`, 필드값을 `innerHTML`에 비이스케이프 삽입 — XSS | 높음 |
| `updater.html` | `renderResults()` 신규 에이전트 패널에서 `a.name`, `a.summary`, `a.reason`, `a.best_for`를 비이스케이프 삽입 | 높음 |
| `index.html` | 에러 catch 블록에서 `e.message`를 `innerHTML`에 직접 삽입 — XSS 가능 | 중간 |
| `index.html` | `showHistory()` 모달에서 localStorage의 `item.query`, `item.result`를 `innerHTML`에 비이스케이프 삽입 | 중간 |
| `index.html` | `renderSingle()`에서 사용자 입력 `lastQuery`를 `innerHTML` ta-query에 직접 삽입 | 중간 |
| `api/chat.js` | `catch` 블록에서 `detail: err.message`를 응답에 포함 — 내부 오류(네트워크 등) 클라이언트 노출 | 중간 |
| `api/mcp.js` | `catch` 블록에서 `replyErr(-32603, err.message)` — 내부 오류 메시지(파일 경로 등) 클라이언트 노출 | 중간 |
| `vercel.json` | `functions` 설정 없음 — Vercel 기본 함수 timeout 10초. updater.html이 `max_tokens: 4000` + 웹검색으로 호출 시 timeout 발생 | 중간 |
| `index.html` | `saveSecret()` 후 `secretInput` 값 초기화 안 됨 — 패널 재오픈 시 이전 비밀번호 노출 | 낮음 |
| `updater.html` | 기존 `escHtml()`이 `"`, `'`를 이스케이프하지 않음 — 속성 컨텍스트에서 불완전한 보호 | 낮음 |
| `api/chat.js` | `req.body` 전체를 Anthropic API에 그대로 전달 — model, max_tokens, system prompt 등 임의 값 허용 | 낮음 |
| `api/mcp.js` | MCP 엔드포인트에 인증(x-app-secret) 없음 — 누구나 `get_models`, `get_model` 호출 가능 | 낮음 |

---

## 수정 내용

| 파일 | 수정 전 | 수정 후 | 이유 |
|------|--------|--------|------|
| `api/chat.js` | `res.status(500).json({ error: 'Proxy request failed', detail: err.message })` | `console.error(...)` 후 `{ error: 'Proxy request failed' }` | 내부 오류 메시지 클라이언트 노출 차단 |
| `api/mcp.js` | `replyErr(-32603, err.message)` | `console.error(...)` 후 `replyErr(-32603, 'Internal server error')` | 파일 경로 등 내부 정보 노출 차단 |
| `vercel.json` | `functions` 설정 없음 (기본 timeout 10초) | `"api/chat.js": { "maxDuration": 60 }`, `"api/mcp.js": { "maxDuration": 30 }` 추가 | updater 웹 검색 호출 timeout 방지, SSE 연결 유지 |
| `index.html` | `escHtml` 함수 없음 | 스크립트 최상단에 `escHtml(s)` 추가 (`&`, `<`, `>`, `"`, `'` 전체 이스케이프) | XSS 방어 기반 유틸 |
| `index.html` | `saveSecret()` — 저장 후 input 값 유지 | `document.getElementById('secretInput').value = ''` 추가 | 패널 재오픈 시 비밀번호 노출 방지 |
| `index.html` | `confirmArea.innerHTML`에 `${summary}` 직접 삽입 | `${escHtml(summary)}` | Claude 응답 XSS 방어 |
| `index.html` | `area.innerHTML`에 `${answer}` 직접 삽입 (검색 결과) | `${escHtml(answer)}` | Claude 응답 XSS 방어 |
| `index.html` | `area.innerHTML`에 `${e.message}` 직접 삽입 (에러) | `${escHtml(e.message)}` | 에러 메시지 XSS 방어 |
| `index.html` | `taResult.innerHTML`에 `${answer}` 직접 삽입 (작업 분석) | `${escHtml(answer)}` | Claude 응답 XSS 방어 |
| `index.html` | `taResult.innerHTML`에 `${e.message}` 직접 삽입 (에러) | `${escHtml(e.message)}` | 에러 메시지 XSS 방어 |
| `index.html` | `showHistory()` 모달에서 `${item.query}`, `${item.result}` 직접 삽입 | `${escHtml(item.query)}`, `${escHtml(item.result)}` | localStorage 데이터(사용자 입력+Claude 응답) XSS 방어 |
| `index.html` | `renderSingle()`에서 `${lastQuery.substring(...)}` 직접 삽입 | `${escHtml(lastQuery.substring(...))}` | 사용자 입력 XSS 방어 |
| `updater.html` | `escHtml(s)` — `&`, `<`, `>` 만 이스케이프, null 미처리 | `String(s\|\|'')` + `"` → `&quot;`, `'` → `&#x27;` 추가 | 속성 컨텍스트 완전 보호 |
| `updater.html` | `safeUrl` 함수 없음 | `safeUrl(url)` 추가 — `https:` / `http:` 외 프로토콜 시 `#` 반환 | `javascript:` URL 주입으로 인한 XSS 방어 |
| `updater.html` | `renderUpdateItem()` — `item.agent_name`, `item.reason`, 필드값, `item.evidence` href를 비이스케이프 삽입 | 모든 텍스트에 `escHtml()`, href에 `safeUrl()` + `rel="noopener noreferrer"` 적용 | Claude JSON 응답 XSS 및 URL 주입 방어 |
| `updater.html` | `renderResults()` 신규 에이전트 패널 — `a.name`, `a.summary`, `a.best_for`, `a.reason`, `a.source` 비이스케이프 삽입 | 모든 텍스트에 `escHtml()`, `a.source` href에 `safeUrl()` + `rel="noopener noreferrer"` 적용 | Claude JSON 응답 XSS 및 URL 주입 방어 |

---

## 수정 못한 것 (외부 확인 필요)

- **`api/chat.js` — req.body 무제한 전달**: `req.body` 전체를 Anthropic API에 그대로 전달해 APP_SECRET 보유자가 임의 model, max_tokens, system prompt 설정 가능. 내부 전용 서비스라면 허용 가능 범위지만, 외부 공개 서비스라면 model 화이트리스트 및 max_tokens 상한(예: 8,000) 추가 필요
- **`api/mcp.js` — MCP 엔드포인트 인증 없음**: `/api/mcp`는 `x-app-secret` 검증 없이 누구나 `get_models`, `get_model` 호출 가능. Claude Code 등 MCP 클라이언트가 커스텀 헤더를 보내지 않는 프로토콜 특성상 의도된 설계일 수 있으나, agent 데이터를 비공개로 운영하려면 추가 인증 계층 검토 필요
- **`api/models.js` — 인증 없음**: `/api/models`는 인증 없이 전체 models.json 공개. `/api/chat`은 인증 필요한데 models는 공개인 것이 의도된 설계인지 확인 필요
- **`index.html` `taActions.innerHTML` onclick 템플릿**: `answer.replace(/\`/g, "'")`로 백틱만 치환하지만 `${...}` 표현식이 onclick 문자열 평가 시 실행될 수 있음. Claude 응답을 data attribute + 이벤트 위임 방식으로 전달하도록 리팩터링 권장
- **`vercel.json` — 정적 파일 라우팅 설정 없음**: `index.html`, `updater.html`이 프로젝트 루트에 있어 Vercel 기본 정적 서빙으로 동작하고 있으나, 명시적인 `outputDirectory` 또는 static file 설정이 없으므로 Vercel 배포 구조 변경 시 누락 위험 있음
- **`updater.html` — `loadModels()` 에러 메시지 innerHTML 삽입**: `${e.message}`가 이스케이프 없이 표시되나, fetch 에러 메시지는 브라우저 생성 문자열이어서 실질적 XSS 위험은 낮음. 일관성을 위해 `escHtml(e.message)` 적용 권장
