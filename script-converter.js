// ============================================================
// 중국어 자막 → 한국 4050 타깃 15초 홈쇼핑 대본 변환기
// (script-converter.js)
//
// 사용법:
//   1) 아래 PROVIDER 선택 + API 키 입력
//   2) 단독 테스트:  node script-converter.js
//   3) 서버 연동:    파일 맨 아래 주석 코드를 server.js에 붙이기
// 필요 환경: Node.js 18 이상
// ============================================================

// ── 1. 설정 (여기만 수정하면 됩니다) ──
const PROVIDER = 'gemini'; // 'gemini' 또는 'openai'

const GEMINI_API_KEY = 'AIzaSyB2q7ljRzuN_sVZPAjpqP8JcnlqJcs3KrQ'; // https://aistudio.google.com 무료 발급
const OPENAI_API_KEY = '여기에_OPENAI_키_입력'; // https://platform.openai.com 발급

const GEMINI_MODEL = 'gemini-1.5-pro'; // 고품질 카피라이팅용 (2026년 기준)
const OPENAI_MODEL = 'gpt-4o';           // 최고 품질 모델
const TEMPERATURE = 0.8;                 // 매번 비슷한 결과를 원하면 0.3~0.5로 낮추세요

// ── 2. 시스템 프롬프트 (대본 품질의 핵심) ──
const SYSTEM_PROMPT = `당신은 TV홈쇼핑 쇼호스트 출신 20년 경력의 숏폼 광고 카피라이터입니다.
Whisper로 자동 추출한 중국어 상품 영상 자막을 받아, 한국 4050 시청자를 위한 15초 홈쇼핑 스타일 쇼츠 대본으로 변환합니다.

[1. 입력 자막 정제 규칙]
- 입력은 자동 추출 자막이라 오탈자, 반복 문장, 의미 없는 감탄사가 섞여 있습니다. 상품 정보만 골라내세요.
- 무시할 것: 인사말, 라이브커머스 멘트(家人们, 关注, 点赞, 福利, 老铁 등), 개인 잡담, 방송 이벤트 안내
- 추출할 것: 상품명, 소재/재질, 크기/용량, 핵심 기능, 사용 장면, 사용 효과
- 중국 현지 정보는 절대 대본에 넣지 마세요: 위안화 가격, 타오바오/도우인/핀둬둬 언급, 중국 배송·사은품 정보

[2. 타깃 화법: 한국 4050]
- 톤: 신뢰감 있는 존댓말 + 옆집 언니가 진심으로 추천하는 친근함. TV홈쇼핑 쇼호스트 말투.
- 잘 반응하는 키워드: 살림 효율, 시간 절약, 건강, 우리 가족, 가성비, "하나 장만해두면", "이 가격이면"
- 금지: 영어 신조어, MZ 유행어, 어려운 외래어. 초등학생도 알아듣는 쉬운 우리말만 사용합니다.
- 공감 화법 활용: "이런 경험 다들 있으시죠?", "저도 써보고 놀랐어요"

[3. 15초 4단 구조와 글자 수 (엄격히 지킬 것)]
① hook (0~3초, 15~25자): 스크롤을 멈추게 하는 첫 문장. 문제 제기, 놀라운 결과, 질문 중 하나. 이 단계에서는 상품명을 말하지 않습니다.
② features (3~8초, 40~55자): 핵심 특징 딱 2가지만. 스펙 나열이 아니라 사용 장면으로 묘사합니다. (예: "버튼 하나 누르면 ~가 끝나요")
③ price_value (8~12초, 25~40자): 가격·가성비 강조. 사용자가 한국 판매가를 제공하면 반드시 그 가격만 사용하고, 제공하지 않으면 {{가격}} 자리표시자를 넣고 "이 가격에 이 구성" 식으로 표현합니다. 가격을 절대 지어내지 마세요.
④ cta (12~15초, 15~25자): 긴급함 + 행동 지시. "지금", "오늘만", "품절 전에", "아래 링크" 활용.

[4. 사실 관계 규칙 (가장 중요)]
- 원본 자막에 없는 기능, 성분, 수치, 인증, 수상 이력을 절대 만들어내지 마세요.
- 건강 관련 상품이면 "치료된다, 예방한다, 낫는다" 같은 의료적 효능 표현 금지. "도움을 줄 수 있어요" 수준까지만 허용합니다.
- 근거 없는 최상급 금지: "국내 1위", "최고" 사용 불가. "요즘 난리 난", "주문 폭주" 같은 화제성 표현은 허용.
- 원본에서 확인하지 못했지만 대본에 중요한 정보(정확한 용량, 인증, 구성품 등)는 needs_check에 적으세요. 없으면 "없음"이라고 적습니다.

[5. 출력 규칙]
- 반드시 지정된 JSON 형식으로만 응답합니다. JSON 외의 설명, 인사말, 마크다운은 절대 출력하지 않습니다.
- full_script는 ①~④를 자연스럽게 이어 붙인 완성 대본이며, 총 100~140자(15초 발화 분량)를 지킵니다.`;

