const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'breakfast', label: '아침', test: /조식/ },
  { id: 'lunch', label: '점심', test: /중식/ },
  { id: 'dinner', label: '저녁', test: /석식/ },
];

const state = { data: null, date: null, filter: 'all' };

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

// 한국 시간 기준 오늘 (YYYY-MM-DD)
function kstToday() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}

function weekdayOf(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function formatDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[weekdayOf(iso)]})`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

// 식단이 올라온 날짜들 + 오늘. 기본 선택은 오늘, 없으면 가장 가까운 날.
function allDates(data) {
  const set = new Set([kstToday()]);
  for (const cafe of data.cafeterias) for (const day of cafe.days) set.add(day.date);
  return [...set].sort();
}

function pickDefaultDate(dates) {
  const today = kstToday();
  return dates.includes(today) ? today : dates.find((d) => d > today) ?? dates.at(-1);
}

function dayOf(cafe, date) {
  return cafe.days.find((d) => d.date === date) ?? null;
}

function itemList(items) {
  return el('ul', { class: 'items' }, items.map((item) => el('li', {}, item)));
}

function renderDays() {
  const today = kstToday();
  const nav = $('days');
  nav.replaceChildren(
    ...allDates(state.data).map((date) => {
      const [, m, d] = date.split('-').map(Number);
      return el('button', {
        class: `day${date === today ? ' is-today' : ''}`,
        'aria-pressed': String(date === state.date),
        onclick: () => { state.date = date; render(); },
      }, `${WEEKDAYS[weekdayOf(date)]}${date === today ? ' · 오늘' : ''}`, el('small', {}, `${m}/${d}`));
    }),
  );
  nav.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  $('today-label').textContent = `${formatDate(state.date)} 식단`;
}

function cheonwonCards() {
  const date = state.date;
  const weekday = weekdayOf(date);
  const cards = [];

  for (const cafe of state.data.cafeterias) {
    if (!cafe.cheonwon) continue;
    const runs = cafe.cheonwon.weekdays.includes(weekday);
    const day = dayOf(cafe, date);
    const meals = day?.meals.filter((m) => m.cheonwon) ?? [];

    if (meals.length > 0) {
      for (const meal of meals) {
        cards.push(el('article', { class: 'card' },
          el('div', { class: 'card-head' }, el('h3', {}, cafe.name), el('span', { class: 'kind' }, meal.name)),
          el('div', { class: 'badges' },
            el('span', { class: 'badge' }, '1,000원'),
            meal.limit && el('span', { class: 'badge' }, `${meal.limit}개 한정`),
            el('span', { class: 'badge muted' }, cafe.cheonwon.hours.split(' (')[0]),
          ),
          itemList(meal.items),
        ));
      }
      continue;
    }

    // 아침 칸이 미운영이거나, 학교 페이지에 메뉴가 없는 식당(1호관 등)
    const closedMeal = day?.meals.find((m) => /조식/.test(m.name) && m.closed);
    const off = !runs || Boolean(closedMeal);
    cards.push(el('article', { class: `card${off ? ' off' : ''}` },
      el('div', { class: 'card-head' }, el('h3', {}, cafe.name), el('span', { class: 'kind' }, cafe.operator)),
      el('div', { class: 'badges' },
        el('span', { class: off ? 'badge muted' : 'badge' }, off ? '이날 미운영' : '1,000원'),
        el('span', { class: 'badge muted' }, cafe.cheonwon.hours),
      ),
      off
        ? el('p', { class: 'empty' }, closedMeal?.note ?? '운영 요일이 아닙니다.')
        : el('p', { class: 'empty' }, cafe.days.length || !cafe.links
          ? '이날 식단이 아직 올라오지 않았어요.'
          : `${cafe.cheonwon.note}.`),
      cafe.links && el('div', { class: 'links' },
        cafe.links.map((l) => el('a', { href: l.href, target: '_blank', rel: 'noopener' }, `${l.label} ↗`))),
    ));
  }
  $('cheonwon').replaceChildren(...cards);
}

function renderFilter() {
  $('meal-filter').replaceChildren(
    ...FILTERS.map((f) => el('button', {
      role: 'tab',
      'aria-selected': String(f.id === state.filter),
      onclick: () => { state.filter = f.id; render(); },
    }, f.label)),
  );
}

function allMenus() {
  const filter = FILTERS.find((f) => f.id === state.filter);
  const blocks = [];
  for (const cafe of state.data.cafeterias) {
    if (!cafe.days.length && !cafe.error) continue;
    const day = dayOf(cafe, state.date);
    const meals = (day?.meals ?? []).filter((m) => !filter.test || filter.test.test(m.name));
    if (day && filter.test && meals.length === 0) continue;

    blocks.push(el('div', { class: 'cafe' },
      el('h3', { class: 'cafe-title' }, cafe.name, el('a', { href: cafe.url, target: '_blank', rel: 'noopener' }, '원본 ↗')),
      cafe.error && el('p', { class: 'warn' }, `최근 갱신 실패 — ${formatTime(cafe.updatedAt)} 데이터입니다. 원본을 확인하세요.`),
      day
        ? el('div', { class: 'cards' }, meals.map((meal) => el('article', { class: `card${meal.closed ? ' off' : ''}` },
          el('div', { class: 'card-head' }, el('span', { class: 'kind' }, meal.name),
            meal.cheonwon && el('span', { class: 'badge' }, '천원의 아침밥')),
          meal.closed ? el('p', { class: 'empty' }, meal.note) : itemList(meal.items),
        )))
        : el('p', { class: 'empty' }, '이날 식단이 없습니다.'),
    ));
  }
  $('all').replaceChildren(...(blocks.length ? blocks : [el('p', { class: 'empty' }, '선택한 시간대의 식단이 없습니다.')]));
}

function renderInfo() {
  $('info').replaceChildren(...state.data.cafeterias.map((cafe) => el('article', { class: 'card' },
    el('div', { class: 'card-head' }, el('h3', {}, cafe.name), el('span', { class: 'kind' }, cafe.operator)),
    el('ul', {}, cafe.hours.map((h) => el('li', {}, h))),
    cafe.cheonwon && el('p', { class: 'meta' }, `천원의 아침밥: ${cafe.cheonwon.hours} · ${cafe.cheonwon.price}`),
    el('p', { class: 'meta' }, cafe.location),
  )));

  $('foot').replaceChildren(
    el('p', {}, `식단 수집: ${formatTime(state.data.generatedAt)} · 운영 정보 확인일: ${state.data.infoCheckedAt}`),
    el('p', {}, '제주대학교 홈페이지 식단 게시판을 자동으로 모은 비공식 페이지입니다. 메뉴는 식당 사정에 따라 바뀔 수 있고, 공휴일 휴무는 반영되지 않습니다.'),
    el('p', {}, '원본: ', state.data.cafeterias.flatMap((c, i) => [
      i ? ' · ' : '', el('a', { href: c.url, target: '_blank', rel: 'noopener' }, c.name),
    ])),
  );
}

function render() {
  renderDays();
  cheonwonCards();
  renderFilter();
  allMenus();
  renderInfo();
}

async function main() {
  try {
    const res = await fetch('data/menus.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    state.data = await res.json();
  } catch {
    $('cheonwon').replaceChildren(el('p', { class: 'empty' }, '식단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    return;
  }
  state.date = pickDefaultDate(allDates(state.data));
  render();
}

main();
