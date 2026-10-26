/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include the shared UI package, or its classes get purged on mobile.
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), require('@cairn/ui/tailwind-preset')],
  plugins: [],
};
