// ============================================================
// 틱톡 키워드 검색 크롤러 (tiktok-search.js)
// 검색어 → 공개 검색결과에서 [영상 링크, 제목, 조회수] 추출
//
// 방식: Puppeteer(진짜 크롬)로 틱톡 검색 페이지를 열고,
//       틱톡이 화면을 그릴 때 내부적으로 주고받는 검색 API의
//       JSON 응답을 가로채서 수집합니다.
//       → HTML 파싱(Cheerio)보다 가볍고, 화면 디자인이 바뀌어도 버팁니다.
//
// 사용법:
//   1) npm install puppeteer   (크로미움 자동 다운로드 약 300MB, 2~3분)
//   2) node tiktok-search.js 便携风扇
//   3) 서버 연동은 파일 맨 아래 주석 참고
// 필요 환경: Node.js 18 이상
// ============================================================

const puppeteer = require('puppeteer');

// ── 1. 설정 ──
const HEADLESS = false;    // false = 크롬 창이 보임. 캡차가 뜨면 직접 풀 수 있게 false 유지 권장
const MAX_WAIT_MS = 45000; // 결과가 안 잡힐 때(캡차 등) 최대 대기 시간

// ── 2. 틱톡 검색 API 응답에서 필요한 필드만 추출 ──
function extractItems(json) {
  const raw = Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.item_list) ? json.item_list
    : [];

  const out = [];
  for (const entry of raw) {
    const item = entry?.item || entry; // 틱톡 응답 형태가 2가지라 둘 다 처리
    if (!item?.id || !item?.author) continue;
    out.push({
      title: (item.desc || '(제목 없음)').trim(),
      url: `https://www.tiktok.com/@${item.author.uniqueId}/video/${item.id}`,
      views: item.stats?.playCount ?? 0,          // 조회수 (숫자, 정렬용)
      author: item.author.nickname || item.author.uniqueId,
    });
  }
  return out;
}

// 조회수 표시용 변환 (1234567 → "123.5만")
function formatViews(n) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
  if (n >= 10000) return (n / 10000).toFixed(1) + '만';
  return String(n);
}

// ── 3. 메인 함수: 검색어 → 영상 배열 (조회수 내림차순) ──
async function searchTikTok(keyword, maxResults = 10) {
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--lang=ko-KR'],
    defaultViewport: { width: 1280, height: 900 },
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );

    const collected = new Map(); // 링크 기준 중복 제거

    // ★ 핵심: 틱톡 내부 검색 API 응답(JSON)을 가로채서 수집
    page.on('response', async (response) => {
      if (!response.url().includes('/api/search/')) return;
      try {
        const json = await response.json();
        for (const v of extractItems(json)) collected.set(v.url, v);
      } catch (_) { /* JSON이 아닌 응답은 무시 */ }
    });

    const searchUrl = `https://www.tiktok.com/search/video?q=${encodeURIComponent(keyword)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 로그인 권유 팝업이 뜨면 닫기만 하고 비로그인 상태로 계속 진행
    try {
      await page.waitForSelector('[data-e2e="modal-close-inner-button"]', { timeout: 6000 });
      await page.click('[data-e2e="modal-close-inner-button"]');
    } catch (_) {}

    // 결과가 잡힐 때까지 대기 — 이 사이 캡차가 보이면 크롬 창에서 직접 풀어주세요
    let waited = 0;
    while (collected.size === 0 && waited < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, 3000));
      waited += 3000;
    }

    // 스크롤해서 결과 추가 로드
    for (let i = 0; i < 4 && collected.size < maxResults * 2; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await new Promise((r) => setTimeout(r, 2000));
    }

    return [...collected.values()]
      .sort((a, b) => b.views - a.views)   // 조회수 높은 순
      .slice(0, maxResults)
      .map((v, i) => ({ rank: i + 1, ...v, viewsText: formatViews(v.views) }));
  } finally {
    await browser.close();
  }
}

module.exports = { searchTikTok, extractItems, formatViews };

// ── 4. 단독 실행: node tiktok-search.js 검색어 ──
if (require.main === module) {
  const keyword = process.argv.slice(2).join(' ') || '便携风扇';
  console.log(`🔍 틱톡 검색: "${keyword}" — 크롬 창이 열립니다. 캡차가 보이면 직접 풀어주세요.`);

  searchTikTok(keyword, 10)
    .then((rows) => {
      if (!rows.length) {
        console.log('결과 0건 — 캡차 미해결이거나 틱톡이 구조를 바꿨을 수 있습니다. 한 번 더 실행해 보세요.');
        return;
      }
      console.table(rows.map(({ rank, title, viewsText, url }) => ({
        순위: rank,
        제목: title.length > 28 ? title.slice(0, 28) + '…' : title,
        조회수: viewsText,
        링크: url,
      })));
    })
    .catch((e) => console.error('❌ 실패:', e.message));
}

/* ── 5. 기존 server.js(쿠팡 검색 서버)에 붙이는 법 ─────────────────
const { searchTikTok } = require('./tiktok-search');

app.get('/api/tiktok-search', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    if (!keyword) return res.status(400).json({ error: '검색어(keyword)를 입력하세요.' });
    const videos = await searchTikTok(keyword, 10); // 브라우저 실행 때문에 15~40초 걸립니다
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
────────────────────────────────────────────────────────────────── */
