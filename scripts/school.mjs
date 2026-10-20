// 제주대 서버 요청. 기본 인증서 목록에 중간 인증서(Sectigo DV R36)를 더해 TLS 검증을 켠 채로 연결한다.

import https from 'node:https';
import tls from 'node:tls';
import { SECTIGO_DV_R36 } from './certs.mjs';

const CA = [...tls.rootCertificates, SECTIGO_DV_R36];
const UA = 'Mozilla/5.0 (compatible; jnu-breakfast/1.0; +https://github.com/ggggbbbb03-dev/jnu-breakfast)';

export function getSchool(url, { redirects = 3, timeout = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: CA, headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(getSchool(new URL(res.headers.location, url).toString(), { redirects: redirects - 1, timeout }));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, url, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('시간 초과')));
    req.on('error', reject);
  });
}
