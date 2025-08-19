module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/setupTests.js',
    '!src/**/*.test.{js,jsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx}',
  ],
  moduleNameMapper: {
    '^react-router-dom
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['react-app'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|other-esm-package)/)',
  ],
  testTimeout: 10000,
};: require.resolve('react-router-dom'),
    '^@/(.*)
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['react-app'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|other-esm-package)/)',
  ],
  testTimeout: 10000,
};: '<rootDir>/src/$1',
    '^@components/(.*)
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['react-app'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|other-esm-package)/)',
  ],
  testTimeout: 10000,
};: '<rootDir>/src/components/$1',
    '^@utils/(.*)
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['react-app'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|other-esm-package)/)',
  ],
  testTimeout: 10000,
};: '<rootDir>/src/utils/$1',
    '^@hooks/(.*)
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['react-app'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|other-esm-package)/)',
  ],
  testTimeout: 10000,
};: '<rootDir>/src/hooks/$1',
    '^@services/(.*)
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['react-app'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|other-esm-package)/)',
  ],
  testTimeout: 10000,
};: '<rootDir>/src/services/$1',
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['react-app'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|other-esm-package)/)',
  ],
  testTimeout: 10000,
};