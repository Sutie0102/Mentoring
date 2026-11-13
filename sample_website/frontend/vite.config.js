import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 로컬 개발(npm run dev) 시 /api 요청을 Docker로 띄운 Nginx로 전달
    proxy: { '/api': 'http://localhost' },
  },
});
