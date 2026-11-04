require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls /var/www/app-abbraccio/backend/dist/routes/ && echo "=== MODELS ===" && ls /var/www/app-abbraccio/backend/dist/models/ && echo "=== UTILS ===" && ls /var/www/app-abbraccio/backend/dist/utils/ | head -40', { env: { PATH: '/usr/bin:/bin' } }, (e, st) => {
    let out = '';
    st.on('data', d => out += d);
    st.on('close', () => {
      require('fs').writeFileSync('C:/Users/Fin/AppData/Local/Temp/remote-ls.txt', out);
      console.log('saved');
      conn.end();
    });
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); }).connect({
  host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22),
  username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000,
});
