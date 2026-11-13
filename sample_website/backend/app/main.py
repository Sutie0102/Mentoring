from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .routers import auth, comments, posts

# 모든 경로를 /api 아래에 둬서 Nginx가 /api/* 요청만 이 서버로 넘기게 한다.
app = FastAPI(
    title="Blog API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(comments.router)


@app.get("/api/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
