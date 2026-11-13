"""샘플 데이터 넣기: docker compose exec backend python -m app.seed"""

from sqlalchemy import select

from .database import SessionLocal
from .models import Comment, Post, User
from .security import hash_password

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"


def main():
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
            print("샘플 데이터가 이미 있습니다.")
            return

        user = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD), nickname="데모")
        welcome = Post(
            author=user,
            title="블로그에 오신 것을 환영합니다",
            content="3-Tier 아키텍처로 만든 블로그입니다.\n\n"
            "Presentation(Nginx + React) → Application(FastAPI) → Data(PostgreSQL)",
        )
        db.add_all([
            welcome,
            Post(author=user, title="Docker Compose로 실행하기", content="docker compose up --build 한 줄이면 됩니다."),
            Comment(post=welcome, author=user, content="첫 댓글입니다!"),
        ])
        db.commit()
        print(f"샘플 데이터 추가 완료 (로그인: {DEMO_EMAIL} / {DEMO_PASSWORD})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
