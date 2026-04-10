/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- 新增这一行
  theme: {
    extend: {
      fontFamily: {
        // 优先级：San Francisco (Apple) -> Segoe UI (Win) -> 通用
        sans: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Segoe UI",
          "Roboto", "Helvetica", "Arial", "sans-serif"
        ],
        mono: ["SF Mono", "Menlo", "Monaco", "Courier New", "monospace"],
      },
    },
  },
  // Safelist: component classes only used in CSS, not in JSX/TSX
  // Without this, Tailwind JIT purges them as "unused"
  safelist: [
    { pattern: /jm-editor-(body|textarea)/ },
    { pattern: /jm-editor-(body|textarea)--/ },
    { pattern: /dark.*jm-editor/ },
  ],
  plugins: [
    require('@tailwindcss/typography'), // 启用排版美化
  ],
}
