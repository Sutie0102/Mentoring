// Application Tier(REST API) 호출 함수 모음
// 모든 요청은 같은 도메인의 /api 로 보내고, Nginx가 backend로 전달한다.

const TOKEN_KEY = 'token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    // FastAPI 입력 검증 오류는 배열로 온다
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(', ')
      : detail || `요청에 실패했습니다. (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  signup: (data) => request('/auth/signup', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  me: () => request('/auth/me'),

  listPosts: (page = 1) => request(`/posts?page=${page}`),
  getPost: (id) => request(`/posts/${id}`),
  createPost: (data) => request('/posts', { method: 'POST', body: data }),
  updatePost: (id, data) => request(`/posts/${id}`, { method: 'PUT', body: data }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),

  listComments: (postId) => request(`/posts/${postId}/comments`),
  createComment: (postId, data) => request(`/posts/${postId}/comments`, { method: 'POST', body: data }),
  deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
};
