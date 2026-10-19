// 쉐프스키스(학생생활관 1호관) /morning 게시판에서 가장 최근 천원의 아침밥 글을 읽는다.
// 이 사이트는 해외 접속을 막아 두어 GitHub Actions(미국)에서는 못 읽고,
// Vercel 서울 리전(icn1)에서 도는 api/dorm1.js 가 이 모듈을 쓴다.
//
// 게시글 안에는 "천원의 아침밥 식단", "천원의 아침밥 간편식" 제목 아래에
// 요일 칸(일( 10/18), 월( 19일) …)과 그 아래 날짜별 메뉴 칸이 있는 표가 있다.

import { kstToday, resolveDate } from './parse.mjs';
import { gridDates, isGridDate, parseManual } from './manual.mjs';

export const BOARD_URL = 'https://chefskiss.co.kr/morning';
const ORIGIN = 'https://chefskiss.co.kr';
const UA = 'Mozilla/5.0 (compatible; jnu-breakfast/1.0; +https://github.com/ggggbbbb03-dev/jnu-breakfast)';

function decode(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

// 줄을 나누는 태그는 줄바꿈으로 바꾸고 나머지 태그는 지운다.
function toLines(html) {
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// 게시판 목록에서 글 주소들을 최신순(idx 큰 순)으로
export function findPosts(listHtml) {
  const seen = new Map();
  for (const m of listHtml.matchAll(/href="([^"]*bmode=view[^"]*)"/g)) {
    const href = decode(m[1]);
    const idx = href.match(/[?&]idx=(\d+)/)?.[1];
    if (idx && !seen.has(idx)) seen.set(idx, new URL(href, ORIGIN).toString());
  }
  return [...seen.entries()].sort((a, b) => Number(b[0]) - Number(a[0])).map(([, url]) => url);
}

// 진단용: 사이트 안 링크(메뉴 게시판 찾기)
function siteLinks(html) {
  const links = new Map();
  for (const m of html.matchAll(/<a[^>]*href="(\/[^"#]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decode(m[1]);
    const text = toLines(m[2]).join(' ');
    if (!/bmode=|\.(css|js|png|jpg)/.test(href) && !links.has(href)) links.set(href, text);
  }
  return [...links].slice(0, 60).map(([href, text]) => `${text} ${href}`.trim());
}

function mealName(title) {
  return /간편식/.test(title) ? '조식(간편식)' : '조식(일반식)';
}

// 게시글 HTML의 표를 날짜별 메뉴로
export function parsePost(html, today = kstToday()) {
  const byDate = new Map();
  const errors = [];
  let lastEnd = 0;

  for (const t of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const before = toLines(html.slice(lastEnd, t.index)).filter((l) => /천원의\s*아침밥/.test(l)).at(-1) ?? '';
    lastEnd = t.index + t[0].length;
    const name = mealName(before);

    const rows = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) =>
      [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => toLines(c[1])),
    );
    const headIndex = rows.findIndex((cells) => cells.length >= 2 && cells.every((c) => c.length && isGridDate(c.join(' '))));
    if (headIndex === -1) continue;

    let dates;
    try {
      dates = gridDates(rows[headIndex].map((c) => c.join(' ')), name, today);
    } catch (err) {
      errors.push(err.message);
      continue;
    }
    // 헤더 아래 행들의 같은 열을 이어 붙인다 (보통은 한 행)
    const columns = dates.map(() => []);
    for (const cells of rows.slice(headIndex + 1)) {
      cells.forEach((lines, i) => columns[i]?.push(...lines));
    }

    dates.forEach(({ date, weekday }, i) => {
      const items = columns[i];
      const meal = { name, items, cheonwon: true, limit: null, closed: false };
      if (items.length === 0 || (items.length === 1 && /미운영|휴무/.test(items[0]))) {
        meal.closed = true;
        meal.note = items[0] ?? '메뉴 없음';
        meal.items = [];
      }
      const day = byDate.get(date) ?? { date, weekday, meals: [] };
      day.meals = day.meals.filter((m) => m.name !== name).concat(meal);
      byDate.set(date, day);
    });
  }

  // 표가 없으면(이미지·글 형태) 글자만 뽑아 붙여넣기 파서로 읽어 본다.
  if (byDate.size === 0) {
    return parseManual(toLines(html).join('\n'), today);
  }
  const order = ['조식(간편식)', '조식(일반식)'];
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of days) day.meals.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return { days, errors };
}

// 진단용: 다른 게시판(foodcourt, today)의 최신 글이 어떻게 생겼는지 본다.
export const BOARDS = ['morning', 'foodcourt', 'today'];
export async function probeBoard(board) {
  const list = await get(`${ORIGIN}/${board}`);
  const posts = findPosts(list.text);
  const info = { board, listStatus: list.status, posts: posts.slice(0, 5), titles: postTitles(list.text).slice(0, 10) };
  if (posts[0]) {
    const post = await get(posts[0]);
    info.newest = { status: post.status, tables: (post.text.match(/<table/gi) ?? []).length,
      images: (post.text.match(/<img/gi) ?? []).length, lines: toLines(post.text).slice(0, 150) };
  } else {
    info.listSample = toLines(list.text).slice(0, 100);
  }
  return info;
}

