// 제주대학교 식단 페이지(#plannerWrap 표)를 구조화된 데이터로 바꾼다.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z0-9#]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function stripTags(html) {
  return decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// 셀 안의 <br>, </br> 로 나뉜 메뉴 항목을 배열로 만든다.
function cellItems(html) {
  return html
    .split(/<\/?br\s*\/?>/i)
    .map(stripTags)
    .filter(Boolean);
}

const BREAKFAST_TAG = /천원의\s*아침밥/;
const LIMIT_TAG = /^★?\s*(\d+)\s*개\s*한정\s*★?$/;

// "♥천원의아침밥♥", "★50개 한정★" 같은 표시는 메뉴에서 떼어 내 속성으로 둔다.
export function parseCell(html) {
  const raw = cellItems(html);
  const meal = { items: [], cheonwon: false, limit: null, closed: false };
  for (const item of raw) {
    if (BREAKFAST_TAG.test(item) && item.replace(/[♥♡\s]/g, '').length <= 7) {
      meal.cheonwon = true;
      continue;
    }
    const limit = item.match(LIMIT_TAG);
    if (limit) {
      meal.limit = Number(limit[1]);
      continue;
    }
    meal.items.push(item);
  }
  if (meal.items.length === 1 && /미운영|운영\s*안\s*함|휴무/.test(meal.items[0])) {
    meal.closed = true;
    meal.note = meal.items[0];
    meal.items = [];
  }
  return meal;
}

// 페이지에는 "10/19 (월)"처럼 월/일만 있으므로, 기준일에 가장 가까운 연도를 고른다.
// today 는 한국 시간 날짜를 UTC 필드에 담은 Date 다 (kstToday() 참고).
export function resolveDate(month, day, today) {
  const year = today.getUTCFullYear();
  const candidates = [year - 1, year, year + 1].map((y) => new Date(Date.UTC(y, month - 1, day)));
  const base = Date.UTC(year, today.getUTCMonth(), today.getUTCDate());
  candidates.sort((a, b) => Math.abs(a - base) - Math.abs(b - base));
  return candidates[0].toISOString().slice(0, 10);
}

export function kstToday(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000);
}

export function parseMenuPage(html, today = kstToday()) {
  const start = html.indexOf('id="plannerWrap"');
  if (start === -1) throw new Error('식단 표(#plannerWrap)를 찾지 못했습니다');
  const end = html.indexOf('</table>', start);
  const table = html.slice(start, end === -1 ? undefined : end);

  const thead = table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? '';
  const columns = [...thead.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1])).slice(1);

  const days = [];
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const head = row[1].match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (!head) continue;
    const label = stripTags(head[1].replace(/<\/?br\s*\/?>/gi, ' '));
    const md = label.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (!md) continue;
    const weekday = label.match(/\(([월화수목금토일])\)/)?.[1] ?? null;
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => parseCell(m[1]));
    const meals = columns.map((name, i) => ({ name, ...(cells[i] ?? { items: [], cheonwon: false, limit: null, closed: true }) }));
    days.push({ date: resolveDate(Number(md[1]), Number(md[2]), today), weekday, meals });
  }
  return { columns, days };
}
