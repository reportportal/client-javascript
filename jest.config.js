module.exports = {
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false, tsconfig: 'tsconfig.json' }],
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '/__tests__/.*\\.(test|spec).js$',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    '!src/lib/logger.ts',
    '!src/lib/pjson.ts',
    '!src/lib/models/**',
    '!src/lib/constants/index.ts',
    '!src/lib/constants/launchModes.ts',
    '!src/lib/constants/logLevels.ts',
    '!src/lib/constants/testItemTypes.ts',
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
