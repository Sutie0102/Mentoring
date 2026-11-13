import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import { formatDate } from '../format';

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getPost(id), api.listComments(id)])
      .then(([p, c]) => {
        setPost(p);
        setComments(c);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    try {
      await api.deletePost(id);
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    try {
      const comment = await api.createComment(id, { content: newComment });
      setComments([...comments, comment]);
      setNewComment('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.deleteComment(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !post) return <p className="error">{error}</p>;
  if (!post) return <p className="muted">불러오는 중...</p>;

  const isAuthor = user?.id === post.author.id;

  return (
    <article>
      <h1>{post.title}</h1>
      <p className="muted">
        {post.author.nickname} · {formatDate(post.created_at)}
        {post.updated_at !== post.created_at && ' (수정됨)'}
      </p>
      {isAuthor && (
        <div className="actions">
          <Link to={`/posts/${id}/edit`} className="button secondary">수정</Link>
          <button type="button" className="button danger" onClick={handleDelete}>삭제</button>
        </div>
      )}
      <div className="content">{post.content}</div>

      <section className="comments">
        <h2>댓글 {comments.length}</h2>
        {error && <p className="error">{error}</p>}
        <ul>
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <div>
                <strong>{c.author.nickname}</strong>{' '}
                <span className="muted">{formatDate(c.created_at)}</span>
                <p>{c.content}</p>
              </div>
              {user?.id === c.author.id && (
                <button type="button" className="link-button" onClick={() => handleDeleteComment(c.id)}>삭제</button>
              )}
            </li>
          ))}
        </ul>
        {user ? (
          <form onSubmit={handleAddComment} className="comment-form">
            <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요" rows={3} required />
            <button type="submit" className="button">등록</button>
          </form>
        ) : (
          <p className="muted"><Link to="/login">로그인</Link>하면 댓글을 쓸 수 있습니다.</p>
        )}
      </section>
    </article>
  );
}
