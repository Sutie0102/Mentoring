"""API 테스트: docker compose run --rm backend pytest

실제 PostgreSQL 대신 메모리 SQLite를 사용해서 DB 없이도 빠르게 돈다.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def signup_and_login(client, email="a@example.com", nickname="에이"):
    res = client.post("/api/auth/signup", json={"email": email, "password": "password1", "nickname": nickname})
    assert res.status_code == 201
    res = client.post("/api/auth/login", json={"email": email, "password": "password1"})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_signup_duplicate_and_wrong_password(client):
    signup_and_login(client)
    dup = client.post("/api/auth/signup", json={"email": "a@example.com", "password": "password1", "nickname": "x"})
    assert dup.status_code == 409
    bad = client.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong-pass"})
    assert bad.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401
    headers = signup_and_login(client)
    assert client.get("/api/auth/me", headers=headers).json()["nickname"] == "에이"


def test_post_crud_and_permissions(client):
    alice = signup_and_login(client)
    bob = signup_and_login(client, email="b@example.com", nickname="비")

    assert client.post("/api/posts", json={"title": "t", "content": "c"}).status_code == 401

    res = client.post("/api/posts", json={"title": "첫 글", "content": "내용"}, headers=alice)
    assert res.status_code == 201
    post_id = res.json()["id"]

    page = client.get("/api/posts").json()
    assert page["total"] == 1
    assert page["items"][0]["author"]["nickname"] == "에이"

    # 다른 사람은 수정/삭제 불가
    assert client.put(f"/api/posts/{post_id}", json={"title": "x", "content": "y"}, headers=bob).status_code == 403
    assert client.delete(f"/api/posts/{post_id}", headers=bob).status_code == 403

    res = client.put(f"/api/posts/{post_id}", json={"title": "수정됨", "content": "내용2"}, headers=alice)
    assert res.json()["title"] == "수정됨"

    assert client.delete(f"/api/posts/{post_id}", headers=alice).status_code == 204
    assert client.get(f"/api/posts/{post_id}").status_code == 404


def test_comments(client):
    alice = signup_and_login(client)
    bob = signup_and_login(client, email="b@example.com", nickname="비")
    post_id = client.post("/api/posts", json={"title": "t", "content": "c"}, headers=alice).json()["id"]

    res = client.post(f"/api/posts/{post_id}/comments", json={"content": "좋아요"}, headers=bob)
    assert res.status_code == 201
    comment_id = res.json()["id"]

    comments = client.get(f"/api/posts/{post_id}/comments").json()
    assert [c["author"]["nickname"] for c in comments] == ["비"]

    assert client.delete(f"/api/comments/{comment_id}", headers=alice).status_code == 403
    assert client.delete(f"/api/comments/{comment_id}", headers=bob).status_code == 204
    assert client.get(f"/api/posts/{post_id}/comments").json() == []
