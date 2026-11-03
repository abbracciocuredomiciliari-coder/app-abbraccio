require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls /var/www/app-abbraccio/backend/node_modules/imapflow/package.json /var/www/app-abbraccio/backend/node_modules/mailparser/package.json 2>&1; grep -E "imapflow|mailparser" /var/www/app-abbraccio/backend/package.json /var/www/app-abbraccio/backend/package-lock.json 2>/dev/null | head -10', { env: { PATH: '/usr/bin:/bin' } }, (e, st) => {
    let out = '';
    st.on('data', d => out += d);
    st.on('close', () => { console.log(out || '(non installati)'); conn.end(); });
    st.stderr.on('data', d => process.stderr.write(d));
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); }).connect({
  host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22),
  username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000,
});
