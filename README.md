# 제주대 천원의 아침밥 모아보기

제주대학교 홈페이지에 식당별로 나뉘어 있는 식단표를 한 화면에 모은 비공식 페이지입니다.
맨 위에 그날의 **천원의 아침밥**을 모아 보여 주고, 아래에 식당별 전체 식단을 보여 줍니다.

## 모으는 곳

| 식당 | 원본 | 천원의 아침밥 | 메뉴 수집 |
| --- | --- | --- | --- |
| 학생생활관 6호관 | [fixfirst.htm](https://www.jejunu.ac.kr/camp/stud/foodmenu/fixfirst.htm) | 월~토, 간편식·일반식 | 자동 |
| 학생생활관 1호관 | [chefskiss.co.kr/morning](https://chefskiss.co.kr/morning) | 일~금 | **주 1회 직접 입력** (아래 참고) |
| 백두관 | [firstfixmenu.htm](https://www.jejunu.ac.kr/camp/stud/foodmenu/firstfixmenu.htm) | 표기 없음 | 자동 |
| 사라캠퍼스 | [secondfixmenu.htm](https://www.jejunu.ac.kr/camp/stud/foodmenu/secondfixmenu.htm) | 없음 | 자동 |

운영시간·가격 같은 안내 문구는 [`scripts/cafeterias.mjs`](scripts/cafeterias.mjs)에 손으로 옮겨 두었습니다 (`CHECKED_AT` 날짜 기준).
학교 안내가 바뀌면 이 파일을 고쳐 주세요.

## 1호관 메뉴 넣기 (주 1회)

쉐프스키스 홈페이지는 해외 접속이 막혀 있어 GitHub Actions 로 자동 수집할 수 없습니다.

1. https://chefskiss.co.kr/morning 에서 한 주 메뉴를 복사
2. GitHub 에서 [`manual/dorm1.txt`](manual/dorm1.txt) → 연필(✏️) 버튼 → 붙여 넣기 → **Commit changes**
3. 저장하면 수집 작업이 바로 돌아 1~2분 뒤 사이트에 반영됩니다.

날짜 줄(`10/20 (월)`, `10월 20일` 등) 다음 줄들을 그날 메뉴로 읽습니다. 한 줄에 쉼표나 `/` 로 여러 개를 적어도 됩니다.

## 구조

```
scripts/parse.mjs        식단 표(#plannerWrap) → JSON
scripts/scrape.mjs       학교 페이지를 받아 public/data/menus.json 생성
scripts/manual.mjs       manual/*.txt (손으로 넣은 메뉴) → JSON
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
