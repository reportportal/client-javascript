module.exports = {
  moduleFileExtensions: ['js', 'ts'],
  testRegex: '/__tests__/.*\\.(test|spec).(js|ts)$',
  testEnvironment: 'node',
  collectCoverageFrom: ['lib/**/*.ts', '!lib/logger.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  bail: false,
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
