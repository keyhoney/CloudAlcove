# CloudAlcove

로그인 없이 링크만으로 함께하는 **온라인 독서실** 웹앱입니다.  
영상은 WebRTC P2P Mesh로 전송하고, 시그널링만 Cloudflare Worker(무료)를 사용합니다.

## 기술 스택

- Vite + React + TypeScript
- Tailwind CSS v4
- simple-peer (WebRTC)
- Cloudflare Worker + Durable Objects (시그널링)

## 로컬 실행

```bash
# 의존성 설치
npm install

# 프론트 + 시그널링 Worker 동시 실행
npm run dev:all
```

- 프론트: http://localhost:5173
- Worker: http://localhost:8787 (Vite가 `/ws`를 프록시)

브라우저에서 **방 만들기** → 링크 복사 → 다른 탭/기기에서 접속해 테스트하세요.

> `localhost`는 HTTPS 없이도 카메라 사용이 가능합니다.

## Worker 배포 (프로덕션)

```bash
npm run deploy:worker
```

배포 후 Worker URL을 `.env`에 설정:

```env
VITE_SIGNALING_URL=wss://cloudalcove.<your-subdomain>.workers.dev
```

## Pages 배포 (프론트엔드)

```bash
npm run deploy:pages
```

또는 Worker + Pages 한 번에:

```bash
npm run deploy
```

> 최초 Pages 배포 시 Cloudflare 계정 로그인이 필요합니다.  
> SPA 라우팅은 `public/_redirects`로 처리됩니다.

프론트 배포 후 `.env`의 `VITE_SIGNALING_URL`을 Worker URL로 설정하고 **다시 빌드·배포**해야 합니다.

## 프로젝트 구조

```
src/           React 앱
worker/        Cloudflare 시그널링 Worker
작업 명세서.md  상세 명세 (v2)
```

## 2차 기능

- **방 비밀번호** — 방 만들 때 선택 설정 (4~16자), 입장 시 검증
- **채팅** — 방 내 실시간 텍스트 채팅 (최근 50개 Worker 보관)
- **타이머 동기화** — 방장 뽀모도로를 전원이 함께 진행
- **TURN 서버** — `.env`에 Metered.ca 등 설정 시 NAT/방화벽 환경 연결 개선

```env
VITE_TURN_URL=turn:global.relay.metered.ca:443
VITE_TURN_USERNAME=...
VITE_TURN_CREDENTIAL=...
```

## 제한 사항

- 방당 최대 4명 (Mesh P2P)
- 마이크 기본 OFF
- 모바일 화면 공유 미지원
- TURN 미설정 시 일부 네트워크에서 P2P 실패 가능
