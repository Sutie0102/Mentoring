"""API 요청/응답 형식 정의 (Pydantic)"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- 인증 ---

class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    nickname: str = Field(min_length=1, max_length=50)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: int
    email: str
    nickname: str


class AuthorOut(ORMModel):
    id: int
    nickname: str


# --- 글 ---

class PostIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)


class PostOut(ORMModel):
    id: int
    title: str
    content: str
    author: AuthorOut
    created_at: datetime
    updated_at: datetime


class PostPage(BaseModel):
    items: list[PostOut]
    total: int
    page: int
    size: int


# --- 댓글 ---

class CommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class CommentOut(ORMModel):
    id: int
    post_id: int
    content: str
    author: AuthorOut
    created_at: datetime
