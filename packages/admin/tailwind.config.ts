import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#f0fdf0', 100: '#dcfce7', 200: '#bbf7d0', 300: '#6ee77a', 400: '#4ade5c', 500: '#32CD32', 600: '#2AB82A', 700: '#22a022', 800: '#1a7f1a', 900: '#166316' },
        accent: { 50: '#fff8ed', 100: '#ffefcc', 200: '#FCC980', 300: '#ffb84d', 400: '#ff9f1a', 500: '#FF8C00', 600: '#e67a00' },
      },
    },
  },
  plugins: [],
};

export default config;
