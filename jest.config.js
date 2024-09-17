module.exports = {
  moduleFileExtensions: ['js'],
  testRegex: '/__tests__/.*\\.(test|spec).js$',
  testEnvironment: 'node',
  collectCoverageFrom: ['lib/**/*.js', '!lib/logger.js'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  bail: false,
};
