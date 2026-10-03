/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf8f0',
          100: '#f9eddb',
          200: '#f2d7b0',
          300: '#e9bc7d',
          400: '#df9a48',
          500: '#d4802a',
          600: '#c66a20',
          700: '#a4521d',
          800: '#84421f',
          900: '#6c381d',
        },
      },
    },
  },
  plugins: [],
};
