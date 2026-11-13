import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form narrow">
      <h1>로그인</h1>
      {error && <p className="error">{error}</p>}
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" required />
      <button type="submit" className="button">로그인</button>
      <p className="muted">계정이 없나요? <Link to="/signup">회원가입</Link></p>
    </form>
  );
}
