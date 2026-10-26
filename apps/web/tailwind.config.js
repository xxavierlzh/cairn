/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include the shared UI package, or its classes get purged on web.
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), require('@cairn/ui/tailwind-preset')],
  // react-native-web injects its own reset classes (e.g. `border-width: 0` on every View).
  // Scoping utilities under `html` gives them higher specificity so Tailwind always wins.
  important: 'html',
  // `prose` classes style the rendered Markdown preview.
  plugins: [require('@tailwindcss/typography')],
};
