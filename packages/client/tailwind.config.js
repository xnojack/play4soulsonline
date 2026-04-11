/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'fs-dark': '#1a1208',
        'fs-darker': '#0f0b05',
        'fs-brown': '#3d2b1f',
        'fs-gold': '#c8a84b',
        'fs-gold-light': '#e8c96b',
        'fs-red': '#8b1a1a',
        'fs-green': '#2d5a27',
        'fs-blue': '#1a3a5c',
        'fs-parchment': '#f4e8d0',
        'fs-soul': '#9333ea',
      },
      fontFamily: {
        display: ['"Cinzel"', 'serif'],
        body: ['"IM Fell English"', 'serif'],
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
