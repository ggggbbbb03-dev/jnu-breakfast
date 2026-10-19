import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseManual, gridDates } from '../scripts/manual.mjs';

const TODAY = new Date(Date.UTC(2026, 9, 19));

test('날짜 줄 아래 줄들을 그날 메뉴로 묶는다', () => {
  const { days, errors } = parseManual(`
// 주석은 무시
10/20 (월)
- 우리쌀주먹밥
• 바나나

10월 21일 화요일
참치마요덮밥, 요구르트
[10.22 수] 소불고기 / 미역국
10/24(토) 휴무
`, TODAY);

  assert.deepEqual(errors, []);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-24']);
  assert.deepEqual(days[0].meals[0].items, ['우리쌀주먹밥', '바나나']);
  assert.equal(days[0].meals[0].cheonwon, true);
  assert.equal(days[0].meals[0].name, '조식(천원의 아침밥)');
  assert.equal(days[1].weekday, '화');
  assert.deepEqual(days[1].meals[0].items, ['참치마요덮밥', '요구르트']);
  assert.deepEqual(days[2].meals[0].items, ['소불고기', '미역국']);
  assert.equal(days[3].meals[0].closed, true);
});

test('쉐프스키스 게시글 복사본: 일반식은 백미밥 기준으로 나누고, 못 나누는 간편식은 오류로 알린다', () => {
  const { days, errors } = parseManual(readFileSync(new URL('./fixtures/chefskiss-paste.txt', import.meta.url), 'utf8'), TODAY);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
  const general = days[2].meals.find((m) => m.name === '조식(일반식)');
  assert.equal(general.items.length, 13);
  assert.equal(general.items[1], '얼큰해장국');
  assert.equal(general.items.at(-1), '메이플요거트');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /간편식/);
});

test('간편식도 날짜 줄 형식으로 적으면 같은 날에 합쳐진다', () => {
  const { days } = parseManual(`
천원의 아침밥 간편식
10/19 (월)
(우리쌀)닭죽
우유
천원의 아침밥 식단
10/19 (월)
백미밥
`, TODAY);
  assert.equal(days.length, 1);
  assert.deepEqual(days[0].meals.map((m) => m.name), ['조식(간편식)', '조식(일반식)']);
});

test('요일 칸 날짜는 첫 칸의 월에서 하루씩 이어 붙인다 (월말 넘어감 포함)', () => {
  const dates = gridDates(['금( 10/30)', '토( 31일)', '일( 1일)'], 't', TODAY);
  assert.deepEqual(dates.map((d) => d.date), ['2026-10-30', '2026-10-31', '2026-11-01']);
  assert.throws(() => gridDates(['월( 10/19)', '수( 21일)'], 't', TODAY), /이어지지/);
});

test('같은 날짜가 두 번이면 나중 것을 쓴다', () => {
  const { days } = parseManual('10/20\n옛 메뉴\n10/20\n새 메뉴', TODAY);
  assert.equal(days.length, 1);
  assert.deepEqual(days[0].meals[0].items, ['새 메뉴']);
});

test('주석만 있는 파일은 빈 결과', () => {
  assert.deepEqual(parseManual('// 안내\n// 10/20 (월)\n', TODAY), { days: [], errors: [] });
});
