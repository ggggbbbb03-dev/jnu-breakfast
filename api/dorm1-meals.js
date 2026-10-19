// 학생생활관 1호관 점심·저녁 메뉴 (쉐프스키스 /foodcourt 의 인스타그램 피드에서 읽음)
// 메뉴가 점심시간 무렵 올라오므로 아침밥(3시간)보다 짧게 30분 캐시한다.

import { fetchFoodcourt } from '../scripts/chefskiss.mjs';

export default async function handler(req, res) {
  const debug = req.query?.debug !== undefined;
  try {
    const result = await fetchFoodcourt({ debug });
    res.setHeader('Cache-Control', debug ? 'no-store' : 'public, s-maxage=1800, stale-while-revalidate=1800');
    res.status(200).json(result);
  } catch (err) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(502).json({ error: err.message });
  }
}
