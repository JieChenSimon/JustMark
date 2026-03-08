import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // 性能优化配置
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          'markdown-core': ['react-markdown', 'remark-gfm'],
          'vendor': ['react', 'react-dom']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: false
  },

  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-markdown'],
    exclude: ['html2canvas', 'jspdf', 'docx', 'remark-math', 'rehype-katex', 'katex']
  }
}));
