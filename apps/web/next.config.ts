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
  // The browser only talks to this Next.js server, which forwards /api/* to the API server.
  // Same origin means the auth cookie just works, with no CORS to configure.
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
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
