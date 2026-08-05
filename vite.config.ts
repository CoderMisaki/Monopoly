import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Memisah Phaser & vendor besar ke chunk tersendiri
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('phaser')) {
              return 'phaser';
            }
            if (
              id.includes('howler') ||
              id.includes('gsap') ||
              id.includes('zustand') ||
              id.includes('socket.io-client')
            ) {
              return 'vendor';
            }
          }
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
