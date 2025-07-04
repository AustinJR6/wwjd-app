module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  roots: ['<rootDir>/server'],
  globals: {
    'ts-jest': {
      tsconfig: 'server/tsconfig.json'
    }
  }
};
