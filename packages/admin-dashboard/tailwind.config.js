/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'fade-slide-up': 'fadeSlideUp 0.35s ease both',
        'fade-in': 'fadeIn 0.25s ease both',
        'slide-in-top': 'slideInTop 0.3s ease both',
        'count-up': 'fadeIn 0.6s ease both',
      },
      keyframes: {
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInTop: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        brand: {
          50: '#eef2f8',
          100: '#d9e1ee',
          200: '#b3c2dc',
          300: '#8199c0',
          400: '#4f6e9f',
          500: '#2d4c7e',
          600: '#1d3a66',
          700: '#13284b',
          800: '#0f2140',
          900: '#0b1a33',
        },
      },
    },
  },
  plugins: [],
};
