import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memo, debugAllowed } from '../scripts/serve.mjs';
import { holidays } from '../scripts/holidays.mjs';

test('memo: 보관 시간 안에는 다시 부르지 않는다', async () => {
  let calls = 0;
  const get = memo(async () => ++calls, 60_000);
  assert.equal(await get(), 1);
  assert.equal(await get(), 1);
  assert.equal(calls, 1);
});

test('진단 모드는 DEBUG_TOKEN 이 있고 값이 맞을 때만', () => {
  const saved = process.env.DEBUG_TOKEN;
  delete process.env.DEBUG_TOKEN;
  assert.equal(debugAllowed({ query: { debug: '' } }), false);
  process.env.DEBUG_TOKEN = 'secret';
  assert.equal(debugAllowed({ query: { debug: 'wrong' } }), false);
  assert.equal(debugAllowed({ query: { debug: 'secret' } }), true);
  if (saved === undefined) delete process.env.DEBUG_TOKEN; else process.env.DEBUG_TOKEN = saved;
});

test('공휴일 목록 날짜 형식', () => {
  for (const date of Object.keys(holidays)) assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(holidays['2027-02-07'], '설날');
});
