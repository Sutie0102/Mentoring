import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.signup(form);
      await login(form.email, form.password); // 가입 후 바로 로그인
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form narrow">
      <h1>회원가입</h1>
      {error && <p className="error">{error}</p>}
      <input type="email" value={form.email} onChange={update('email')} placeholder="이메일" required />
      <input type="password" value={form.password} onChange={update('password')}
        placeholder="비밀번호 (8자 이상)" minLength={8} maxLength={72} required />
      <input value={form.nickname} onChange={update('nickname')} placeholder="닉네임" maxLength={50} required />
      <button type="submit" className="button">가입하기</button>
      <p className="muted">이미 계정이 있나요? <Link to="/login">로그인</Link></p>
    </form>
  );
}
