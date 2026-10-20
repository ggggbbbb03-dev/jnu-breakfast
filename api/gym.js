// 체육진흥센터(spc.jejunu.ac.kr) 헬스장 안내.
// 1단계(임시): 사이트 구조를 보기 위한 조사 모드. 구조를 확인한 뒤 실제 수집으로 바꾼다.
// 조사는 spc.jejunu.ac.kr 의 경로만 허용하고, 결과를 CDN 에 1시간 캐시한다.

import { getSchool } from '../scripts/school.mjs';

const ORIGIN = 'https://spc.jejunu.ac.kr';

function toLines(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  const path = typeof req.query?.probe === 'string' && req.query.probe.startsWith('/') ? req.query.probe : '/';
  try {
    const page = await getSchool(new URL(path, ORIGIN).toString());
    const links = [...page.text.matchAll(/<a[^>]*href="([^"#]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => `${toLines(m[2]).join(' ')} ${m[1]}`.trim())
      .filter((l) => /체력|헬스|피트|운영|이용|시간|휴관|공지|시설|안내|체육관|운동장|테니스|wcmsje/.test(l));
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.status(200).json({ status: page.status, url: page.url, links: [...new Set(links)].slice(0, 80), lines: toLines(page.text).slice(0, 250) });
  } catch (err) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(502).json({ error: err.message, code: err.code });
  }
}
