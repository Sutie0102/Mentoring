import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">My Blog</Link>
        <nav className="nav">
          {user ? (
            <>
              <span className="muted">{user.nickname}님</span>
              <Link to="/posts/new" className="button">글쓰기</Link>
              <button type="button" className="button secondary" onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <>
              <Link to="/login" className="button secondary">로그인</Link>
              <Link to="/signup" className="button">회원가입</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
