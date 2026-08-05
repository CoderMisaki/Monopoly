import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Memisah Phaser & vendor besar ke chunk tersendiri
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['howler', 'gsap', 'zustand', 'socket.io-client']
        }
      }
    },
    // Membersihkan console.log & debugger otomatis di build production
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    chunkSizeWarningLimit: 1200
  },
  server: {
    port: 3000,
    open: true
  }
});
