from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Comment, User
from ..schemas import CommentIn, CommentOut
from ..security import get_current_user
from .posts import get_post_or_404

router = APIRouter(prefix="/api", tags=["comments"])


@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: int, db: Session = Depends(get_db)):
    get_post_or_404(db, post_id)
    return db.scalars(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.id)
    ).all()


@router.post(
    "/posts/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
def create_comment(
    post_id: int, data: CommentIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    post = get_post_or_404(db, post_id)
    comment = Comment(post=post, author=user, content=data.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
    if comment.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "작성자만 삭제할 수 있습니다.")
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
