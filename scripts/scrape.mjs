// 학교 식단 페이지를 읽어 public/data/menus.json 을 새로 쓴다.
// 실행: npm run scrape
//
// 학교 서버가 중간 인증서(Sectigo DV R36)를 보내지 않아 기본 설정으로는 TLS 검증이 실패한다.
// 검증을 끄지 않고, 중간 인증서를 NODE_EXTRA_CA_CERTS 로 더해서 해결한다 (package.json 참고).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cafeterias, CHECKED_AT } from './cafeterias.mjs';
import { parseMenuPage, kstToday } from './parse.mjs';
import { parseManual } from './manual.mjs';
import { holidays, HOLIDAYS_CHECKED_AT } from './holidays.mjs';
import { IBFOOD_BOARD, IBFOOD_ORIGIN, decodeIbfood, parseIbList, parseIbPostImage, weekAfter } from './ibfood.mjs';

const OUT = fileURLToPath(new URL('../public/data/menus.json', import.meta.url));
const ATTEMPTS = 3;

async function fetchPage(url) {
  return new TextDecoder().decode(await fetchBuffer(url));
}

async function fetchBuffer(url) {
  let lastError;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'jnu-breakfast/1.0 (menu aggregator; a few requests per day)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (i < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw new Error(`${url}: ${lastError?.cause?.code ?? lastError?.message}`);
}

// 6호관 업체 게시판의 최신 주간식단표 그림을 public/data 에 한 장만 저장한다 (같은 글이면 다시 받지 않음).
const WEEK_IMAGE = fileURLToPath(new URL('../public/data/dorm6-week.jpg', import.meta.url));
async function fetchWeekImage(previous) {
  const [latest] = parseIbList(decodeIbfood(await fetchBuffer(IBFOOD_BOARD)));
  if (!latest) throw new Error('업체 게시판에서 주간식단표 글을 찾지 못했습니다');
  const postUrl = `${IBFOOD_ORIGIN}/default/02/01.php?com_board_basic=read_form&com_board_idx=${latest.idx}&com_board_id=5`;
  if (previous?.idx === latest.idx) {
    try {
      await readFile(WEEK_IMAGE);
      return previous;
    } catch {
      // 파일이 없으면 다시 받는다
    }
  }
  const imageUrl = parseIbPostImage(decodeIbfood(await fetchBuffer(postUrl)), latest.idx);
  if (!imageUrl) throw new Error(`${latest.title}: 식단표 그림을 찾지 못했습니다`);
  const image = await fetchBuffer(imageUrl);
  if (image[0] !== 0xff || image[1] !== 0xd8) throw new Error(`${imageUrl}: jpg 가 아닙니다`);
  await writeFile(WEEK_IMAGE, image);
  const { start, end } = weekAfter(latest.date);
  return { src: `data/dorm6-week.jpg?v=${latest.idx}`, idx: latest.idx, title: latest.title, postedAt: latest.date, start, end, postUrl };
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

const previous = await readPrevious();
const today = kstToday();
const results = [];
let failures = 0;

for (const cafe of cafeterias) {
  const { scrape, manual, weekImage, ...info } = cafe;
  const entry = { ...info, days: [], updatedAt: null, error: null };
  if (scrape) {
    try {
      const { days } = parseMenuPage(await fetchPage(cafe.url), today);
      if (days.length === 0) throw new Error('날짜가 있는 식단 행이 없습니다');
      entry.days = days;
      entry.updatedAt = new Date().toISOString();
    } catch (err) {
      failures++;
      // 실패하면 직전 데이터를 남겨 두고, 화면에서 갱신 실패를 알린다.
      const old = previous?.cafeterias?.find((c) => c.id === cafe.id);
      entry.days = old?.days ?? [];
      entry.updatedAt = old?.updatedAt ?? null;
      entry.error = err.message;
      console.error(`[${cafe.id}] ${err.message}`);
    }
  }
  if (manual) {
    try {
      const path = fileURLToPath(new URL(`../${manual}`, import.meta.url));
      const { days, errors } = parseManual(await readFile(path, 'utf8'), today);
      entry.days = days;
      entry.manual = true;
      if (errors.length) {
        entry.error = errors.join(' / ');
        console.error(`[${cafe.id}] ${entry.error}`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        entry.error = `${manual}: ${err.message}`;
        console.error(`[${cafe.id}] ${entry.error}`);
      }
    }
  }
  if (weekImage) {
    const old = previous?.cafeterias?.find((c) => c.id === cafe.id)?.weekImage ?? null;
    try {
      entry.weekImage = await fetchWeekImage(old);
    } catch (err) {
      // 그림을 못 받아도 학교 페이지 식단은 그대로 쓴다
      entry.weekImage = old;
      console.error(`[${cafe.id}] 주간식단표 그림: ${err.message}`);
    }
  }
  results.push(entry);
  console.log(`[${cafe.id}] ${entry.days.length}일치${entry.error ? ' (이전 데이터 유지)' : ''}`);
}

if (failures === cafeterias.filter((c) => c.scrape).length) {
  console.error('모든 식당 수집에 실패해 기존 파일을 그대로 둡니다');
  process.exit(1);
}

const data = {
  generatedAt: new Date().toISOString(),
  infoCheckedAt: CHECKED_AT,
  holidays,
  holidaysCheckedAt: HOLIDAYS_CHECKED_AT,
  cafeterias: results,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data, null, 2) + '\n');
