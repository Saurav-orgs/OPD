import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev convenience: forward API calls to the NestJS backend.
      '/api': 'https://76ml0vk8-3000.inc1.devtunnels.ms',
    },
  },
});
