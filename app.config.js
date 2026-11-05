// app.json is the config. The website build also serves the app from /app, under the landing
// page; phone builds and the dev server don't change.
module.exports = ({ config }) =>
  process.env.VINNIE_SITE === '1'
    ? { ...config, experiments: { ...config.experiments, baseUrl: '/app' } }
    : config;
