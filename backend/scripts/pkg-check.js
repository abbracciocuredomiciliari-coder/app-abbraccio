require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -oE "\"(imapflow|mailparser)\": \"[^\"]+\"" /var/www/app-abbraccio/backend/package.json; node -e "const p=require(\"/var/www/app-abbraccio/backend/node_modules/imapflow/package.json\");const m=require(\"/var/www/app-abbraccio/backend/node_modules/mailparser/package.json\");console.log(p.version, m.version)" 2>/dev/null', { env: { PATH: '/usr/bin:/bin:/root/.nvm/versions/node/v18/bin' } }, (e, st) => {
    let out = '';
    st.on('data', d => out += d);
    st.on('close', () => { console.log(out); conn.end(); });
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); }).connect({
  host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22),
  username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000,
});
