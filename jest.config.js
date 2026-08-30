module.exports = {
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false, tsconfig: 'tsconfig.json' }],
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '/__tests__/.*\\.(test|spec).js$',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/statistics/**',
    '!src/types/**',
    '!src/logger.ts',
    '!src/pjson.ts',
    '!src/models/**',
    '!src/constants/index.ts',
    '!src/constants/launchModes.ts',
    '!src/constants/logLevels.ts',
    '!src/constants/testItemTypes.ts',
  ],
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
