module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^multi-nano-web$': '<rootDir>/test/mocks/multi-nano-web.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/']
};