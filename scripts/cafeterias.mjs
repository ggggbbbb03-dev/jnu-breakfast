// 식당 목록과 운영 정보.
// cheonwon.weekdays 는 천원의 아침밥 운영 요일 (0=일 ~ 6=토). 공휴일은 반영하지 않는다.
// 메뉴는 매번 학교 페이지에서 가져오지만, 운영시간·가격 같은 안내 문구는 표 바깥에 자유 형식으로
// 적혀 있어 자동으로 읽기 어렵다. 아래 값은 checkedAt 날짜에 원본 페이지를 보고 옮긴 것이다.

const BASE = 'https://www.jejunu.ac.kr/camp/stud/foodmenu';

export const CHECKED_AT = '2026-10-19';

export const cafeterias = [
  {
    id: 'dorm6',
    name: '학생생활관 6호관',
    operator: '아이비푸드',
    url: `${BASE}/fixfirst.htm`,
    scrape: true,
    cheonwon: {
      weekdays: [1, 2, 3, 4, 5, 6],
      hours: '월~토 07:30~09:30 (일요일 미운영)',
      price: '1,000원 (재학생만)',
      note: '간편식은 50개 한정',
    },
    hours: ['조식 월~토 07:30~09:30', '중식 월~금 11:40~13:30 / 토·일 11:40~13:00', '석식 매일 17:00~19:00'],
    location: '학생생활관 6호관 F동 지하1층',
  },
  {
    id: 'dorm1',
    name: '학생생활관 1호관',
    operator: '쉐프스키스',
    url: `${BASE}/fixmenu.htm`,
    // 학교 페이지에 날짜별 메뉴가 없고, 업체 사이트(chefskiss.co.kr/morning)는 해외 접속이 막혀
    // GitHub Actions 로는 못 읽는다. 사이트가 서울 리전 함수(api/dorm1.js)로 직접 읽고,
    // 그게 실패할 때를 위해 manual/dorm1.txt 에 손으로 넣은 메뉴를 함께 쓴다.
    scrape: false,
    manual: 'manual/dorm1.txt',
    cheonwon: {
      weekdays: [0, 1, 2, 3, 4, 5],
      hours: '일~금 07:30~09:30 (토요일·공휴일 휴무)',
      price: '1,000원',
      note: '메뉴는 쉐프스키스 홈페이지·인스타그램에 공지',
    },
    links: [
      { label: '인스타그램', href: 'https://www.instagram.com/chefskiss_jnu/' },
      { label: '홈페이지 메뉴', href: 'https://chefskiss.co.kr/morning' },
    ],
    hours: ['아침 07:30~09:30', '점심 11:00~14:00', '저녁 17:00~19:00'],
    location: '학생생활관 1호관 지하1층 GS25 안쪽',
  },
  {
    id: 'baekdu',
    name: '백두관',
    operator: '생활협동조합',
    url: `${BASE}/firstfixmenu.htm`,
    scrape: true,
    // 가격표에 08:30~10:00 / 1,000원 줄이 있지만 항목 이름이 비어 있어 천원의 아침밥으로 단정하지 않는다.
    cheonwon: null,
    hours: ['라면(밥) 08:30~10:00', '중식 11:00~14:30', '일품 11:30~ (한정수량)', '석식 17:00~18:30'],
    location: '아라캠퍼스 백두관',
  },
  {
    id: 'sara',
    name: '사라캠퍼스',
    operator: '',
    url: `${BASE}/secondfixmenu.htm`,
    scrape: true,
    cheonwon: null,
    hours: ['중식 11:00~14:00', '석식 17:00~19:00'],
    location: '사라캠퍼스(교육대학)',
  },
];
