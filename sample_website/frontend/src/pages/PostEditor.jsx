import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';

// /posts/new 이면 새 글 작성, /posts/:id/edit 이면 수정
export default function PostEditor() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .getPost(id)
      .then((post) => {
        setTitle(post.title);
        setContent(post.content);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { title, content };
      const post = id ? await api.updatePost(id, data) : await api.createPost(data);
      navigate(`/posts/${post.id}`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p className="muted">불러오는 중...</p>;
  if (!user) return <p><Link to="/login">로그인</Link> 후 글을 쓸 수 있습니다.</p>;

  return (
    <form onSubmit={handleSubmit} className="form">
      <h1>{id ? '글 수정' : '새 글 쓰기'}</h1>
      {error && <p className="error">{error}</p>}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" maxLength={200} required />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" rows={15} required />
      <div className="actions">
        <button type="submit" className="button">{id ? '수정하기' : '등록하기'}</button>
        <button type="button" className="button secondary" onClick={() => navigate(-1)}>취소</button>
      </div>
    </form>
  );
}
