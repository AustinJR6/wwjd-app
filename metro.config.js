// metro.config.js

const { getDefaultConfig, mergeConfig } = require('@expo/metro-config');

const projectRoot = __dirname;
const baseConfig = getDefaultConfig(projectRoot);

module.exports = mergeConfig(baseConfig, {
  resolver: {
    sourceExts: [...baseConfig.resolver.sourceExts, 'cjs'],
    unstable_enableSymlinks: false
  },
  transformer: {
    ...baseConfig.transformer,
    unstable_disableES6Transforms: false
  }
});
