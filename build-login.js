const fs = require('fs');
const path = require('path');

/*
 * Login.js is now the source of truth for the branded entry experience.
 * This check replaces the previous one-off generator, which embedded the
 * retired green/blue interface and could silently overwrite the current UI.
 */
const loginPath = path.join(__dirname, 'src', 'pages', 'Login.js');
const source = fs.readFileSync(loginPath, 'utf8');

const requiredMarkers = [
  '../assets/takeda-icon-256.png',
  'class="takeda-login"',
  'id="btn-discord"',
  'id="discord-btn-text"',
];

const missing = requiredMarkers.filter((marker) => !source.includes(marker));

if (missing.length > 0) {
  throw new Error(`Login.js incompleto. Marcadores ausentes: ${missing.join(', ')}`);
}

if (source.includes('--mint:#54E7B3') || source.includes('ringLockup')) {
  throw new Error('Login.js ainda contém elementos da identidade visual anterior.');
}

console.log('Login Takeda V2 verificado; nenhuma geração necessária.');
