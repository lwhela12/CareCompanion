/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F0F2FC',
          100: '#E8EBFA',
          200: '#D3D9F4',
          300: '#B0BAEC',
          400: '#8B9AE3',
          500: '#6B7FD7',
          600: '#4C5FC6',
          700: '#3A4BB5',
          800: '#2E3D99',
          900: '#1F2A6B',
        },
        success: '#52B788',
        'success-light': '#E8F5F0',
        'success-dark': '#2D7A57',
        warning: '#F4A261',
        'warning-light': '#FEF3E7',
        'warning-dark': '#C17D3A',
        error: '#E76F51',
        'error-light': '#FDEBE7',
        'error-dark': '#B94A2F',
        info: '#4ECDC4',
        'info-light': '#E7F9F8',
        'info-dark': '#2B8B84',
        gray: {
          50: '#FAFBFD',
          100: '#F5F7FA',
          200: '#E2E8F0',
          300: '#CBD5E0',
          400: '#A0AEC0',
          500: '#718096',
          600: '#4A5568',
          700: '#2D3748',
          800: '#1A202C',
          900: '#0F1419',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '16px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.05)',
        'md': '0 2px 8px rgba(0, 0, 0, 0.05)',
        'lg': '0 4px 16px rgba(0, 0, 0, 0.08)',
        'xl': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      keyframes: {
        'shrink-to-corner': {
          '0%': {
            transform: 'scale(1) translate(0, 0)',
            opacity: '1',
            borderRadius: '0',
          },
          '100%': {
            transform: 'scale(0.1) translate(40vw, 40vh)',
            opacity: '0',
            borderRadius: '9999px',
          },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'shrink-to-corner': 'shrink-to-corner 0.7s ease-in-out forwards',
        'fade-in': 'fade-in 0.3s ease-in-out forwards',
      },
    },
  },
  plugins: [],
};