/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./404.html",
    "./src/**/*.{html,js}",
    "./public/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        'newket-primary': 'var(--primary-color)',
        'newket-primary-hover': 'var(--primary-hover)',
        'newket-secondary': 'var(--secondary-color)',
        'newket-dark': 'var(--text-dark)',
        'newket-light': 'var(--text-light)',
        'newket-bg': 'var(--bg-light)',
        'newket-card': 'var(--bg-white)',
        'newket-border': 'var(--border-color)',
        'newket-success': 'var(--success-color)',
        'newket-danger': 'var(--danger-color)',
        'newket-warning': 'var(--warning-color)',
        'newket-info': 'var(--info-color)',
        'newket-green': 'var(--newket-green)'
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}

