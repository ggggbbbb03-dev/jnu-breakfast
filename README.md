# 제주대 천원의 아침밥 모아보기

제주대학교 홈페이지에 식당별로 나뉘어 있는 식단표를 한 화면에 모은 비공식 페이지입니다.
맨 위에 그날의 **천원의 아침밥**을 모아 보여 주고, 아래에 식당별 전체 식단을 보여 줍니다.

## 모으는 곳

| 식당 | 원본 | 천원의 아침밥 | 메뉴 수집 |
| --- | --- | --- | --- |
| 학생생활관 6호관 | [fixfirst.htm](https://www.jejunu.ac.kr/camp/stud/foodmenu/fixfirst.htm) | 월~토, 간편식·일반식 | 자동 |
| 학생생활관 1호관 | [chefskiss.co.kr/morning](https://chefskiss.co.kr/morning) | 일~금, 일반식·간편식 | 자동 (Vercel 서울 리전 함수, 점심·저녁 포함) + 예비로 직접 입력 |
| 백두관 | [firstfixmenu.htm](https://www.jejunu.ac.kr/camp/stud/foodmenu/firstfixmenu.htm) | 표기 없음 | 자동 |
| 사라캠퍼스 | [secondfixmenu.htm](https://www.jejunu.ac.kr/camp/stud/foodmenu/secondfixmenu.htm) | 없음 | 자동 |

운영시간·가격 같은 안내 문구는 [`scripts/cafeterias.mjs`](scripts/cafeterias.mjs)에 손으로 옮겨 두었습니다 (`CHECKED_AT` 날짜 기준).
학교 안내가 바뀌면 이 파일을 고쳐 주세요.

## 1호관 (쉐프스키스)

쉐프스키스 사이트는 해외 접속이 막혀 GitHub Actions(미국)로는 읽을 수 없습니다.
그래서 Vercel **서울 리전(icn1)** 에서 도는 [`api/dorm1.js`](api/dorm1.js)가 방문 시점에
`/morning` 게시판의 최신 글을 읽어 표를 날짜별 메뉴로 바꿉니다. 결과는 CDN 에 3시간 캐시됩니다.

- 점심·저녁은 `/foodcourt` 페이지에 붙어 있는 인스타그램 피드 글("2026년 10월 19일 점심메뉴입니다" …)을
  [`api/dorm1-meals.js`](api/dorm1-meals.js)가 읽습니다. 매일 점심 무렵 한 번에 올라오므로 한국 시간 10~14시에는 10분, 그 외에는 1시간 캐시합니다.
- 진단 모드: Vercel 환경 변수 `DEBUG_TOKEN` 을 정해 두면 `/api/dorm1?debug=<그 값>` 으로 어디서 막혔는지 볼 수 있습니다.
  환경 변수가 없으면 진단 모드는 꺼져 있습니다 (아무나 캐시를 건너뛰어 쉐프스키스에 요청을 보내지 못하게).
- 이 함수가 실패하면 [`manual/dorm1.txt`](manual/dorm1.txt) 에 손으로 넣은 메뉴를 씁니다.
  게시글 내용을 그대로 붙여 넣어도 되지만, 간편식처럼 날짜 경계를 알 수 없는 표는
  `10/20 (월)` 같은 날짜 줄 형식으로 정리해야 읽힙니다.

## 고장 알림

수집 워크플로 마지막에 `npm run check` 가 돕니다. 학교 식단이 며칠째 갱신되지 않거나, 갱신 실패가 기록됐거나,
1호관 서울 함수가 응답하지 않으면 실패하고, GitHub 가 저장소 주인에게 실패 메일을 보냅니다.

## 공휴일

[`scripts/holidays.mjs`](scripts/holidays.mjs) — 한국천문연구원 달력자료 기준. 임시공휴일이 생기면 추가해 주세요.
1호관은 원본에 '공휴일 휴무'가 적혀 있어 공휴일에 휴무로 표시하고, 나머지 식당은 '운영 확인'으로 표시합니다.

## 헬스장

체육관 지하 피트니스센터 시간표는 화면 오른쪽 아래 작은 칩으로 보여 줍니다 (누르면 시간표가 펼쳐짐).
값은 [`public/app.js`](public/app.js) 의 `GYM` 에 손으로 옮겨 두었습니다.
출처는 시설물예약시스템 공지 「제주대학교 무료·유료 개방 체육시설 안내('26. 5. 13. 기준)」(표 이미지)와
「피트니스센터(헬스장) 개방 및 이용 안내('23. 3. 6.~)」입니다. 시간이 바뀌면 `GYM.sessions` 를 고쳐 주세요.

## 의견 보내기

[`public/app.js`](public/app.js) 맨 위 `FEEDBACK_URL` 에 구글 설문지 주소를 넣으면 화면 아래에 버튼이 생깁니다.

## 구조

```
scripts/parse.mjs        식단 표(#plannerWrap) → JSON
scripts/scrape.mjs       학교 페이지를 받아 public/data/menus.json 생성
scripts/manual.mjs       manual/*.txt (손으로 넣은 메뉴) → JSON
scripts/chefskiss.mjs    쉐프스키스 게시판 → JSON (api/dorm1.js 에서 사용)
api/dorm1.js             1호관 천원의 아침밥 함수 (서울 리전)
api/dorm1-meals.js       1호관 점심·저녁 함수 (서울 리전)
scripts/cafeterias.mjs   식당 목록·운영 정보
manual/dorm1.txt         1호관 주간 메뉴 (직접 입력)
public/                  정적 사이트 (Vercel 이 그대로 배포)
.github/workflows/       하루 세 번 + manual/ 수정 시 수집, 메뉴가 바뀌었으면 커밋
```

GitHub Actions 가 `menus.json` 을 커밋하면 Vercel 이 자동으로 다시 배포합니다.
한 식당 수집이 실패하면 그 식당은 직전 데이터를 유지하고 화면에 "갱신 실패"를 표시합니다.

## 로컬 실행

```sh
npm test          # 저장된 학교 페이지(test/fixtures)로 파서 확인
npm run scrape    # 실제 학교 페이지에서 수집 (Node 22 이상)
npm run dev       # http://localhost:3000
```

### 인증서 관련

`www.jejunu.ac.kr` 서버가 중간 인증서(Sectigo Public Server Authentication CA DV R36)를 보내지 않아
Node 기본 설정으로는 TLS 검증이 실패합니다. 검증을 끄지 않고, 해당 중간 인증서를
`certs/sectigo-dv-r36.pem` 에 두고 `NODE_EXTRA_CA_CERTS` 로 추가합니다.
(출처: 인증서에 적힌 AIA 주소 `http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt`, 2036-03-21 만료)

## 배포 (Vercel)

1. Vercel 에서 이 저장소를 Import → Framework Preset 은 **Other**, 나머지는 기본값
2. `vercel.json` 이 `public/` 을 그대로 배포하도록 설정되어 있습니다.
