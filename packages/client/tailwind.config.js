/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'fs-dark': '#111114',
        'fs-darker': '#0a0a0c',
        'fs-brown': '#1e1a24',
        'fs-gold': '#c9a227',
        'fs-gold-light': '#e8b84b',
        'fs-red': '#b01c1c',
        'fs-green': '#2d5a27',
        'fs-blue': '#1a3a5c',
        'fs-parchment': '#e8e0d0',
        'fs-soul': '#6644cc',
        'fs-stone': '#2a2830',
        'fs-bone': '#cfc9b8',
      },
      fontFamily: {
        display: ['"Permanent Marker"', 'cursive'],
        body: ['"Roboto"', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-gold': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wiggle': 'wiggle 0.3s ease-in-out',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
};
