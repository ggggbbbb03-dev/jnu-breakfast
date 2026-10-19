import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMenuPage, parseCell, resolveDate } from '../scripts/parse.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const TODAY = new Date(Date.UTC(2026, 9, 19));

test('6호관: 천원의 아침밥 표시와 한정 수량을 메뉴에서 분리한다', () => {
  const { columns, days } = parseMenuPage(fixture('fixfirst.html'), TODAY);
  assert.deepEqual(columns, ['조식(간편식)', '조식(일반식)', '중식', '석식']);
  assert.equal(days.length, 7);
  assert.equal(days[0].date, '2026-10-19');
  assert.equal(days[0].weekday, '월');

  const [simple, regular, lunch] = days[0].meals;
  assert.equal(simple.cheonwon, true);
  assert.equal(simple.limit, 50);
  assert.deepEqual(simple.items, ['우리쌀특삼계죽', '제로오렌지주스', '두부과자']);
  assert.equal(regular.cheonwon, true);
  assert.equal(regular.limit, null);
  assert.equal(regular.items[0], '백미밥');
  assert.equal(lunch.cheonwon, false);

  const sunday = days[6];
  assert.equal(sunday.weekday, '일');
  assert.equal(sunday.meals[0].closed, true);
  assert.equal(sunday.meals[2].closed, false);
});

test('백두관·사라캠퍼스: 열 이름과 미운영 칸을 읽는다', () => {
  const baekdu = parseMenuPage(fixture('firstfixmenu.html'), TODAY);
  assert.deepEqual(baekdu.columns, ['중식1', '중식2', '석식']);
  assert.equal(baekdu.days.length, 5);
  assert.equal(baekdu.days[4].meals[1].closed, true);
  assert.ok(baekdu.days.every((d) => d.meals.every((m) => !m.cheonwon)));

  const sara = parseMenuPage(fixture('secondfixmenu.html'), TODAY);
  assert.deepEqual(sara.columns, ['중식', '석식']);
  assert.equal(sara.days.length, 5);
});

test('1호관: 날짜별 식단이 없는 페이지는 빈 결과', () => {
  assert.equal(parseMenuPage(fixture('fixmenu.html'), TODAY).days.length, 0);
});

test('표가 없으면 오류', () => {
  assert.throws(() => parseMenuPage('<html></html>', TODAY), /plannerWrap/);
});

test('빈 줄과 HTML 엔티티를 정리한다', () => {
  const meal = parseCell('식빵&amp;잼</br></br> 사각어묵 </br>');
  assert.deepEqual(meal.items, ['식빵&잼', '사각어묵']);
});

test('연말·연초에는 가까운 해로 날짜를 맞춘다', () => {
  assert.equal(resolveDate(1, 2, new Date(Date.UTC(2026, 11, 30))), '2027-01-02');
  assert.equal(resolveDate(12, 29, new Date(Date.UTC(2027, 0, 2))), '2026-12-29');
});
