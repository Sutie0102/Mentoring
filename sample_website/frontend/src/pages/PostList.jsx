import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate } from '../format';

export default function PostList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listPosts(page).then(setData).catch((e) => setError(e.message));
  }, [page]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">불러오는 중...</p>;

  const lastPage = Math.max(1, Math.ceil(data.total / data.size));

  return (
    <section>
      <h1>전체 글 <span className="muted">({data.total})</span></h1>
      {data.items.length === 0 ? (
        <p className="muted">아직 작성된 글이 없습니다.</p>
      ) : (
        <ul className="post-list">
          {data.items.map((post) => (
            <li key={post.id} className="card">
              <Link to={`/posts/${post.id}`} className="post-title">{post.title}</Link>
              <p className="muted">{post.author.nickname} · {formatDate(post.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="pagination">
        <button type="button" className="button secondary" disabled={page <= 1}
          onClick={() => setSearchParams({ page: page - 1 })}>이전</button>
        <span>{page} / {lastPage}</span>
        <button type="button" className="button secondary" disabled={page >= lastPage}
          onClick={() => setSearchParams({ page: page + 1 })}>다음</button>
      </div>
    </section>
  );
}
