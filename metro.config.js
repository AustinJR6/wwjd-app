const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure common extensions are included
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Explicitly disable experimental bridgeless mode (if it’s being picked up)
config.transformer = {
  ...config.transformer,
  unstable_disableES6Transforms: false
};

config.resolver.unstable_enableSymlinks = false;

module.exports = config;