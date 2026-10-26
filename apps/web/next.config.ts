import type { NextConfig } from 'next';

// We build with webpack (`--webpack` in package.json), not Turbopack. React Native libraries
// ship `Foo.web.js` next to `Foo.js` (which imports native-only code), and only webpack lets
// us prefer `.web.*` files inside node_modules. Turbopack's `resolveExtensions` ignores them.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TypeScript, and NativeWind ships JSX that Next must compile.
  transpilePackages: [
    '@cairn/core',
    '@cairn/ui',
    'nativewind',
    'react-native-css-interop',
    'react-native-web',
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Shared UI imports `react-native`; in the browser that means react-native-web.
      'react-native$': 'react-native-web',
    };
    config.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      ...config.resolve.extensions,
    ];
    return config;
  },
};

export default nextConfig;
