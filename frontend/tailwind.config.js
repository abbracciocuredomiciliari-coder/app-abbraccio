/** @type {import('tailwindcss').Config} */
export default {
  // Nessun reset globale: Tailwind convive con styles.css esistente.
  corePlugins: {
    preflight: false,
  },
  // Prefisso "tw-" per evitare qualunque collisione con classi CSS esistenti.
  prefix: 'tw-',
  content: [
    './index.html',
    './src/pages/*.tsx',
    './src/components/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1e4d8c',
          dark: '#1a3a6b',
          light: '#2563eb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
