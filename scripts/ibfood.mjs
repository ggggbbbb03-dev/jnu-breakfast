// 아이비푸드(학생생활관 6호관 운영 업체) 게시판의 주간식단표.
// 업체는 다음 주 식단표를 그 전 주 수·목요일에 그림(jpg)으로 올린다. 학교 페이지는 보통 그 주가 되어서야
// 바뀌므로, 학교 페이지에 아직 없는 날은 이 그림을 그대로 보여 준다.
// 그림 속 글자를 자동으로 읽으면(OCR) 메뉴 이름이 틀리기 쉬워, 글자로 바꾸지 않는다.

export const IBFOOD_ORIGIN = 'https://ibfood8.cafe24.com';
export const IBFOOD_BOARD = `${IBFOOD_ORIGIN}/default/02/01.php?com_board_id=5`;

// 게시판은 EUC-KR 이다.
export function decodeIbfood(buffer) {
  return new TextDecoder('euc-kr').decode(buffer);
}

// 목록에서 6호관 주간식단표 글들 (최신순)
export function parseIbList(html) {
  const posts = [];
  for (const row of html.matchAll(/<tr class="item-line[\s\S]*?<\/tr>/g)) {
    const idx = row[0].match(/com_board_idx=(\d+)/)?.[1];
    const title = row[0].match(/item_cell_subject">[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/)?.[1]?.replace(/\s+/g, ' ').trim();
    const date = row[0].match(/item_group4">\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    if (idx && title && date && /6호관/.test(title) && /주간식단/.test(title)) posts.push({ idx, title, date });
  }
  return posts;
}

// 글 본문에서 식단표 그림 주소
export function parseIbPostImage(html, idx) {
  const src = html.match(new RegExp(`src=["']?([^"' >]*/u_image/${idx}/[^"' >]+\\.(?:jpe?g|png|gif))`, 'i'))?.[1];
  return src ? new URL(src, IBFOOD_ORIGIN).toString() : null;
}

// 올린 날 다음 월요일부터 일주일 (예: 10/22(목) 글 → 10/26~11/1)
export function weekAfter(postDate) {
  const d = new Date(`${postDate}T00:00:00Z`);
  const toMonday = ((8 - d.getUTCDay()) % 7) || 7;
  const start = new Date(d.getTime() + toMonday * 864e5);
  const end = new Date(start.getTime() + 6 * 864e5);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
