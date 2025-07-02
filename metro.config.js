// metro.config.js

const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enableSymlinks = false;
config.transformer.unstable_disableES6Transforms = false;

module.exports = config;
