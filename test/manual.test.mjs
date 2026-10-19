import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManual } from '../scripts/manual.mjs';

const TODAY = new Date(Date.UTC(2026, 9, 19));
const NAME = '조식(천원의 아침밥)';

test('날짜 줄 아래 줄들을 그날 메뉴로 묶는다', () => {
  const days = parseManual(`
// 주석은 무시
10/20 (월)
- 우리쌀주먹밥
• 바나나

10월 21일 화요일
참치마요덮밥, 요구르트
[10.22 수] 소불고기 / 미역국
10/24(토) 휴무
`, NAME, TODAY);

  assert.deepEqual(days.map((d) => d.date), ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-24']);
  assert.deepEqual(days[0].meals[0].items, ['우리쌀주먹밥', '바나나']);
  assert.equal(days[0].meals[0].cheonwon, true);
  assert.equal(days[0].meals[0].name, NAME);
  assert.equal(days[1].weekday, '화');
  assert.deepEqual(days[1].meals[0].items, ['참치마요덮밥', '요구르트']);
  assert.deepEqual(days[2].meals[0].items, ['소불고기', '미역국']);
  assert.equal(days[3].meals[0].closed, true);
});

test('같은 날짜가 두 번이면 나중 것을 쓴다', () => {
  const days = parseManual('10/20\n옛 메뉴\n10/20\n새 메뉴', NAME, TODAY);
  assert.equal(days.length, 1);
  assert.deepEqual(days[0].meals[0].items, ['새 메뉴']);
});

test('주석만 있는 파일은 빈 결과', () => {
  assert.deepEqual(parseManual('// 안내\n// 10/20 (월)\n', NAME, TODAY), []);
});
