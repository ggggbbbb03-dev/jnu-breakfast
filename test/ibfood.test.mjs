import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeIbfood, parseIbList, parseIbPostImage, weekAfter } from '../scripts/ibfood.mjs';

const fixture = (name) => decodeIbfood(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('목록: 6호관 주간식단표 글을 최신순으로', () => {
  const posts = parseIbList(fixture('ibfood-list.html'));
  assert.equal(posts.length, 10);
  assert.deepEqual(posts[0], { idx: '222', title: '제주대 학생생활관 6호관 식당 10월 5주차 주간식단표', date: '2026-10-22' });
});

test('글: 식단표 그림 주소', () => {
  assert.equal(
    parseIbPostImage(fixture('ibfood-post.html'), '222'),
    'https://ibfood8.cafe24.com/bizdemo148505/component/board/board_5/u_image/222/946426613_32b0eae9cf5e.jpg',
  );
  assert.equal(parseIbPostImage('<img src="/resource/skins/list.gif">', '222'), null);
});

test('올린 날 다음 월요일부터 일주일', () => {
  assert.deepEqual(weekAfter('2026-10-22'), { start: '2026-10-26', end: '2026-11-01' }); // 목
  assert.deepEqual(weekAfter('2026-10-07'), { start: '2026-10-12', end: '2026-10-18' }); // 수
  assert.deepEqual(weekAfter('2026-10-26'), { start: '2026-11-02', end: '2026-11-08' }); // 월이면 다음 주
});
