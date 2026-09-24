/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgPrimary: '#07090E',
        bgSurface: '#0D1117',
        bgCard: '#12161F',
        borderSubtle: 'rgba(255, 255, 255, 0.08)',
        borderActive: 'rgba(255, 255, 255, 0.18)',
        accentGreen: '#00FF66',
        accentAmber: '#FFB800',
        accentRed: '#FF3B30',
        accentCyan: '#58A6FF',
        textMain: '#E6EDF3',
        textMuted: '#8B949E',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
