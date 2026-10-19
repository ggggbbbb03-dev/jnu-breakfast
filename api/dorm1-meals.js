// 학생생활관 1호관 점심·저녁 메뉴 (쉐프스키스 /foodcourt 의 인스타그램 피드에서 읽음)
// 그날 점심·저녁 메뉴가 점심 무렵 한 번에 올라오므로, 한국 시간 10~14시에는 10분,
// 그 외에는 1시간 캐시한다. 인스턴스 메모리에도 5분 보관한다.

import { fetchFoodcourt } from '../scripts/chefskiss.mjs';
import { memo, debugAllowed } from '../scripts/serve.mjs';

const cachedMeals = memo(() => fetchFoodcourt(), 5 * 60 * 1000);

function cacheSeconds(now = new Date()) {
  const kstHour = (now.getUTCHours() + 9) % 24;
  return kstHour >= 10 && kstHour < 14 ? 600 : 3600;
}

export default async function handler(req, res) {
  const debug = debugAllowed(req);
  try {
    const result = debug ? await fetchFoodcourt({ debug }) : await cachedMeals();
    res.setHeader('Cache-Control', debug ? 'no-store' : `public, s-maxage=${cacheSeconds()}, stale-while-revalidate=600`);
    res.status(200).json(result);
  } catch (err) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(502).json({ error: err.message });
  }
}
