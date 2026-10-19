// api/*.js 공용: 쉐프스키스로 가는 요청을 줄이기 위한 장치들.

// 결과를 함수 인스턴스 메모리에 잠깐 보관한다. 주소 뒤에 ?x=… 를 붙여 CDN 캐시를 피해도
// 같은 인스턴스에서는 ttl 동안 쉐프스키스에 다시 요청하지 않는다.
export function memo(fn, ttlMs) {
  let cached = null;
  return async () => {
    if (cached && Date.now() - cached.at < ttlMs) return cached.value;
    const value = await fn();
    cached = { at: Date.now(), value };
    return value;
  };
}

// 진단 모드는 Vercel 환경 변수 DEBUG_TOKEN 과 같은 값을 ?debug= 로 줄 때만 켠다.
// 환경 변수가 없으면 진단 모드는 꺼져 있다.
export function debugAllowed(req) {
  const token = process.env.DEBUG_TOKEN;
  return Boolean(token) && req.query?.debug === token;
}
