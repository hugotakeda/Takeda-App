// Main-process copy of src/js/config.js — CommonJS since Electron's main
// process loads plain .js, while the renderer uses ES modules. If you change
// one, change the other; OAUTH_LOOPBACK_PORT in particular must exactly
// match the redirect URI registered in the Discord Developer Portal.

module.exports = {
  API_BASE_URL: 'https://YOUR-BACKEND.vercel.app',
  OAUTH_LOOPBACK_PORT: 51739,
};
