import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f6f7f0',
          100: '#e8ebd6',
          400: '#9aa860',
          600: '#6b7a3a',
          700: '#54602f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
