/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // This is crucial for the .dark class to work
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'theme-bg': 'var(--theme-bg)',
        'theme-text': 'var(--theme-text)',
        'theme-text-soft': 'var(--theme-text-soft)',
        'theme-accent': 'var(--theme-accent)',
        'theme-primary': 'var(--theme-primary)',
        'theme-secondary': 'var(--theme-secondary)',
        'theme-card-bg': 'var(--theme-card-bg)',
        'theme-card-border': 'var(--theme-card-border)',
        'dark-900': '#0a0a0f',
        'cyan-400': '#00f0ff',
        'purple-400': '#b44aff',
        'neon-green': '#39ff14',
        'neon-pink': '#ff006e',
        'neon-orange': '#ff6b35',
      },
    },
  },
  plugins: [],
}