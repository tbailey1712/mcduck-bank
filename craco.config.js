// craco.config.js
module.exports = {
  jest: {
    configure: (jestConfig) => {
      jestConfig.collectCoverageFrom = [
        'src/**/*.{js,jsx}',
        '!src/index.js',
        '!src/reportWebVitals.js',
        '!src/setupTests.js',
        '!src/**/*.test.{js,jsx}',
        '!src/**/__tests__/**',
        '!src/**/__mocks__/**',
      ];
      jestConfig.coverageThreshold = {
        global: { branches: 70, functions: 70, lines: 70, statements: 70 },
      };
      jestConfig.testTimeout = 10000;
      jestConfig.transformIgnorePatterns = [
        'node_modules/(?!(firebase|@firebase|dompurify|axios)/)',
      ];
      // Redirect ESM-only npm packages to our mock files so Jest never
      // tries to parse the real (untransformed) node_modules sources.
      // Also fix packages whose "main" field is broken (react-router-dom v7).
      jestConfig.moduleNameMapper = {
        ...jestConfig.moduleNameMapper,
        '^firebase/firestore$': '<rootDir>/src/__mocks__/firebase',
        '^firebase/auth$': '<rootDir>/src/__mocks__/firebase',
        '^firebase/functions$': '<rootDir>/src/__mocks__/firebase',
        '^firebase/app$': '<rootDir>/src/__mocks__/firebase',
        '^dompurify$': '<rootDir>/src/__mocks__/dompurify',
        '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
        '^react-router/dom$': '<rootDir>/node_modules/react-router/dist/development/dom-export.js',
        '^react-router$': '<rootDir>/node_modules/react-router/dist/development/index.js',
      };
      return jestConfig;
    },
  },
  webpack: {
    configure: (webpackConfig) => {
      // The Firebase JS SDK is sensitive to aggressive minification, which can
      // break its internal type checks. To prevent this, we need to instruct
      // Terser (the default minifier for Create React App) to preserve
      // function and class names during the production build.

      // Find the TerserPlugin in the Webpack optimization configuration.
      const terserPlugin = webpackConfig.optimization.minimizer.find(
        (plugin) => plugin.constructor.name === 'TerserPlugin'
      );

      if (terserPlugin) {
        // We are modifying the existing Terser options, not replacing them.
        terserPlugin.options.terserOptions = {
          ...terserPlugin.options.terserOptions,
          // keep_fnames and keep_classnames are the crucial settings for Firebase.
          keep_fnames: true,
          keep_classnames: true,
        };
      }

      return webpackConfig;
    },
  },
};