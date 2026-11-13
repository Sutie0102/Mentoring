# 3-Tier 블로그 웹사이트 구축 계획 (Docker)

## 1. 목표

- 글 목록/상세 조회, 글 작성·수정·삭제, 회원가입·로그인, 댓글이 되는 블로그
- **Presentation / Application / Data** 3계층을 각각 독립된 Docker 컨테이너로 분리
- `docker compose up` 한 번으로 전체 시스템 실행

## 2. 아키텍처

```
          브라우저
             │  HTTP :80
             ▼
┌─────────────────────────────┐
│ ① Presentation Tier         │   [frontend 컨테이너]
│   Nginx + React(Vite) 빌드물 │   - 정적 파일 제공
│                             │   - /api/* → backend로 리버스 프록시
└──────────────┬──────────────┘
               │  http://backend:8000   (내부 네트워크: front-net)
               ▼
┌─────────────────────────────┐
│ ② Application Tier          │   [backend 컨테이너]
│   FastAPI (Python)          │   - REST API, 인증(JWT), 비즈니스 로직
└──────────────┬──────────────┘
               │  postgresql://db:5432  (내부 네트워크: back-net)
               ▼
┌─────────────────────────────┐
│ ③ Data Tier                 │   [db 컨테이너]
│   PostgreSQL 16             │   - 데이터 영구 저장 (named volume)
└─────────────────────────────┘
```

**계층 분리 원칙**
- 외부에 열리는 포트는 frontend의 `80` 하나뿐
- 네트워크를 두 개로 나눠 frontend는 db에 **직접 접근할 수 없게** 함
  - `front-net`: frontend ↔ backend
  - `back-net`: backend ↔ db
- 계층 사이 통신은 바로 아래 계층하고만 함 (Presentation → Application → Data)

## 3. 기술 스택

| 계층 | 기술 | 선택 이유 |
|---|---|---|
| Presentation | React + Vite, Nginx | 많이 쓰이고 자료가 많음. Nginx가 정적 파일 제공과 프록시를 함께 처리 |
| Application | FastAPI, SQLAlchemy, Alembic, Pydantic | 코드가 짧고, Swagger 문서(`/docs`)가 자동 생성되어 API 테스트가 쉬움 |
| Data | PostgreSQL 16 | 표준 관계형 DB, 공식 Docker 이미지 |
| 인프라 | Docker, Docker Compose | 요구사항 |

> 다른 스택(예: Spring Boot, Node/Express, MySQL)으로 바꿔도 구조는 같고, 각 컨테이너 내부만 달라집니다.

## 4. 폴더 구조

```
.
├── docker-compose.yml
├── .env.example            # 환경변수 예시 (실제 .env는 git에 올리지 않음)
├── frontend/
│   ├── Dockerfile          # multi-stage: node로 빌드 → nginx로 서빙
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── pages/          # 글목록, 글상세, 글쓰기, 로그인, 회원가입
│       ├── components/
│       └── api/            # fetch 래퍼
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── alembic/            # DB 마이그레이션
    ├── tests/              # pytest
    └── app/
        ├── main.py
        ├── config.py       # 환경변수 로딩
        ├── database.py
        ├── models.py       # SQLAlchemy 모델
        ├── schemas.py      # Pydantic 요청/응답 스키마
        ├── security.py     # 비밀번호 해싱, JWT
        ├── seed.py         # 샘플 데이터
        └── routers/        # auth, posts, comments
```

> 규모가 작아서 models/schemas는 파일 하나로 두었습니다. 기능이 늘어나면 폴더로 나누세요.

## 5. 데이터 모델

```
users                 posts                    comments
─────────             ─────────                ─────────
id (PK)               id (PK)                  id (PK)
email (unique)        author_id (FK→users)     post_id (FK→posts)
password_hash         title                    author_id (FK→users)
nickname              content                  content
created_at            created_at               created_at
                      updated_at
```

