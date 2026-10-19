// 손으로 붙여 넣은 주간 메뉴(manual/*.txt)를 식단 데이터로 바꾼다. 두 형식을 받는다.
//
// 1) 날짜 줄 아래에 그날 메뉴 (직접 정리할 때)
//      10/20 (월)
//      우리쌀주먹밥
//      - 바나나
//
// 2) 쉐프스키스 /morning 게시글을 그대로 복사한 것 (요일 줄이 먼저 다 나오고 메뉴가 이어짐)
//      천원의 아침밥 식단
//      일( 10/18)
//      월( 19일)
//      백미밥
//      계란탕 ...
//    날짜 경계가 없으므로, 첫 메뉴가 날마다 반복되면(예: 백미밥) 그 자리에서 나누고,
//    아니면 개수가 날짜 수로 나누어떨어질 때만 똑같이 나눈다. 둘 다 아니면 오류로 알린다.
//
// '천원의 아침밥 …' 줄은 구역 제목이다. '간편식'이 들어가면 간편식, 아니면 일반식으로 본다.
// '//' 로 시작하는 줄은 무시한다. 형식 1에서는 한 줄에 쉼표(,)나 슬래시(/)로 여러 메뉴를 적어도 된다.

import { resolveDate } from './parse.mjs';

const DATE_LINE = /^[\s\[(<【*#-]*(\d{1,2})\s*(?:[/.]|월)\s*(\d{1,2})\s*일?(?![\d])(.*)$/;
const GRID_DATE = /^([월화수목금토일])\s*(?:요일)?\s*[(\[]\s*(?:(\d{1,2})\s*[/.]\s*)?(\d{1,2})\s*일?\s*[)\]]$/;
const SECTION = /천원의\s*아침밥/;
const WEEKDAY = /([월화수목금토일])(?:요일)?/;
const CLOSED = /미운영|휴무|운영\s*안\s*함|쉽니다/;
const DEFAULT_NAME = '조식(천원의 아침밥)';

function meal(name) {
  return { name, items: [], cheonwon: true, limit: null, closed: false };
}

function splitSections(lines) {
  const sections = [];
  let current = { name: DEFAULT_NAME, lines: [] };
  for (const line of lines) {
    if (SECTION.test(line) && line.length <= 30 && !DATE_LINE.test(line)) {
      if (current.lines.length) sections.push(current);
      current = { name: /간편식/.test(line) ? '조식(간편식)' : '조식(일반식)', lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length) sections.push(current);
  return sections;
}

// 형식 1
function parseDated(lines, name, today) {
  const days = [];
  let current = null;
  for (const line of lines) {
    const date = line.match(DATE_LINE);
    if (date) {
      const rest = date[3].trim();
      current = {
        date: resolveDate(Number(date[1]), Number(date[2]), today),
        weekday: rest.match(WEEKDAY)?.[1] ?? null,
        meals: [meal(name)],
      };
      days.push(current);
      // "10/20 (월) 주먹밥, 바나나" 처럼 날짜 줄에 메뉴가 같이 있는 경우
      const inline = rest.replace(/^[(\[<【]?\s*[월화수목금토일](?:요일)?\s*[)\]>】]?/, '').trim();
      if (inline) addItems(current.meals[0], inline);
      continue;
    }
    if (current) addItems(current.meals[0], line);
  }
  return days;
}

// 형식 2
function parseGrid(lines, name, today) {
  const headers = [];
  while (headers.length < lines.length && GRID_DATE.test(lines[headers.length])) {
    headers.push(lines[headers.length].match(GRID_DATE));
  }
  const items = lines.slice(headers.length).map(cleanItem).filter(Boolean);
  const dates = gridDates(headers.map((h) => h[0]), name, today);

  const groups = splitEvenly(items, dates.length);
  if (!groups) {
    throw new Error(`${name}: 메뉴 ${items.length}개를 ${dates.length}일로 나누지 못했습니다. 날짜 줄 형식으로 적어 주세요`);
  }
  return dates.map(({ date, weekday }, i) => ({ date, weekday, meals: [{ ...meal(name), items: groups[i] }] }));
}

export function isGridDate(label) {
  return GRID_DATE.test(label);
}

// "일( 10/18)", "월( 19일)" … 처럼 월이 첫 칸에만 있으므로, 이어지는 날짜는 하루씩 더해 맞춘다.
export function gridDates(labels, name, today) {
  const headers = labels.map((l) => l.match(GRID_DATE));
  if (headers.some((h) => !h)) throw new Error(`${name}: 요일 칸을 읽지 못했습니다`);
  const [, , month, firstDay] = headers[0];
  if (!month) throw new Error(`${name}: 첫 날짜에 월이 없습니다 (예: 일( 10/18))`);
  const first = new Date(`${resolveDate(Number(month), Number(firstDay), today)}T00:00:00Z`);
  return headers.map((h, i) => {
    const d = new Date(first.getTime() + i * 864e5);
    if (d.getUTCDate() !== Number(h[3])) throw new Error(`${name}: 날짜가 하루씩 이어지지 않습니다 (${h[0]})`);
    return { date: d.toISOString().slice(0, 10), weekday: h[1] };
  });
}

function splitEvenly(items, n) {
  const anchor = items[0];
  const starts = items.flatMap((item, i) => (item === anchor ? [i] : []));
  if (starts.length === n) return starts.map((s, i) => items.slice(s, starts[i + 1]));
  if (items.length % n === 0) {
    const size = items.length / n;
    return Array.from({ length: n }, (_, i) => items.slice(i * size, (i + 1) * size));
  }
  return null;
}

export function parseManual(text, today) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
  const byDate = new Map();
  const errors = [];

  for (const section of splitSections(lines)) {
    let days;
    try {
      days = GRID_DATE.test(section.lines[0] ?? '')
        ? parseGrid(section.lines, section.name, today)
        : parseDated(section.lines, section.name, today);
    } catch (err) {
      errors.push(err.message);
      continue;
    }
    for (const day of days) {
      const m = day.meals[0];
      if (m.items.length === 1 && CLOSED.test(m.items[0])) {
        m.closed = true;
        m.note = m.items[0];
        m.items = [];
      }
      const existing = byDate.get(day.date);
      if (!existing) {
        byDate.set(day.date, day);
        continue;
      }
      // 같은 날짜·같은 구역이 또 나오면 뒤의 것을 쓴다
      existing.meals = existing.meals.filter((x) => x.name !== m.name).concat(m);
      existing.weekday ??= day.weekday;
    }
  }

  const order = (name) => ['조식(간편식)', '조식(일반식)', DEFAULT_NAME].indexOf(name);
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of days) day.meals.sort((a, b) => order(a.name) - order(b.name));
  return { days, errors };
}

function cleanItem(line) {
  return line.replace(/^[-*•·▶▷■□◆◇●○]+\s*/, '').trim();
}

function addItems(target, line) {
  for (const part of line.split(/[,/]/)) {
    const item = cleanItem(part);
    if (item) target.items.push(item);
  }
}
