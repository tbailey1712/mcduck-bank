// craco.config.js
module.exports = {
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