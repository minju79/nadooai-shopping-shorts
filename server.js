// ============================================================
// 쿠팡 파트너스 상품검색 로컬 서버 (server.js)
// 실행 방법:  1) 아래 키 2개 입력  2) npm install  3) node server.js
// 필요 환경:  Node.js 18 이상 (터미널에서 node -v 로 확인)
// ============================================================

const express = require('express');
const crypto = require('crypto');
const { convertToHomeShoppingScript } = require('./script-converter');
const { searchTikTok } = require('./tiktok-search');

// ── 1. 키 입력 (쿠팡 파트너스 → 추가수익 → Open API 에서 발급) ──
// ★ 이 두 줄만 본인 키로 바꾸면 됩니다. 절대 프론트엔드 코드로 옮기지 마세요.
const ACCESS_KEY = 'e72b2e0e-022c-4bc7-b296-fc2ff439c6ee';
const SECRET_KEY = '9a4980acb604dbcec38c7f47659363b393c9abdf';

const DOMAIN = 'https://api-gateway.coupang.com';
const SEARCH_PATH = '/v2/providers/affiliate_open_api/apis/openapi/products/search';

const app = express();
app.use(express.json());

// 정적 파일(HTML 등) 제공 (Live Server 없이 실행 가능하도록)
app.use(express.static(__dirname));
// 로컬 개발용 CORS 허용 (Live Server 등 다른 포트의 프론트에서 호출 가능)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── 2. HMAC 서명(Signature) 생성 ──
// 쿠팡 규격: 서명시각(GMT, yyMMddTHHmmssZ) + HTTP메서드 + 경로 + 쿼리스트링을
// Secret Key로 HmacSHA256 해시 → Authorization 헤더에 담아 전송
function generateHmac(method, fullPath) {
  const [path, query = ''] = fullPath.split('?');

  const datetime = new Date().toISOString() // 2026-07-07T12:34:56.789Z
    .substring(2, 19)                       // 26-07-07T12:34:56
    .replace(/[-:]/g, '')                   // 260707T123456
    + 'Z';

  const message = datetime + method + path + query;

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

// ── 3. 핵심 함수: 검색어 → [{ 상품명, 가격, 파트너스링크 }] 배열 반환 ──
async function searchProducts(keyword, limit = 3) {
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const fullPath = `${SEARCH_PATH}?${query}`;

  const response = await fetch(DOMAIN + fullPath, {
    method: 'GET',
    headers: {
      Authorization: generateHmac('GET', fullPath),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`쿠팡 API 오류 ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const products = result?.data?.productData ?? [];

  return products.map((p) => ({
    productName: p.productName,   // 상품명
    productPrice: p.productPrice, // 가격 (숫자)
    productUrl: p.productUrl,     // 파트너스 링크 (수익 발생 링크)
  }));
}

// ── 4. 프론트엔드가 호출할 주소: GET /api/search?keyword=검색어 ──
app.get('/api/search', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const limit = parseInt(req.query.limit) || 3; // 프론트엔드에서 넘어온 limit 값 적용
    
    if (!keyword) {
      return res.status(400).json({ error: '검색어(keyword)를 입력하세요.' });
    }
    
    const products = await searchProducts(keyword, limit);
    res.json(products);
  } catch (error) {
    console.error('Coupang API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/convert-script', async (req, res) => {
  try {
    const { rawText, koreanPrice } = req.body;
    const script = await convertToHomeShoppingScript(rawText, koreanPrice);
    res.json(script);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tiktok-search', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    if (!keyword) return res.status(400).json({ error: '검색어(keyword)를 입력하세요.' });
    const videos = await searchTikTok(keyword, 10);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coupang/deeplink', async (req, res) => {
  try {
    const urls = req.body.urls;
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'urls 배열이 필요합니다.' });
    }

    const method = 'POST';
    const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const authorization = generateHmac(method, path);

    const response = await fetch(DOMAIN + path, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ coupangUrls: urls })
    });

    if (!response.ok) {
      throw new Error(`Coupang API Error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    // 프론트엔드가 기대하는 포맷 { response: data } 로 반환
    res.json({ response: data });
  } catch (error) {
    console.error('Coupang Deeplink Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('✅ 서버 실행 중: http://localhost:3000');
  console.log('   테스트 주소: http://localhost:3000/api/search?keyword=노트북');
});
