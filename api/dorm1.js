// 학생생활관 1호관 천원의 아침밥 메뉴 (쉐프스키스 게시판에서 실시간으로 읽음)
// vercel.json 에서 서울 리전(icn1)으로 돌린다. 결과는 CDN 에 3시간 캐시되므로
// 쉐프스키스 쪽 요청은 몇 시간에 한 번 정도만 생긴다.

import { fetchDorm1, probeBoard, BOARDS } from '../scripts/chefskiss.mjs';

export default async function handler(req, res) {
  const debug = req.query?.debug !== undefined;
  if (debug && BOARDS.includes(req.query.board)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await probeBoard(req.query.board).catch((err) => ({ error: err.message })));
    return;
  }
  try {
    const result = await fetchDorm1({ debug });
    res.setHeader('Cache-Control', debug ? 'no-store' : 'public, s-maxage=10800, stale-while-revalidate=86400');
    res.status(200).json(result);
  } catch (err) {
    res.setHeader('Cache-Control', debug ? 'no-store' : 'public, s-maxage=600');
    res.status(502).json({ error: err.message, ...(debug ? { debug: err.debug } : {}) });
  }
}
