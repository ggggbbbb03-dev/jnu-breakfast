const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// 의견 보내기 (구글 설문지 주소). 비워 두면 버튼이 나타나지 않는다.
const FEEDBACK_URL = '';
const MEALS = [
  { id: 'breakfast', label: '아침', test: /조식/, until: 10 * 60 },
  { id: 'lunch', label: '점심', test: /중식/, until: 15 * 60 },
  { id: 'dinner', label: '저녁', test: /석식/, until: 24 * 60 },
];
// 저녁이 모두 끝난 뒤(가장 늦은 석식 19:00 + 30분)에는 내일 아침을 먼저 보여 준다
const NIGHT_FROM = 19 * 60 + 30;
// 밥·김치·기본 샐러드처럼 매일 나오는 것은 흐리게, 그 다음 첫 메뉴(대표 메뉴)는 굵게
const BASIC = /^(백미밥|흑미밥|보리밥|현미밥|잡곡밥|추가밥|.*김치|깍두기|석박지|단무지|오이피클|피클|(그린|믹스|양배추)샐러드.*|샐러드 \+.*|시리얼.*|씨리얼.*|식빵&잼|셀프토스트.*|우유)$/;

// 식당 순서는 이 휴대폰(브라우저)에만 저장한다. 저장소가 막혀 있으면 기본 순서를 쓴다.
const ORDER_KEY = 'jnu-breakfast:order';
const state = { data: null, date: null, meal: null, order: loadOrder() };

