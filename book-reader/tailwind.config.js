/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      height: {
        'screen': '100vh',
        'full': '100%',
      },
      width: {
        'screen': '100vw',
        'full': '100%',
      },
      colors: {
        book: {
          paper: '#f5f1e6',
          dark: '#2c1810',
          accent: '#8b4513',
          text: '#3d2817',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        burmese: ['Padauk', 'Noto Sans Myanmar', 'Myanmar Text', 'Myanmar3', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
