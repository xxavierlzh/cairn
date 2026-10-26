// Shared design tokens. Both apps load this after `nativewind/preset` in tailwind.config.js.
/** @type {Partial<import('tailwindcss').Config>} */
module.exports = {
  theme: {
    extend: {
      colors: {
        moss: {
          50: '#f3f7f2',
          100: '#e3ece0',
          500: '#5b7f53',
          700: '#3e5a39',
          900: '#243522',
        },
      },
    },
  },
};
