// 실제 쉐프스키스 HTML은 해외에서 볼 수 없어, 게시글 캡처를 보고 같은 모양의 표를 만들어 시험한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findPosts, parsePost, parseFoodcourt } from '../scripts/chefskiss.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const TODAY = new Date(Date.UTC(2026, 9, 19));

test('게시판 목록에서 글 주소를 최신순으로 뽑는다', () => {
  const posts = findPosts(fixture('chefskiss-list.html'));
  assert.equal(posts.length, 2);
  assert.equal(posts[0], 'https://chefskiss.co.kr/morning/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=175102536&t=board');
});

test('게시글의 일반식·간편식 표를 날짜별로 합친다', () => {
  const { days, errors } = parsePost(fixture('chefskiss-post.html'), TODAY);
  assert.deepEqual(errors, []);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
  const tue = days[2];
  assert.equal(tue.weekday, '화');
  assert.deepEqual(tue.meals.map((m) => m.name), ['조식(간편식)', '조식(일반식)']);
  assert.deepEqual(tue.meals[0].items, ['(우리쌀) 누룽지설렁탕', '에그머핀계란빵', '카프리썬']);
  assert.equal(tue.meals[1].items.length, 13);
  assert.equal(tue.meals[1].items[1], '얼큰해장국');
  assert.ok(days.every((d) => d.meals.every((m) => m.cheonwon)));
});

test('표가 없고 글자만 있으면 붙여넣기 형식으로 읽어 본다', () => {
  const html = `<div>${fixture('chefskiss-paste.txt').split('\n').map((l) => `<p>${l}</p>`).join('')}</div>`;
  const { days } = parsePost(html, TODAY);
  assert.equal(days.length, 6);
});

test('푸드코트 인스타그램 피드에서 날짜별 점심·저녁을 읽는다', () => {
  const days = parseFoodcourt(fixture('chefskiss-foodcourt.html'), TODAY);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-18', '2026-10-19']);
  const mon = days[1];
  assert.deepEqual(mon.meals.map((m) => m.name), ['중식', '석식']);
  assert.equal(mon.meals[0].items[2], '흑돈샤브샤브');
  assert.equal(mon.meals[0].items.length, 9);
  assert.equal(mon.meals[1].items[2], '치킨스테이크');
  // 메뉴 없는 "점심 저녁" 글, 아침밥 글, 해시태그·꼬리말은 들어가지 않는다
  assert.deepEqual(days[0].meals[0].items, ['백미밥', '콩나물국', '흑돈소금구이', '구운양파지']);
  assert.ok(days.every((d) => d.meals.every((m) => !m.cheonwon)));
});
