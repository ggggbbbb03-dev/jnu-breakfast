// 수집 상태 점검. 문제가 있으면 실패(exit 1)해서 GitHub Actions 가 저장소 주인에게 메일을 보내게 한다.
// - menus.json 에 갱신 실패가 기록된 식당
// - 며칠째 새 식단이 없는 식당 (학교 페이지 구조가 바뀌었거나 게시가 멈춤)
// - 1호관 서울 함수(/api/dorm1, /api/dorm1-meals)가 응답하지 않거나 오래된 메뉴만 주는 경우
// 실행: npm run check   (SITE_URL 로 점검할 사이트를 바꿀 수 있다)

import { readFile } from 'node:fs/promises';
import { kstToday } from './parse.mjs';

const SITE = process.env.SITE_URL ?? 'https://jnu-breakfast.vercel.app';
const today = kstToday().toISOString().slice(0, 10);
const problems = [];

function daysBefore(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
}

function latest(days) {
  return days.map((d) => d.date).sort().at(-1) ?? null;
}

// 1) 학교 페이지에서 모은 식단
const data = JSON.parse(await readFile(new URL('../public/data/menus.json', import.meta.url), 'utf8'));
for (const cafe of data.cafeterias) {
  if (cafe.error) problems.push(`${cafe.name}: 갱신 실패 — ${cafe.error}`);
  if (cafe.manual) continue;
  const last = latest(cafe.days);
  // 주말을 넘겨 월요일 아침에 아직 새 주 식단이 없을 수 있으므로 3일까지는 봐준다.
  if (!last || last < daysBefore(today, 3)) problems.push(`${cafe.name}: 최근 식단 없음 (마지막 ${last ?? '없음'})`);
}

// 2) 1호관 서울 함수
async function checkApi(path, name, graceDays) {
  try {
    const res = await fetch(`${SITE}${path}`, { signal: AbortSignal.timeout(30_000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return problems.push(`${name}: HTTP ${res.status} ${body.error ?? ''}`.trim());
    const last = latest(body.days ?? []);
    if (!last || last < daysBefore(today, graceDays)) problems.push(`${name}: 최근 메뉴 없음 (마지막 ${last ?? '없음'})`);
  } catch (err) {
    problems.push(`${name}: 요청 실패 — ${err.message}`);
  }
}
await checkApi('/api/dorm1', '1호관 아침밥', 3);
await checkApi('/api/dorm1-meals', '1호관 점심·저녁', 3);

if (problems.length) {
  console.error(`점검 실패 (${today})`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log(`점검 통과 (${today})`);