function postTitles(html) {
  return [...html.matchAll(/<a[^>]*href="[^"]*bmode=view[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => toLines(m[1]).join(' '))
    .filter(Boolean);
}

// /foodcourt 페이지에는 인스타그램 피드가 글자로 들어 있다:
//   2026년 10월 19일 점심메뉴입니다
//   백미밥
//   감자계란국 ...
// 같은 끼니가 여러 번 나오면 피드 맨 위(가장 최근 글)를 쓴다. 아침밥 글은 /morning 표로 대신한다.
const FEED_HEAD = /^(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(.*?)\s*입니다\.?$/;
const FEED_STOP = /^(SNS 바로가기|목록|상호|사업자등록번호|연락처|Copyright|이용약관|chefskiss_)/i;
const FEED_MAX_ITEMS = 25;
const MEAL_ORDER = ['중식', '석식'];

export function parseFoodcourt(html, today = kstToday()) {
  const byDate = new Map();
  let current = null;

  const flush = () => {
    if (!current) return;
    const { date, kinds, items } = current;
    current = null;
    if (items.length === 0) return;
    const day = byDate.get(date) ?? { date, weekday: null, meals: [] };
    for (const name of kinds) {
      if (!day.meals.some((m) => m.name === name)) {
        day.meals.push({ name, items: [...items], cheonwon: false, limit: null, closed: false });
      }
    }
    byDate.set(date, day);
  };

  for (const line of toLines(html)) {
    const head = line.match(FEED_HEAD);
    if (head) {
      flush();
      const kinds = [];
      if (/점심|중식/.test(head[4])) kinds.push('중식');
      if (/저녁|석식/.test(head[4])) kinds.push('석식');
      if (kinds.length === 0) continue;
      const date = head[1]
        ? `${head[1]}-${head[2].padStart(2, '0')}-${head[3].padStart(2, '0')}`
        : resolveDate(Number(head[2]), Number(head[3]), today);
      current = { date, kinds, items: [] };
      continue;
    }
    if (!current) continue;
    if (FEED_STOP.test(line) || current.items.length >= FEED_MAX_ITEMS) {
      flush();
      continue;
    }
    if (/^#|https?:|@/.test(line)) continue;
    current.items.push(line);
  }
  flush();

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of days) day.meals.sort((a, b) => MEAL_ORDER.indexOf(a.name) - MEAL_ORDER.indexOf(b.name));
  return days;
}

export async function fetchFoodcourt({ debug = false } = {}) {
  const page = await get(`${ORIGIN}/foodcourt`);
  if (page.status !== 200) throw new Error(`푸드코트 페이지 응답 ${page.status}`);
  if (debug) {
    const lines = toLines(page.text);
    const first = lines.findIndex((l) => FEED_HEAD.test(l));
    return { lines: lines.slice(Math.max(first - 5, 0), first + 200) };
  }
  const days = parseFoodcourt(page.text);
  if (days.length === 0) throw new Error('푸드코트 페이지에서 점심·저녁 메뉴를 찾지 못했습니다');
  return { source: `${ORIGIN}/foodcourt`, fetchedAt: new Date().toISOString(), days };
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  return { status: res.status, text };
}

// 최신 글부터 최대 3개를 보고, 오늘이 들어 있는 글을 고른다 (없으면 가장 최신 글).
export async function fetchDorm1({ debug = false } = {}) {
  const today = kstToday();
  const todayIso = today.toISOString().slice(0, 10);
  const info = { board: BOARD_URL };

  const list = await get(BOARD_URL);
  info.listStatus = list.status;
  info.listLength = list.text.length;
  if (list.status !== 200) throw Object.assign(new Error(`게시판 응답 ${list.status}`), { debug: info });

  if (debug) info.nav = siteLinks(list.text);
  const posts = findPosts(list.text);
  info.posts = posts.slice(0, 5);
  if (posts.length === 0) {
    if (debug) info.listSample = toLines(list.text).slice(0, 80);
    throw Object.assign(new Error('게시판에서 글 링크를 찾지 못했습니다'), { debug: info });
  }

  let chosen = null;
  info.tried = [];
  for (const url of posts.slice(0, 3)) {
    const post = await get(url);
    const parsed = post.status === 200 ? parsePost(post.text, today) : { days: [], errors: [`HTTP ${post.status}`] };
    info.tried.push({ url, status: post.status, days: parsed.days.length, errors: parsed.errors });
    if (debug && parsed.days.length === 0) info.postSample = toLines(post.text).slice(0, 120);
    if (parsed.days.length === 0) continue;
    chosen ??= { url, ...parsed };
    if (parsed.days.some((d) => d.date === todayIso)) {
      chosen = { url, ...parsed };
      break;
    }
  }
  if (!chosen) throw Object.assign(new Error('최근 글에서 식단 표를 찾지 못했습니다'), { debug: info });

  return {
    source: chosen.url,
    fetchedAt: new Date().toISOString(),
    days: chosen.days,
    errors: chosen.errors,
    ...(debug ? { debug: info } : {}),
  };
}
