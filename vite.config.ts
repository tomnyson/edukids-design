import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { claudeBridgePlugin } from './server/claude-bridge-plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), claudeBridgePlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
