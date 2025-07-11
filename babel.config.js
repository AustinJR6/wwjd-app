module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './App',
          },
        },
      ],
      'react-native-reanimated/plugin', // must remain last
    ],
  };
};

