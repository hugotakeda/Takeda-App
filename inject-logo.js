const fs = require('fs');
const b64 = fs.readFileSync('logo_base64.txt', 'utf16le').replace(/\s+/g, '');
let code = fs.readFileSync('electron/auth/oauth-server.js', 'utf8');
code = code.replace(/<svg class="icon"[\s\S]*?<\/svg>/g, `<img src="data:image/png;base64,${b64}" class="icon">`);
fs.writeFileSync('electron/auth/oauth-server.js', code, 'utf8');