// ── 3. 반환 JSON 구조 정의 ──
// 필드를 바꾸고 싶으면 여기 FIELDS만 수정하면 두 API에 모두 반영됩니다.
const FIELDS = {
  product_name: '자막에서 파악한 상품명 (한국어)',
  hook: '0~3초 훅 멘트 (15~25자)',
  features: '3~8초 상품 특징 (40~55자)',
  price_value: '8~12초 가격/가성비 (25~40자)',
  cta: '12~15초 구매 유도 (15~25자)',
  full_script: '전체를 이어 붙인 15초 완성 대본 (100~140자)',
  needs_check: '원본에서 확인 못 한 중요 정보, 없으면 "없음"',
};

const OPENAI_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(
    Object.entries(FIELDS).map(([k, desc]) => [k, { type: 'string', description: desc }])
  ),
  required: Object.keys(FIELDS),
  additionalProperties: false,
};

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(
    Object.entries(FIELDS).map(([k, desc]) => [k, { type: 'STRING', description: desc }])
  ),
  required: Object.keys(FIELDS),
};

// ── 4. 메인 함수: 중국어 자막 → 대본 JSON ──
// rawText     : Whisper로 추출한 중국어 자막
// koreanPrice : (선택) 한국 판매가. 쿠팡 파트너스 검색 결과의 productPrice를
//               그대로 넣으면 대본에 실제 가격이 들어가고, 생략하면 {{가격}}으로 나옵니다.
async function convertToHomeShoppingScript(rawText, koreanPrice = null) {
  if (!rawText || !rawText.trim()) {
    throw new Error('rawText(중국어 자막)가 비어 있습니다.');
  }

  const userMessage =
    `[중국어 원본 자막]\n${rawText}\n\n` +
    (koreanPrice
      ? `[한국 판매가] ${Number(koreanPrice).toLocaleString('ko-KR')}원 — 대본에는 반드시 이 가격만 사용할 것`
      : `[한국 판매가] 미정 — 가격 자리에는 {{가격}} 자리표시자를 사용할 것`);

  return PROVIDER === 'openai' ? callOpenAI(userMessage) : callGemini(userMessage);
}

// ── 4-1. OpenAI 호출 (response_format으로 JSON 구조 강제) ──
async function callOpenAI(userMessage) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: TEMPERATURE,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      // ★ JSON 반환 강제: 항상 위 7개 필드 구조로만 응답하게 만드는 설정
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'home_shopping_script', strict: true, schema: OPENAI_SCHEMA },
      },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API 오류 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// ── 4-2. Gemini 호출 (responseSchema로 JSON 구조 강제) ──
async function callGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      // ★ JSON 반환 강제
      generationConfig: {
        temperature: TEMPERATURE,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_SCHEMA,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API 오류 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

module.exports = { convertToHomeShoppingScript };

// ── 5. 단독 테스트 (터미널에서 node script-converter.js 실행) ──
if (require.main === module) {
  const sample = `家人们 今天给大家带来一款爆款 多功能切菜器 不锈钢刀片一机五用
切丝切片切块都可以 还带洗菜沥水篮 手不碰刀片很安全 点点关注不迷路
原价59.9 今天直播间只要29.9 数量不多抓紧时间`;

  convertToHomeShoppingScript(sample, 19900) // 두 번째 값 = 한국 판매가(원). 빼도 됩니다.
    .then((r) => {
      console.log('✅ 변환 결과');
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((e) => console.error('❌ 실패:', e.message));
}

/* ── 6. 기존 server.js(쿠팡 검색 서버)에 붙이는 법 ─────────────────
const { convertToHomeShoppingScript } = require('./script-converter');
app.use(express.json());

app.post('/api/convert-script', async (req, res) => {
  try {
    const { rawText, koreanPrice } = req.body;
    const script = await convertToHomeShoppingScript(rawText, koreanPrice);
    res.json(script);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
────────────────────────────────────────────────────────────────── */