function loadOrder() {
  try {
    const value = JSON.parse(localStorage.getItem(ORDER_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function saveOrder(order) {
  state.order = order;
  try {
    if (order.length) localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    else localStorage.removeItem(ORDER_KEY);
  } catch {
    // 저장이 안 돼도 이번 방문 동안은 바뀐 순서를 쓴다
  }
}
// 사용자가 정한 순서대로. 목록에 없는 식당(새로 추가된 식당 등)은 기본 순서로 뒤에 붙인다.
function orderedCafes() {
  const rank = (cafe) => {
    const i = state.order.indexOf(cafe.id);
    return i === -1 ? state.order.length + state.data.cafeterias.indexOf(cafe) : i;
  };
  return [...state.data.cafeterias].sort((a, b) => rank(a) - rank(b));
}

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

// 한국 시간 기준 지금
function kstNow() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function nextDay(iso) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
}

function prevDay(iso) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
}

function isNight() {
  return kstNow().minutes >= NIGHT_FROM;
}

function weekdayOf(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// times 값은 '07:30-09:30' 이거나 [평일, 주말]
function timeRange(cafe, mealId, date) {
  const value = cafe.times?.[mealId];
  if (!value) return null;
  const wd = weekdayOf(date);
  const text = Array.isArray(value) ? value[wd === 0 || wd === 6 ? 1 : 0] : value;
  const [start, end] = text.split('-');
  return { start: toMinutes(start), end: toMinutes(end), label: `${start}~${end}` };
}

function statusOf(range, date) {
  const now = kstNow();
  if (!range || date !== now.date) return null;
  if (now.minutes < range.start) {
    const left = range.start - now.minutes;
    return left <= 60 ? { cls: 'soon', text: `${left}분 뒤 시작` } : { cls: 'soon', text: '운영 전' };
  }
  if (now.minutes < range.end) {
    const left = range.end - now.minutes;
    return { cls: 'live', text: left <= 30 ? `${left}분 남음` : '운영 중' };
  }
  return { cls: 'done', text: '마감' };
}

// 어제부터 식단이 올라온 날짜들 + 오늘 (밤에는 내일도).
// 1호관 인스타그램 피드에는 지난 글이 남아 있어, 지난 날짜는 어제까지만 보여 준다.
function allDates(data) {
  const today = kstNow().date;
  const from = prevDay(today);
  const set = new Set([today]);
  if (isNight()) set.add(nextDay(today));
  for (const cafe of data.cafeterias) for (const day of cafe.days) if (day.date >= from) set.add(day.date);
  return [...set].sort();
}

function pickDefaultDate(dates) {
  const today = kstNow().date;
  const target = isNight() ? nextDay(today) : today;
  return dates.includes(target) ? target : dates.find((d) => d > target) ?? dates.at(-1);
}

function pickDefaultMeal() {
  if (isNight()) return 'breakfast';
  const { minutes } = kstNow();
  return MEALS.find((m) => minutes < m.until).id;
}

function dayOf(cafe, date) {
  return cafe.days.find((d) => d.date === date) ?? null;
}

function mealsFor(cafe, date, mealId) {
  const test = MEALS.find((m) => m.id === mealId).test;
  return (dayOf(cafe, date)?.meals ?? []).filter((m) => test.test(m.name));
}

function shortName(meal) {
  // "조식(간편식)" → "간편식", "중식1" → "중식1", "중식" → "" (탭 이름과 같으면 생략)
  const inner = meal.name.match(/\((.+)\)/)?.[1];
  if (inner) return inner === '천원의 아침밥' ? '' : inner;
  return /^(조식|중식|석식)$/.test(meal.name) ? '' : meal.name;
}

function itemList(items) {
  let mainMarked = false;
  const list = items.map((item) => {
    const basic = BASIC.test(item);
    const main = !basic && !mainMarked;
    if (main) mainMarked = true;
    return el('li', { class: main ? 'main' : basic ? 'basic' : null }, item);
  });
  return el('ul', { class: `items${items.length > 6 ? ' two' : ''}` }, list);
}

function linkRow(links) {
  return el('div', { class: 'links' },
    links.map((l) => el('a', { href: l.href, target: '_blank', rel: 'noopener' }, `${l.label} ↗`)));
}

/* 날짜 */
function renderDays() {
  const today = kstNow().date;
  const withMenu = new Set(state.data.cafeterias.flatMap((c) => c.days.map((d) => d.date)));
  const nav = $('days');
  nav.replaceChildren(
    ...allDates(state.data).map((date) => {
      const wd = weekdayOf(date);
      const d = Number(date.slice(8));
      return el('button', {
        class: ['day', date === today && 'is-today', (wd === 0 || holidayOf(date)) && 'sun', wd === 6 && !holidayOf(date) && 'sat', !withMenu.has(date) && 'empty'].filter(Boolean).join(' '),
        'aria-pressed': String(date === state.date),
        'aria-label': `${Number(date.slice(5, 7))}월 ${d}일 ${WEEKDAYS[wd]}요일${date === today ? ' (오늘)' : ''}`,
        onclick: () => { state.date = date; render(); },
      }, el('span', { class: 'dow' }, date === today ? '오늘' : date === nextDay(today) ? '내일' : WEEKDAYS[wd]), el('span', { class: 'dnum' }, d));
    }),
  );
  nav.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  const [, m, d] = state.date.split('-').map(Number);
  $('title').textContent = state.date === today ? '오늘의 학식'
    : state.date === nextDay(today) ? '내일의 학식'
    : `${m}월 ${d}일 (${WEEKDAYS[weekdayOf(state.date)]}) 학식`;
}

/* 끼니 탭 */
function renderTabs() {
  $('tabs').replaceChildren(
    ...MEALS.map((meal) => {
      const count = plan(meal.id).shown.length;
      return el('button', {
        class: 'tab',
        role: 'tab',
        'aria-selected': String(meal.id === state.meal),
        onclick: () => { state.meal = meal.id; render(); },
      }, meal.label, el('small', {}, count ? `${count}곳` : '–'));
    }),
  );
}

function holidayOf(date) {
  return state.data.holidays?.[date] ?? null;
}

function priceOf(cafe) {
  return state.meal === 'breakfast' && cafe.cheonwon ? '1,000원' : cafe.prices?.[state.meal];
}

function cardHead(cafe) {
  const range = timeRange(cafe, state.meal, state.date);
  const status = holidayOf(state.date) && range
    ? { cls: 'off', text: '공휴일 · 운영 확인' }
    : statusOf(range, state.date);
  return el('div', { class: 'card-head' },
    el('div', {},
      el('h3', { class: 'card-title' }, cafe.name),
      el('p', { class: 'card-sub' }, [range?.label, priceOf(cafe)].filter(Boolean).join(' · ')),
    ),
    status && el('span', { class: `status ${status.cls}` }, status.text),
  );
}

/* 식당 카드 */
function cafeCard(cafe, meals) {
  return el('article', { class: 'card' },
    cardHead(cafe),
    meals.map((meal) => el('section', { class: 'meal' },
      (shortName(meal) || meal.cheonwon || meal.limit) && el('div', { class: 'meal-head' },
        shortName(meal) && el('span', { class: 'meal-name' }, shortName(meal)),
        meal.cheonwon && el('span', { class: 'tag' }, '천원의 아침밥'),
        meal.limit && el('span', { class: 'tag plain' }, `${meal.limit}개 한정`),
      ),
      meal.closed ? el('p', { class: 'note' }, meal.note || '미운영') : itemList(meal.items),
    )),
    cafe.error && el('p', { class: 'warn' }, `최근 갱신 실패 — ${formatTime(cafe.updatedAt)} 기준 식단입니다.`),
    cafe.live && linkRow(sourceLinks(cafe)),
  );
}

// 1호관 원본 링크: 아침은 이번 주 아침밥 글, 점심·저녁은 푸드코트(인스타그램 피드) 페이지
function sourceLinks(cafe) {
  const insta = (cafe.links ?? []).filter((l) => /instagram/.test(l.href));
  if (state.meal === 'breakfast') {
    return [{ label: '아침밥 원본', href: cafe.breakfastSource ?? 'https://chefskiss.co.kr/morning' }, ...insta];
  }
  return [{ label: '푸드코트 원본', href: 'https://chefskiss.co.kr/foodcourt' }, ...insta];
}

// 1호관처럼 업체 사이트에서 따로 받는 식당: 메뉴가 아직 없을 때 안내 카드
function pendingCard(cafe) {
  const text = state.meal === 'breakfast'
    ? '이 날 아침밥 식단이 아직 올라오지 않았어요.'
    : '점심·저녁 메뉴는 보통 점심시간 무렵 인스타그램에 올라와요.';
  return el('article', { class: 'card muted' },
    cardHead(cafe),
    el('p', { class: 'note' }, text),
    linkRow(sourceLinks(cafe)),
  );
}

function runsOn(cafe, mealId, date) {
  if (mealId === 'breakfast') return Boolean(cafe.cheonwon?.weekdays.includes(weekdayOf(date)));
  return Boolean(cafe.times?.[mealId]);
}

// 선택한 날짜·끼니에 어떤 식당을 카드로 보여 주고(shown), 어떤 식당을 '미운영'으로 적을지(closed).
// 탭의 'N곳' 숫자와 실제 카드 수가 같도록 둘 다 이 함수를 쓴다.
function plan(mealId) {
  const shown = [];
  const closed = [];
  const holiday = holidayOf(state.date);
  for (const cafe of orderedCafes()) {
    const meals = mealsFor(cafe, state.date, mealId);
    if (holiday && cafe.closedOnHolidays) closed.push(`${cafe.name}(공휴일 휴무)`);
    else if (meals.some((m) => !m.closed)) shown.push({ cafe, meals });
    else if (cafe.id === 'dorm1' && runsOn(cafe, mealId, state.date) && state.date >= kstNow().date) shown.push({ cafe, pending: true });
    else if (runsOn(cafe, mealId, state.date) || meals.length) closed.push(cafe.name);
  }
  return { shown, closed };
}

function renderMain() {
  const { shown, closed } = plan(state.meal);
  const cards = shown.map((s) => (s.pending ? pendingCard(s.cafe) : cafeCard(s.cafe, s.meals)));
  const holiday = holidayOf(state.date);

  const children = [];
  if (holiday) {
    children.push(el('p', { class: 'banner holiday' },
      el('span', { class: 'big', 'aria-hidden': 'true' }, '🎌'),
      el('span', {}, el('strong', {}, holiday), ' — 공휴일에는 식당마다 운영이 달라요. 가기 전에 확인하세요.')));
  }
  if (state.meal === 'breakfast' && cards.length) {
    children.push(el('p', { class: 'banner' },
      el('span', { class: 'big', 'aria-hidden': 'true' }, '🍚'),
      el('span', {}, el('strong', {}, '천원의 아침밥'), ' — 재학생은 아침 한 끼 1,000원')));
  }
  if (cards.length > 1) {
    children.push(el('div', { class: 'tools' },
      el('button', { class: 'text-button', type: 'button', onclick: openOrder }, '↕ 식당 순서 바꾸기')));
  }
  children.push(cards.length
    ? el('div', { class: 'grid' }, cards)
    : el('div', { class: 'empty-state' },
      el('div', { class: 'big', 'aria-hidden': 'true' }, '🍽️'),
      el('p', {}, '이 날은 올라온 식단이 없어요.')));
  if (closed.length) children.push(el('p', { class: 'closed-list' }, `식단 없음 · 미운영: ${closed.join(', ')}`));
  $('main').replaceChildren(...children);
}

/* 식당 순서 바꾸기 */
function openOrder() {
  renderOrderList();
  $('order-sheet').showModal();
}

function moveCafe(id, delta) {
  const ids = orderedCafes().map((c) => c.id);
  const i = ids.indexOf(id);
  const j = i + delta;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  saveOrder(ids);
  renderOrderList();
  renderMain();
  renderInfo();
  // 방금 누른 버튼에 초점을 유지해 연달아 누르기 쉽게
  $('order-list').querySelector(`[data-id="${id}"] [data-dir="${delta}"]`)?.focus();
}

function renderOrderList() {
  const cafes = orderedCafes();
  $('order-list').replaceChildren(...cafes.map((cafe, i) => el('li', { 'data-id': cafe.id },
    el('span', { class: 'order-num' }, i + 1),
    el('span', { class: 'order-name' }, cafe.name),
    el('button', { type: 'button', class: 'order-btn', 'data-dir': '-1', 'aria-label': `${cafe.name} 위로`, disabled: i === 0, onclick: () => moveCafe(cafe.id, -1) }, '↑'),
    el('button', { type: 'button', class: 'order-btn', 'data-dir': '1', 'aria-label': `${cafe.name} 아래로`, disabled: i === cafes.length - 1, onclick: () => moveCafe(cafe.id, 1) }, '↓'),
  )));
}

function resetOrder() {
  saveOrder([]);
  renderOrderList();
  renderMain();
  renderInfo();
}

/* 식당 정보 · 꼬리말 */
function renderInfo() {
  $('info').replaceChildren(...orderedCafes().map((cafe) => el('details', {},
    el('summary', {}, cafe.name, el('span', {}, cafe.operator)),
    el('ul', {}, cafe.hours.map((h) => el('li', {}, h))),
    cafe.cheonwon && el('p', {}, `천원의 아침밥: ${cafe.cheonwon.hours} · ${cafe.cheonwon.price}`),
    el('p', {}, `${cafe.location} · `,
      el('a', { href: cafe.id === 'dorm1' ? 'https://chefskiss.co.kr/foodcourt' : cafe.url, target: '_blank', rel: 'noopener' }, '원본 식단 ↗')),
  )));

  $('foot').replaceChildren(
    FEEDBACK_URL && el('a', { class: 'feedback', href: FEEDBACK_URL, target: '_blank', rel: 'noopener' }, '💬 의견 보내기 · 틀린 메뉴 제보'),
    el('p', {}, `식단 마지막 변경 ${formatTime(state.data.generatedAt)} · 운영 정보 확인일 ${state.data.infoCheckedAt}`),
    el('p', {}, '제주대학교 홈페이지와 쉐프스키스(1호관) 사이트의 식단을 자동으로 모은 비공식 페이지입니다. 메뉴는 식당 사정에 따라 바뀔 수 있고, 공휴일 휴무는 반영되지 않습니다.'),
  );
}

function renderNow() {
  const { minutes } = kstNow();
  $('now').textContent = `지금 ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function render() {
  renderNow();
  renderDays();
  renderTabs();
  renderMain();
}

async function main() {
  try {
    const res = await fetch('data/menus.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    state.data = await res.json();
  } catch {
    $('main').replaceChildren(el('div', { class: 'empty-state' }, el('p', {}, '식단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')));
    return;
  }
  state.date = pickDefaultDate(allDates(state.data));
  state.meal = pickDefaultMeal();
  render();
  renderInfo();
  $('order-reset').onclick = resetOrder;
  loadDorm1();
  // 운영 상태 표시를 1분마다 새로 고친다
  setInterval(() => { renderNow(); renderMain(); }, 60_000);
}

// 1호관 메뉴는 해외 접속이 막힌 업체 사이트에 있어, 서울 리전 함수로 따로 받는다.
//   /api/dorm1        천원의 아침밥 (일반식·간편식)
//   /api/dorm1-meals  점심·저녁 (인스타그램 피드)
// 실패하면 menus.json 에 있는 값(직접 입력분)을 그대로 쓴다.
async function getJson(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null; // 함수가 없거나(로컬 실행) 실패하면 조용히 넘어간다
  }
}

function mergeDays(byDate, days, replace) {
  for (const day of days) {
    const target = byDate.get(day.date) ?? { date: day.date, weekday: day.weekday, meals: [] };
    target.meals = target.meals.filter((m) => !replace(m, day)).concat(day.meals);
    byDate.set(day.date, target);
  }
}

async function loadDorm1() {
  const cafe = state.data.cafeterias.find((c) => c.id === 'dorm1');
  if (!cafe) return;
  const [breakfast, meals] = await Promise.all([getJson('api/dorm1'), getJson('api/dorm1-meals')]);
  if (!breakfast?.days?.length && !meals?.days?.length) return;

  const byDate = new Map(cafe.days.map((d) => [d.date, d]));
  if (breakfast?.days?.length) {
    mergeDays(byDate, breakfast.days, (m) => /조식/.test(m.name));
    cafe.breakfastSource = breakfast.source;
  }
  if (meals?.days?.length) {
    mergeDays(byDate, meals.days, (m, day) => day.meals.some((x) => x.name === m.name));
  }
  cafe.live = true;
  cafe.days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const keep = state.date;
  const dates = allDates(state.data);
  state.date = dates.includes(keep) ? keep : pickDefaultDate(dates);
  render();
}

/* 앱 설치 (홈 화면에 추가) */
// - 안드로이드 크롬·삼성 인터넷: 브라우저가 주는 설치 창을 버튼으로 띄운다
// - 아이폰: 설치 창이 없어서 공유 메뉴 → '홈 화면에 추가' 안내를 보여 준다
// - 카카오톡 등 앱 안 브라우저: 설치가 안 되므로 다른 브라우저로 여는 법을 안내한다
function setupInstall() {
  const button = $('install');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;

  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(ua);
  let deferred = null;

  const guide = (steps) => {
    $('guide-steps').replaceChildren(...steps.map((t) => el('li', {}, t)));
    $('install-guide').showModal();
  };

  if (inApp) {
    button.hidden = false;
    button.onclick = () => guide(ios
      ? ['오른쪽 아래 공유(또는 ⋯) 버튼을 누르세요.', "'Safari로 열기'를 고르세요.", "Safari에서 공유 버튼 → '홈 화면에 추가'를 누르세요."]
      : ['오른쪽 위(또는 아래) ⋮ 버튼을 누르세요.', "'다른 브라우저로 열기'를 고르세요.", "크롬에서 다시 '앱 설치' 버튼을 누르세요."]);
    return;
  }
  if (ios) {
    button.hidden = false;
    button.onclick = () => guide(['화면 아래(또는 위) 공유 버튼 □↑ 을 누르세요.', "메뉴를 내려 '홈 화면에 추가'를 누르세요.", "오른쪽 위 '추가'를 누르면 홈 화면에 아이콘이 생깁니다."]);
    return;
  }
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    button.hidden = false;
  });
  button.onclick = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    button.hidden = true;
  };
  addEventListener('appinstalled', () => { button.hidden = true; });
}

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

setupInstall();
main();
