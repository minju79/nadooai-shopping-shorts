// ============================================================
// ì¿ íŒ¡ ?ŒíŠ¸?ˆìŠ¤ ?í’ˆê²€??ë¡œì»¬ ?œë²„ (server.js)
// ?¤í–‰ ë°©ë²•:  1) ?„ëž˜ ??2ê°??…ë ¥  2) npm install  3) node server.js
// ?„ìš” ?˜ê²½:  Node.js 18 ?´ìƒ (?°ë??ì—??node -v ë¡??•ì¸)
// ============================================================

const express = require('express');
const crypto = require('crypto');
const { convertToHomeShoppingScript } = require('./script-converter');
const { searchTikTok } = require('./tiktok-search');

// ?€?€ 1. ???…ë ¥ (ì¿ íŒ¡ ?ŒíŠ¸?ˆìŠ¤ ??ì¶”ê??˜ìµ ??Open API ?ì„œ ë°œê¸‰) ?€?€
// ??????ì¤„ë§Œ ë³¸ì¸ ?¤ë¡œ ë°”ê¾¸ë©??©ë‹ˆ?? ?ˆë? ?„ë¡ ?¸ì—”??ì½”ë“œë¡???¸°ì§€ ë§ˆì„¸??
const ACCESS_KEY = 'e72b2e0e-022c-4bc7-b296-fc2ff439c6ee';
const SECRET_KEY = '9a4980acb604dbcec38c7f47659363b393c9abdf';

const DOMAIN = 'https://api-gateway.coupang.com';
const SEARCH_PATH = '/v2/providers/affiliate_open_api/apis/openapi/products/search';

const app = express();
app.use(express.json());

// ?•ì  ?Œì¼(HTML ?? ?œê³µ (Live Server ?†ì´ ?¤í–‰ ê°€?¥í•˜?„ë¡)
app.use(express.static(__dirname));
// ë¡œì»¬ ê°œë°œ??CORS ?ˆìš© (Live Server ???¤ë¥¸ ?¬íŠ¸???„ë¡ ?¸ì—???¸ì¶œ ê°€??
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ?€?€ 2. HMAC ?œëª…(Signature) ?ì„± ?€?€
// ì¿ íŒ¡ ê·œê²©: ?œëª…?œê°(GMT, yyMMddTHHmmssZ) + HTTPë©”ì„œ??+ ê²½ë¡œ + ì¿¼ë¦¬?¤íŠ¸ë§ì„
// Secret Keyë¡?HmacSHA256 ?´ì‹œ ??Authorization ?¤ë”???´ì•„ ?„ì†¡
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

// ?€?€ 3. ?µì‹¬ ?¨ìˆ˜: ê²€?‰ì–´ ??[{ ?í’ˆëª? ê°€ê²? ?ŒíŠ¸?ˆìŠ¤ë§í¬ }] ë°°ì—´ ë°˜í™˜ ?€?€
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
    throw new Error(`ì¿ íŒ¡ API ?¤ë¥˜ ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const products = result?.data?.productData ?? [];

  return products.map((p) => ({
    productName: p.productName,   // ?í’ˆëª?    productPrice: p.productPrice, // ê°€ê²?(?«ìž)
    productUrl: p.productUrl,     // ?ŒíŠ¸?ˆìŠ¤ ë§í¬ (?˜ìµ ë°œìƒ ë§í¬)
  }));
}

// ?€?€ 4. ?„ë¡ ?¸ì—”?œê? ?¸ì¶œ??ì£¼ì†Œ: GET /api/search?keyword=ê²€?‰ì–´ ?€?€
app.get('/api/search', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const limit = parseInt(req.query.limit) || 3; // ?„ë¡ ?¸ì—”?œì—???˜ì–´??limit ê°??ìš©
    
    if (!keyword) {
      return res.status(400).json({ error: 'ê²€?‰ì–´(keyword)ë¥??…ë ¥?˜ì„¸??' });
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
    if (!keyword) return res.status(400).json({ error: 'ê²€?‰ì–´(keyword)ë¥??…ë ¥?˜ì„¸??' });
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
      return res.status(400).json({ error: 'urls ë°°ì—´???„ìš”?©ë‹ˆ??' });
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
    // ?„ë¡ ?¸ì—”?œê? ê¸°ë??˜ëŠ” ?¬ë§· { response: data } ë¡?ë°˜í™˜
    res.json({ response: data });
  } catch (error) {
    console.error('Coupang Deeplink Error:', error);
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') { app.listen(3000, () => {
  console.log('???œë²„ ?¤í–‰ ì¤? http://localhost:3000');
  console.log('   ?ŒìŠ¤??ì£¼ì†Œ: http://localhost:3000/api/search?keyword=?¸íŠ¸ë¶?);
});

