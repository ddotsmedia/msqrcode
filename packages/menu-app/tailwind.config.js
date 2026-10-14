/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
        copper: {
          300: '#d9b88f',
          500: '#a87a50',
          700: '#8a5f38',
        },
        cream: '#faf6f0',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
