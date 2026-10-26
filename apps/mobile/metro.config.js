// Expo (SDK 52+) detects the monorepo and sets watchFolders/nodeModulesPaths for us.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
