import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const PACKAGE_ROOT = '..';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, PACKAGE_ROOT, '');
  const frontendPort = Number(env.VITE_FRONTEND_PORT) || 4500;

  return {
    clearScreen: false,
    envDir: PACKAGE_ROOT,
    plugins: [react()],
    build: {
      target: 'esnext',
      minify: 'esbuild',
    },
    server: {
      host: 'localhost',
      port: frontendPort,
      middlewareMode: false,
    },
  };
});
