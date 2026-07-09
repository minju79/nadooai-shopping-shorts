// ============================================================
// 쿠팡 파트너스 상품검색 로컬 서버 (server.js)
// 실행 방법:  1) 아래 키 2개 입력  2) npm install  3) node server.js
// 필요 환경:  Node.js 18 이상 (터미널에서 node -v 로 확인)
// ============================================================

const express = require('express');
const crypto = require('crypto');
const { convertToHomeShoppingScript } = require('./script-converter');

// ── 1. 키 입력 (쿠팡 파트너스 → 추가수익 → Open API 에서 발급) ──
const ACCESS_KEY = 'e72b2e0e-022c-4bc7-b296-fc2ff439c6ee';
const SECRET_KEY = '9a4980acb604dbcec38c7f47659363b393c9abdf';

const DOMAIN = 'https://api-gateway.coupang.com';
const SEARCH_PATH = '/v2/providers/affiliate_open_api/apis/openapi/products/search';

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

function generateHmac(method, fullPath) {
  const [path, query = ''] = fullPath.split('?');
  const datetime = new Date().toISOString()
    .substring(2, 19)
    .replace(/[-:]/g, '') + 'Z';
  const message = datetime + method + path + query;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');
  return "CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}";
}

async function searchProducts(keyword, limit = 3) {
  const query = "keyword=${encodeURIComponent(keyword)}&limit=${limit}";
  const fullPath = "${SEARCH_PATH}?${query}";
  const response = await fetch(DOMAIN + fullPath, {
    method: 'GET',
    headers: {
      Authorization: generateHmac('GET', fullPath),
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error("쿠팡 API 오류 ${response.status}: ${errText}");
  }
  const result = await response.json();
  const products = result?.data?.productData ?? [];
  return products.map((p) => ({
    productName: p.productName,
    productPrice: p.productPrice,
    productUrl: p.productUrl,
  }));
}

app.get('/api/search', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const limit = parseInt(req.query.limit) || 3;
    if (!keyword) return res.status(400).json({ error: '검색어(keyword)를 입력하세요.' });
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
    if (!response.ok) throw new Error("Coupang API Error: ${response.status} ${await response.text()}");
    const data = await response.json();
    res.json({ response: data });
  } catch (error) {
    console.error('Coupang Deeplink Error:', error);
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('✅ 서버 실행 중: http://localhost:3000');
  });
}

module.exports = app;
