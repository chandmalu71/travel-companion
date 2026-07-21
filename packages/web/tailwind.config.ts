import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors from Neyya Brand Asset Pack
        primary: {
          50: '#f0fdf0',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#6ee77a',
          400: '#4ade5c',
          500: '#32CD32', // Main brand green
          600: '#2AB82A',
          700: '#22a022',
          800: '#1a7f1a',
          900: '#166316',
        },
        accent: {
          50: '#fff8ed',
          100: '#ffefcc',
          200: '#FCC980', // Light gold/peach
          300: '#ffb84d',
          400: '#ff9f1a',
          500: '#FF8C00', // Orange accent
          600: '#e67a00',
          700: '#cc6a00',
          800: '#a35500',
          900: '#804300',
        },
        warm: {
          50: '#fdf5f4',
          100: '#fbe8e6',
          200: '#f5cfcb',
          300: '#d9918a',
          400: '#c47a72',
          500: '#A96059', // Terracotta/warm brown
          600: '#8f504a',
          700: '#76423d',
          800: '#5c3430',
          900: '#432624',
        },
        forest: {
          50: '#f4f9f2',
          100: '#e4f0df',
          200: '#c8e1bf',
          300: '#9ecc8f',
          400: '#7ab868',
          500: '#609550', // Dark green
          600: '#4d7a40',
          700: '#3d6133',
          800: '#324e2a',
          900: '#283f22',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
