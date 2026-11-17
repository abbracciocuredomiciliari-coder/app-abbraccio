require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -i "abbraccino\\|groq" ~/.pm2/logs/abbraccio-backend-error.log 2>/dev/null | tail -40; echo "===RICERCA_COUNT==="; grep -c "ricerca.*errore" ~/.pm2/logs/abbraccio-backend-error.log; echo "===ALTRE==="; grep -iv "IMAP\\|ricerca" ~/.pm2/logs/abbraccio-backend-error.log 2>/dev/null | grep -v "^\\s*at \\|^\\s*}\\|^\\s*signature\\|^\\s*hash\\|^\\s*keyId\\|^\\s*}\\|operationTime\\|clusterTime\\|errorLabels\\|ok:\\|code:\\|codeName\\|\\$clusterTime" | tail -40', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({ host: process.env.ARUBA_HOST, port: process.env.ARUBA_PORT || 22, username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
