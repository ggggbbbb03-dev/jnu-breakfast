// 학생생활관 1호관 천원의 아침밥 메뉴 (쉐프스키스 게시판에서 읽음)
// vercel.json 에서 서울 리전(icn1)으로 돌린다. 결과는 CDN 에 3시간 캐시하고,
// 인스턴스 메모리에도 30분 보관해 쉐프스키스 쪽 요청을 줄인다.

import { fetchDorm1 } from '../scripts/chefskiss.mjs';
import { memo, debugAllowed } from '../scripts/serve.mjs';

const cachedDorm1 = memo(() => fetchDorm1(), 30 * 60 * 1000);

export default async function handler(req, res) {
  const debug = debugAllowed(req);
  try {
    const result = debug ? await fetchDorm1({ debug }) : await cachedDorm1();
    res.setHeader('Cache-Control', debug ? 'no-store' : 'public, s-maxage=10800, stale-while-revalidate=86400');
    res.status(200).json(result);
  } catch (err) {
    res.setHeader('Cache-Control', debug ? 'no-store' : 'public, s-maxage=600');
    res.status(502).json({ error: err.message, ...(debug ? { debug: err.debug } : {}) });
  }
}
