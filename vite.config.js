import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true, // or '0.0.0.0'
    port: 3000, // optional: fix port number
  },
});
