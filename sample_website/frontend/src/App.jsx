import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Login from './pages/Login';
import PostDetail from './pages/PostDetail';
import PostEditor from './pages/PostEditor';
import PostList from './pages/PostList';
import Signup from './pages/Signup';

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<PostList />} />
          <Route path="/posts/new" element={<PostEditor />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/posts/:id/edit" element={<PostEditor />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
        </Routes>
      </main>
    </>
  );
}
