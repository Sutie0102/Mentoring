from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Post, User
from ..schemas import PostIn, PostOut, PostPage
from ..security import get_current_user

router = APIRouter(prefix="/api/posts", tags=["posts"])


def get_post_or_404(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    return post


def check_author(post: Post, user: User) -> None:
    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "작성자만 수정/삭제할 수 있습니다.")


@router.get("", response_model=PostPage)
def list_posts(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    total = db.scalar(select(func.count()).select_from(Post))
    posts = db.scalars(
        select(Post)
        .options(joinedload(Post.author))
        .order_by(Post.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return PostPage(items=[PostOut.model_validate(p) for p in posts], total=total, page=page, size=size)


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db)):
    return get_post_or_404(db, post_id)


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(data: PostIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = Post(author=user, title=data.title, content=data.content)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.put("/{post_id}", response_model=PostOut)
def update_post(
    post_id: int, data: PostIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    post = get_post_or_404(db, post_id)
    check_author(post, user)
    post.title = data.title
    post.content = data.content
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = get_post_or_404(db, post_id)
    check_author(post, user)
    db.delete(post)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
