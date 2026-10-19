// 손으로 붙여 넣은 주간 메뉴(manual/*.txt)를 식단 데이터로 바꾼다.
// 형식은 느슨하게 받는다: 날짜가 들어간 줄이 나오면 새 날, 그 아래 줄들이 메뉴.
//
//   10/20 (월)
//   우리쌀주먹밥
//   - 바나나
//
//   10월 21일 화요일
//   ...
//
// '//' 로 시작하는 줄은 무시한다. 한 줄에 쉼표(,)나 슬래시(/)로 여러 메뉴를 적어도 된다.

import { resolveDate } from './parse.mjs';

const DATE_LINE = /^[\s\[(<【*#-]*(\d{1,2})\s*(?:[/.]|월)\s*(\d{1,2})\s*일?(?![\d])(.*)$/;
const WEEKDAY = /([월화수목금토일])(?:요일)?/;
const CLOSED = /미운영|휴무|운영\s*안\s*함|쉽니다/;

export function parseManual(text, name, today) {
  const days = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    const date = line.match(DATE_LINE);
    if (date) {
      const rest = date[3].trim();
      current = {
        date: resolveDate(Number(date[1]), Number(date[2]), today),
        weekday: rest.match(WEEKDAY)?.[1] ?? null,
        meals: [{ name, items: [], cheonwon: true, limit: null, closed: false }],
      };
      days.push(current);
      // "10/20 (월) 주먹밥, 바나나" 처럼 날짜 줄에 메뉴가 같이 있는 경우
      const inline = rest.replace(/^[(\[<【]?\s*[월화수목금토일](?:요일)?\s*[)\]>】]?/, '').trim();
      if (inline) addItems(current.meals[0], inline);
      continue;
    }
    if (current) addItems(current.meals[0], line);
  }

  for (const day of days) {
    const meal = day.meals[0];
    if (meal.items.length === 1 && CLOSED.test(meal.items[0])) {
      meal.closed = true;
      meal.note = meal.items[0];
      meal.items = [];
    }
  }
  // 같은 날짜가 두 번 있으면 뒤의 것을 쓴다
  const byDate = new Map(days.map((d) => [d.date, d]));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function addItems(meal, line) {
  for (const part of line.split(/[,/]/)) {
    const item = part.replace(/^[-*•·▶▷■□◆◇●○]+\s*/, '').trim();
    if (item) meal.items.push(item);
  }
}
