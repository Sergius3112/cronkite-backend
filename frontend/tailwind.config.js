/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper:  '#f5f0e8',
        'paper-dark': '#ede8dc',
        'paper-darker': '#dbd2be',
        ink:    '#0a0a0a',
        'ink-mid': '#4a3f2f',
        'ink-light': '#7d6e56',
        red:    '#c8102e',
        'red-dark': '#a50d26',
        border: '#c5b89a',
        green:  '#2d6a4f',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
