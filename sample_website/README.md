# 3-Tier 블로그

Docker Compose로 실행하는 3계층(3-Tier) 구조의 블로그입니다.

```
브라우저 ──:80──▶ ① frontend (Nginx + React) ──▶ ② backend (FastAPI) ──▶ ③ db (PostgreSQL)
                    Presentation Tier              Application Tier        Data Tier
```

- 외부에 열린 포트는 `80` 하나뿐이고, frontend는 db에 직접 접근할 수 없습니다 (네트워크 분리).
- 기능: 회원가입/로그인(JWT), 글 목록·상세·작성·수정·삭제, 댓글

자세한 설계는 [PLAN.md](PLAN.md)를 참고하세요.

## 실행 방법

필요한 것: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
cp .env.example .env              # 비밀번호/시크릿 값을 바꿔 주세요
docker compose up -d --build      # 빌드 후 백그라운드 실행
docker compose exec backend python -m app.seed   # (선택) 샘플 데이터
```

- 블로그: http://localhost
- API 문서(Swagger): http://localhost/api/docs
- 샘플 계정: `demo@example.com` / `demo1234`

## 자주 쓰는 명령

| 하고 싶은 것 | 명령 |
|---|---|
| 상태 확인 | `docker compose ps` |
| 로그 보기 | `docker compose logs -f backend` |
| 코드 수정 후 다시 반영 | `docker compose up -d --build` |
| 중지 | `docker compose down` |
| 중지 + DB 데이터 삭제 | `docker compose down -v` |
| 백엔드 테스트 | `docker compose exec backend pytest` |
| DB 접속 | `docker compose exec db psql -U blog -d blog` |

## 폴더 구조

```
.
├── docker-compose.yml   # 3개 컨테이너와 네트워크 정의
├── frontend/            # ① React 앱 + nginx.conf (리버스 프록시)
└── backend/             # ② FastAPI 앱 + Alembic 마이그레이션 + 테스트
```

## 각 계층 확인하기

```bash
docker compose exec db psql -U blog -d blog -c '\dt'   # ③ 테이블 확인
curl http://localhost/api/health                         # ② API 확인 → {"status":"ok"}
docker compose exec frontend ping -c1 db                 # 실패해야 정상 (네트워크 격리)
```
