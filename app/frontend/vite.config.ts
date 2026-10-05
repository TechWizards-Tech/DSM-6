import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * O frontend fala com o backend por /api. O proxy evita CORS no desenvolvimento
 * e mantem a mesma URL relativa quando tudo sobe junto no Docker.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
});