## 6. API 설계

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/api/auth/signup` | 회원가입 | – |
| POST | `/api/auth/login` | 로그인 → JWT 발급 | – |
| GET | `/api/auth/me` | 내 정보 | ✓ |
| GET | `/api/posts?page=1` | 글 목록 (페이지네이션) | – |
| GET | `/api/posts/{id}` | 글 상세 | – |
| POST | `/api/posts` | 글 작성 | ✓ |
| PUT | `/api/posts/{id}` | 글 수정 (작성자만) | ✓ |
| DELETE | `/api/posts/{id}` | 글 삭제 (작성자만) | ✓ |
| GET | `/api/posts/{id}/comments` | 댓글 목록 | – |
| POST | `/api/posts/{id}/comments` | 댓글 작성 | ✓ |
| DELETE | `/api/comments/{id}` | 댓글 삭제 (작성자만) | ✓ |
| GET | `/api/health` | 헬스체크 | – |

## 7. Docker 구성 초안

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks: [front-net]

  backend:
    build: ./backend
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    networks: [front-net, back-net]

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      retries: 10
    networks: [back-net]

volumes:
  db-data:

networks:
  front-net:
  back-net:
```

핵심 포인트
- **frontend Dockerfile**: multi-stage 빌드로 `node` 이미지에서 `npm run build` → `nginx:alpine`에 결과물만 복사 (이미지 용량 축소)
- **nginx.conf**: `location /api/ { proxy_pass http://backend:8000; }`, 그 외는 `try_files $uri /index.html` (SPA 라우팅)
- **backend**: 컨테이너 시작 시 `alembic upgrade head` 후 `uvicorn` 실행
- **db**: named volume으로 컨테이너를 지워도 데이터 유지, healthcheck로 backend가 DB 준비 후 시작
- 비밀번호·JWT 시크릿은 `.env`로 관리하고 `.gitignore`에 추가

## 8. 단계별 진행 계획

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. 환경 준비** | Docker Desktop 설치, 폴더 구조·`.gitignore`·`.env.example` 생성 | `docker --version`, `docker compose version` 동작 |
| **1. Data Tier** | compose에 PostgreSQL만 띄우기, volume·healthcheck 설정 | `docker compose up db` 후 `psql` 접속 성공 |
| **2. Application Tier** | FastAPI 뼈대 + `/api/health`, DB 연결, 모델·Alembic 마이그레이션 | `/docs`에서 health 응답, 테이블 생성 확인 |
| **3. API 구현** | 회원가입/로그인(JWT, bcrypt) → 글 CRUD → 댓글 | Swagger에서 전체 API 수동 테스트 통과 |
| **4. Presentation Tier** | React 페이지 구현, API 연동, 로그인 상태 관리 | 브라우저에서 글쓰기~댓글까지 동작 |
| **5. 통합** | Nginx 리버스 프록시, 네트워크 분리, 전체 compose 실행 | `docker compose up --build` 한 번에 전체 동작, `localhost`로 접속 |
| **6. 마무리** | README(실행 방법·아키텍처 그림), 샘플 데이터, 간단한 테스트(pytest) | 처음 보는 사람이 README만 보고 실행 가능 |
| **7. 확장 (선택)** | 이미지 업로드, 검색, 태그, GitHub Actions CI, 클라우드 배포(AWS EC2 등) | – |

## 9. 확인 방법 (각 계층 독립 테스트)

- **Data**: `docker compose exec db psql -U <user> -d <db> -c '\dt'`
- **Application**: `http://localhost/api/docs` (Swagger) 또는 `curl http://localhost/api/health`
- **Presentation**: 브라우저에서 `http://localhost`
- **분리 확인**: `docker compose exec frontend ping db` 실패해야 정상 (네트워크 격리)

## 10. 현재 환경 메모

- Docker / Node.js 미설치 → 0단계에서 Docker Desktop 설치 필요 (`brew install --cask docker`)
- Node.js는 frontend를 Docker 안에서 빌드하므로 필수는 아니지만, 로컬 개발 편의상 설치 권장
- Python 3.14 설치되어 있음 (backend는 컨테이너에서 `python:3.12-slim` 사용 권장)
