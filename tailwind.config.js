/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef9f0',
          100: '#fdefd6',
          200: '#fad8a3',
          300: '#f6bb65',
          400: '#f19535',
          500: '#ec7613',
          600: '#d45d09',
          700: '#b0450b',
          800: '#8e3710',
          900: '#742f11',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
